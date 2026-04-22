"use client";

import { useChat } from "ai/react";
import { useState } from "react";
import { api } from "~/trpc/react";

type ProposedObjective = {
  name: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";
  chapterName: string | null;
  isDebuffed: boolean;
};

type ProposedChapter = {
  name: string;
};

type QuestProposal = {
  questName: string;
  description: string | null;
  isSideQuest: boolean;
  chapters: ProposedChapter[];
  objectives: ProposedObjective[];
};

type EditableObjective = ProposedObjective & { accepted: boolean };
type EditableChapter = ProposedChapter & { accepted: boolean };

const DIFFICULTY_COLOURS: Record<string, string> = {
  EASY: "bg-green-500/20 text-green-300 border border-green-500/30",
  MEDIUM: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  HARD: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  LEGENDARY: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
};

/** Try to extract a JSON block from the last assistant message. */
function extractProposal(content: string): QuestProposal | null {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as QuestProposal;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Review UI
// ---------------------------------------------------------------------------
function ProposalReview({
  proposal,
  onConfirm,
  onRestart,
}: {
  proposal: QuestProposal;
  onConfirm: (p: QuestProposal) => void;
  onRestart: () => void;
}) {
  const [questName, setQuestName] = useState(proposal.questName);
  const [description, setDescription] = useState(proposal.description ?? "");
  const [isSideQuest, setIsSideQuest] = useState(proposal.isSideQuest);

  const [chapters, setChapters] = useState<EditableChapter[]>(
    proposal.chapters.map((c) => ({ ...c, accepted: true })),
  );

  const [objectives, setObjectives] = useState<EditableObjective[]>(
    proposal.objectives.map((o) => ({ ...o, accepted: true })),
  );

  const acceptedChapters = chapters.filter((c) => c.accepted);
  const acceptedObjectives = objectives.filter((o) => o.accepted);

  function handleConfirm() {
    onConfirm({
      questName,
      description: description.trim() || null,
      isSideQuest,
      chapters: acceptedChapters,
      objectives: acceptedObjectives,
    });
  }

  return (
    <div
      data-testid="proposal-review"
      className="space-y-5"
    >
      <div>
        <p className="mb-3 text-sm font-semibold text-[hsl(280,100%,70%)]">
          Here&apos;s your quest plan — accept, edit, or reject each piece:
        </p>

        {/* Quest name */}
        <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <label className="mb-1 block text-xs text-white/40">Quest name</label>
          <input
            data-testid="proposal-quest-name"
            value={questName}
            onChange={(e) => setQuestName(e.target.value)}
            className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-white/90 outline-none focus:border-white/40"
          />

          <label className="mb-1 mt-2 block text-xs text-white/40">
            Description (optional)
          </label>
          <input
            data-testid="proposal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-white/90 outline-none focus:border-white/40"
          />

          <label
            data-testid="proposal-side-quest-label"
            className="mt-2 flex cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              data-testid="proposal-side-quest-toggle"
              checked={isSideQuest}
              onChange={(e) => setIsSideQuest(e.target.checked)}
              className="h-4 w-4 accent-cyan-400"
            />
            <span className="text-xs text-white/50">Side Quest</span>
          </label>
        </div>

        {/* Chapters */}
        {chapters.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
              Chapters
            </p>
            <div className="space-y-1.5">
              {chapters.map((ch, i) => (
                <div
                  key={i}
                  data-testid={`proposal-chapter-${i}`}
                  className={`flex items-center gap-2 rounded-lg border p-2 ${
                    ch.accepted
                      ? "border-white/10 bg-white/5"
                      : "border-white/5 bg-white/2 opacity-40"
                  }`}
                >
                  <input
                    type="checkbox"
                    data-testid={`proposal-chapter-accept-${i}`}
                    checked={ch.accepted}
                    onChange={(e) =>
                      setChapters((prev) =>
                        prev.map((c, j) =>
                          j === i ? { ...c, accepted: e.target.checked } : c,
                        ),
                      )
                    }
                    className="h-4 w-4 accent-[hsl(280,100%,70%)]"
                  />
                  <input
                    value={ch.name}
                    onChange={(e) =>
                      setChapters((prev) =>
                        prev.map((c, j) =>
                          j === i ? { ...c, name: e.target.value } : c,
                        ),
                      )
                    }
                    className="flex-1 rounded border-none bg-transparent text-sm text-white/80 outline-none focus:bg-white/10 focus:px-2"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Objectives */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
            Objectives ({acceptedObjectives.length} of {objectives.length} accepted)
          </p>
          <div className="space-y-1.5">
            {objectives.map((obj, i) => (
              <div
                key={i}
                data-testid={`proposal-objective-${i}`}
                className={`flex items-start gap-2 rounded-lg border p-2 ${
                  obj.accepted
                    ? "border-white/10 bg-white/5"
                    : "border-white/5 opacity-40"
                }`}
              >
                <input
                  type="checkbox"
                  data-testid={`proposal-objective-accept-${i}`}
                  checked={obj.accepted}
                  onChange={(e) =>
                    setObjectives((prev) =>
                      prev.map((o, j) =>
                        j === i ? { ...o, accepted: e.target.checked } : o,
                      ),
                    )
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(280,100%,70%)]"
                />
                <div className="flex-1 min-w-0">
                  <input
                    data-testid={`proposal-objective-name-${i}`}
                    value={obj.name}
                    onChange={(e) =>
                      setObjectives((prev) =>
                        prev.map((o, j) =>
                          j === i ? { ...o, name: e.target.value } : o,
                        ),
                      )
                    }
                    className="w-full rounded border-none bg-transparent text-sm text-white/80 outline-none focus:bg-white/10 focus:px-1"
                  />
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      data-testid={`proposal-objective-difficulty-${i}`}
                      value={obj.difficulty}
                      onChange={(e) =>
                        setObjectives((prev) =>
                          prev.map((o, j) =>
                            j === i
                              ? { ...o, difficulty: e.target.value as ProposedObjective["difficulty"] }
                              : o,
                          ),
                        )
                      }
                      className={`rounded border-none px-1.5 py-0.5 text-xs outline-none ${DIFFICULTY_COLOURS[obj.difficulty]}`}
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                      <option value="LEGENDARY">Legendary</option>
                    </select>
                    {obj.chapterName && (
                      <span className="text-xs text-white/30">
                        in {obj.chapterName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          data-testid="proposal-restart"
          onClick={onRestart}
          className="rounded border border-white/20 px-4 py-2 text-sm text-white/50 hover:text-white/70"
        >
          Start over
        </button>
        <button
          data-testid="proposal-confirm"
          onClick={handleConfirm}
          disabled={!questName.trim() || acceptedObjectives.length === 0}
          className="flex-1 rounded bg-[hsl(280,100%,70%)]/20 px-4 py-2 text-sm font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/30 disabled:opacity-40"
        >
          Create Quest ✨
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main onboarding component
// ---------------------------------------------------------------------------
export function OnboardingConversation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"chat" | "review" | "confirming">("chat");
  const [proposal, setProposal] = useState<QuestProposal | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const utils = api.useUtils();
  const createQuest = api.quest.createQuest.useMutation();
  const createChapter = api.chapter.createChapter.useMutation();
  const createObjective = api.objective.createObjective.useMutation();

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/onboarding-chat",
      onFinish: (message) => {
        const extracted = extractProposal(message.content);
        if (extracted) {
          setProposal(extracted);
          setPhase("review");
        }
      },
    });

  async function handleConfirm(finalProposal: QuestProposal) {
    setPhase("confirming");
    setConfirmError(null);

    try {
      const q = await createQuest.mutateAsync({
        name: finalProposal.questName,
        description: finalProposal.description ?? undefined,
        isSideQuest: finalProposal.isSideQuest,
      });

      // Create chapters
      const chapterIdMap: Record<string, number> = {};
      for (const ch of finalProposal.chapters) {
        const created = await createChapter.mutateAsync({
          questId: q.id,
          name: ch.name,
        });
        chapterIdMap[ch.name] = created.id;
      }

      // Create objectives
      for (const obj of finalProposal.objectives) {
        await createObjective.mutateAsync({
          questId: q.id,
          chapterId: obj.chapterName ? chapterIdMap[obj.chapterName] : undefined,
          name: obj.name,
          difficulty: obj.difficulty,
          isDebuffed: obj.isDebuffed && !finalProposal.isSideQuest,
        });
      }

      void utils.quest.listActiveQuests.invalidate();
      void utils.quest.hasAnyQuests.invalidate();
      onComplete();
    } catch (err) {
      setConfirmError((err as Error).message);
      setPhase("review");
    }
  }

  // Start the conversation automatically
  const started = typeof window !== "undefined" && messages.length === 0;

  return (
    <div
      data-testid="onboarding-conversation"
      className="flex min-h-screen flex-col bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white"
    >
      {/* Header */}
      <div className="px-6 py-8 text-center">
        <h1 className="text-2xl font-extrabold text-white">
          Welcome, Adventurer
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Let&apos;s set up your first quest.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {phase === "review" || phase === "confirming" ? (
          <div className="mx-auto max-w-md">
            {confirmError && (
              <p className="mb-3 rounded bg-red-500/20 px-3 py-2 text-sm text-red-300">
                {confirmError}
              </p>
            )}
            {phase === "confirming" ? (
              <div className="flex items-center justify-center gap-3 py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span className="text-white/50">Creating your quest…</span>
              </div>
            ) : (
              proposal && (
                <ProposalReview
                  proposal={proposal}
                  onConfirm={handleConfirm}
                  onRestart={() => {
                    setPhase("chat");
                    setProposal(null);
                  }}
                />
              )
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-md flex-col gap-4">
            {/* Opening prompt */}
            <div
              data-testid="onboarding-opening-prompt"
              className="rounded-xl border border-[hsl(280,100%,70%)]/20 bg-[hsl(280,100%,70%)]/5 px-5 py-4 text-center"
            >
              <p className="text-lg font-semibold text-white">
                What&apos;s weighing on you right now?
              </p>
              <p className="mt-1 text-xs text-white/40">
                Brain-dump anything. I&apos;ll help you turn it into a quest.
              </p>
            </div>

            {/* Chat messages */}
            <div className="space-y-3">
              {messages
                .filter((m) => !extractProposal(m.content))
                .map((m) => (
                  <div
                    key={m.id}
                    data-testid={`onboarding-msg-${m.role}`}
                    className={`rounded-lg px-4 py-3 text-sm ${
                      m.role === "assistant"
                        ? "border border-[hsl(280,100%,70%)]/20 bg-[hsl(280,100%,70%)]/10 text-white/90"
                        : "ml-6 bg-white/10 text-white/70"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}

              {isLoading && (
                <div className="flex items-center gap-2 px-1">
                  <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" />
                  <span className="text-xs text-white/30">Thinking…</span>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              data-testid="onboarding-chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="flex gap-2"
            >
              <input
                data-testid="onboarding-chat-input"
                value={input}
                onChange={handleInputChange}
                placeholder={
                  messages.length === 0
                    ? "Type what's on your mind…"
                    : "Reply…"
                }
                autoFocus={started}
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/90 placeholder-white/30 outline-none focus:border-[hsl(280,100%,70%)]/40"
              />
              <button
                type="submit"
                data-testid="onboarding-chat-send"
                disabled={isLoading || !input.trim()}
                className="rounded-xl bg-[hsl(280,100%,70%)]/20 px-5 py-3 text-sm font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/30 disabled:opacity-40"
              >
                →
              </button>
            </form>

            {/* Shortcut: "I'm done, propose a quest" */}
            {messages.length >= 2 && !isLoading && (
              <button
                data-testid="onboarding-propose-btn"
                onClick={() => {
                  void append({
                    role: "user",
                    content:
                      "That's everything. Please propose a structured quest now.",
                  });
                }}
                className="text-center text-xs text-white/30 hover:text-white/60"
              >
                I&apos;m done — propose a quest →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
