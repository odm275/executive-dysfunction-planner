"use client";

import { useChat } from "ai/react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge, type badgeVariants } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { VariantProps } from "class-variance-authority";

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

const DIFFICULTY_VARIANTS: Record<
  string,
  VariantProps<typeof badgeVariants>["variant"]
> = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
  LEGENDARY: "legendary",
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
      <p className="text-sm font-semibold text-primary">
        Here&apos;s your quest plan — accept, edit, or reject each piece:
      </p>

      {/* Quest name */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Quest name</Label>
            <Input
              data-testid="proposal-quest-name"
              value={questName}
              onChange={(e) => setQuestName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Description (optional)
            </Label>
            <Input
              data-testid="proposal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Label
            data-testid="proposal-side-quest-label"
            className="flex cursor-pointer items-center gap-2"
          >
            <Checkbox
              data-testid="proposal-side-quest-toggle"
              checked={isSideQuest}
              onCheckedChange={(checked) => setIsSideQuest(Boolean(checked))}
            />
            <span className="text-xs text-muted-foreground">Side Quest</span>
          </Label>
        </CardContent>
      </Card>

      {/* Chapters */}
      {chapters.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Chapters
          </p>
          <div className="space-y-1.5">
            {chapters.map((ch, i) => (
              <div
                key={i}
                data-testid={`proposal-chapter-${i}`}
                className={`flex items-center gap-2 rounded-lg border p-2 ${
                  ch.accepted ? "border-border bg-muted/20" : "border-border/30 opacity-40"
                }`}
              >
                <Checkbox
                  data-testid={`proposal-chapter-accept-${i}`}
                  checked={ch.accepted}
                  onCheckedChange={(checked) =>
                    setChapters((prev) =>
                      prev.map((c, j) =>
                        j === i ? { ...c, accepted: Boolean(checked) } : c,
                      ),
                    )
                  }
                />
                <Input
                  value={ch.name}
                  onChange={(e) =>
                    setChapters((prev) =>
                      prev.map((c, j) =>
                        j === i ? { ...c, name: e.target.value } : c,
                      ),
                    )
                  }
                  className="flex-1 h-7 border-none bg-transparent text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objectives */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Objectives ({acceptedObjectives.length} of {objectives.length} accepted)
        </p>
        <div className="space-y-1.5">
          {objectives.map((obj, i) => (
            <div
              key={i}
              data-testid={`proposal-objective-${i}`}
              className={`flex items-start gap-2 rounded-lg border p-2 ${
                obj.accepted ? "border-border bg-muted/20" : "border-border/30 opacity-40"
              }`}
            >
              <Checkbox
                data-testid={`proposal-objective-accept-${i}`}
                checked={obj.accepted}
                onCheckedChange={(checked) =>
                  setObjectives((prev) =>
                    prev.map((o, j) =>
                      j === i ? { ...o, accepted: Boolean(checked) } : o,
                    ),
                  )
                }
                className="mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Input
                  data-testid={`proposal-objective-name-${i}`}
                  value={obj.name}
                  onChange={(e) =>
                    setObjectives((prev) =>
                      prev.map((o, j) =>
                        j === i ? { ...o, name: e.target.value } : o,
                      ),
                    )
                  }
                  className="h-7 border-none bg-transparent text-sm shadow-none focus-visible:ring-0"
                />
                <div className="mt-1 flex items-center gap-2">
                  <Select
                    value={obj.difficulty}
                    onValueChange={(value) =>
                      setObjectives((prev) =>
                        prev.map((o, j) =>
                          j === i
                            ? { ...o, difficulty: value as ProposedObjective["difficulty"] }
                            : o,
                        ),
                      )
                    }
                  >
                    <SelectTrigger
                      data-testid={`proposal-objective-difficulty-${i}`}
                      size="sm"
                      className="h-6 w-auto border-none shadow-none"
                    >
                      <Badge variant={DIFFICULTY_VARIANTS[obj.difficulty]}>
                        <SelectValue />
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EASY">Easy</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HARD">Hard</SelectItem>
                      <SelectItem value="LEGENDARY">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                  {obj.chapterName && (
                    <span className="text-xs text-muted-foreground">
                      in {obj.chapterName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          data-testid="proposal-restart"
          onClick={onRestart}
        >
          Start over
        </Button>
        <Button
          data-testid="proposal-confirm"
          onClick={handleConfirm}
          disabled={!questName.trim() || acceptedObjectives.length === 0}
          className="flex-1"
        >
          Create Quest ✨
        </Button>
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

      const chapterIdMap: Record<string, number> = {};
      for (const ch of finalProposal.chapters) {
        const created = await createChapter.mutateAsync({
          questId: q.id,
          name: ch.name,
        });
        chapterIdMap[ch.name] = created.id;
      }

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

  const started = typeof window !== "undefined" && messages.length === 0;

  return (
    <div
      data-testid="onboarding-conversation"
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      {/* Header */}
      <div className="px-6 py-8 text-center">
        <h1 className="text-2xl font-extrabold">
          Welcome, Adventurer
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Let&apos;s set up your first quest.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {phase === "review" || phase === "confirming" ? (
          <div className="mx-auto max-w-md">
            {confirmError && (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{confirmError}</AlertDescription>
              </Alert>
            )}
            {phase === "confirming" ? (
              <div className="flex items-center justify-center gap-3 py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Creating your quest…</span>
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
            <Card
              data-testid="onboarding-opening-prompt"
              className="text-center"
            >
              <CardContent className="pt-4">
                <p className="text-lg font-semibold">
                  What&apos;s weighing on you right now?
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Brain-dump anything. I&apos;ll help you turn it into a quest.
                </p>
              </CardContent>
            </Card>

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
                        ? "bg-muted"
                        : "ml-6 bg-muted/50"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}

              {isLoading && (
                <div className="flex items-center gap-2 px-1">
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
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
              <Input
                data-testid="onboarding-chat-input"
                value={input}
                onChange={handleInputChange}
                placeholder={
                  messages.length === 0
                    ? "Type what's on your mind…"
                    : "Reply…"
                }
                autoFocus={started}
              />
              <Button
                type="submit"
                data-testid="onboarding-chat-send"
                disabled={isLoading || !input.trim()}
              >
                →
              </Button>
            </form>

            {/* Shortcut: "I'm done, propose a quest" */}
            {messages.length >= 2 && !isLoading && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="onboarding-propose-btn"
                onClick={() => {
                  void append({
                    role: "user",
                    content:
                      "That's everything. Please propose a structured quest now.",
                  });
                }}
                className="text-xs text-muted-foreground"
              >
                I&apos;m done — propose a quest →
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
