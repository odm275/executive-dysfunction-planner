"use client";

import { useChat } from "ai/react";
import { useState } from "react";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { api } from "~/trpc/react";
import { CreateQuestForm } from "~/app/_components/CreateQuestForm";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Difficulty = "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";

type ProposedObjective = {
  name: string;
  difficulty: Difficulty;
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

type ProposedAddObjective = {
  name: string;
  difficulty: Difficulty;
  isRecruitable: boolean;
};

type AddObjectivesProposal = {
  objectives: ProposedAddObjective[];
};

type EditableObjective = ProposedObjective & { accepted: boolean };
type EditableChapter = ProposedChapter & { accepted: boolean };
type EditableAddObjective = ProposedAddObjective & { accepted: boolean };

const DIFFICULTY_VARIANTS: Record<
  Difficulty,
  VariantProps<typeof badgeVariants>["variant"]
> = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
  LEGENDARY: "legendary",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractQuestProposal(content: string): QuestProposal | null {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    if (!("questName" in parsed)) return null;
    return parsed as unknown as QuestProposal;
  } catch {
    return null;
  }
}

function extractAddObjectivesProposal(
  content: string,
): AddObjectivesProposal | null {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    if (!("objectives" in parsed) || "questName" in parsed) return null;
    return parsed as unknown as AddObjectivesProposal;
  } catch {
    return null;
  }
}

function hasProposal(content: string, mode: "new-quest" | "add-objectives") {
  return mode === "new-quest"
    ? extractQuestProposal(content) !== null
    : extractAddObjectivesProposal(content) !== null;
}

// ---------------------------------------------------------------------------
// ProposalReview — new-quest mode (full quest)
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

  // Inline "Add chapter" state: tracks which objective index triggered it
  const [addingChapterForObj, setAddingChapterForObj] = useState<number | null>(null);
  const [newChapterInput, setNewChapterInput] = useState("");

  const acceptedChapters = chapters.filter((c) => c.accepted);
  const acceptedObjectives = objectives.filter((o) => o.accepted);

  function toggleChapter(index: number, checked: boolean) {
    const chapterName = chapters[index]?.name;
    setChapters((prev) =>
      prev.map((c, j) => (j === index ? { ...c, accepted: checked } : c)),
    );
    // If rejecting, reset any objectives that were using this chapter
    if (!checked && chapterName) {
      setObjectives((prev) =>
        prev.map((o) =>
          o.chapterName === chapterName ? { ...o, chapterName: null } : o,
        ),
      );
    }
  }

  function handleObjectiveChapterChange(objIndex: number, value: string) {
    if (value === "__new__") {
      setAddingChapterForObj(objIndex);
      setNewChapterInput("");
      return;
    }
    setObjectives((prev) =>
      prev.map((o, j) =>
        j === objIndex ? { ...o, chapterName: value || null } : o,
      ),
    );
  }

  function confirmNewChapter(objIndex: number) {
    const trimmed = newChapterInput.trim();
    if (!trimmed) {
      setAddingChapterForObj(null);
      return;
    }
    // Add chapter to list if not already present
    const exists = chapters.some((c) => c.name === trimmed);
    if (!exists) {
      setChapters((prev) => [...prev, { name: trimmed, accepted: true }]);
    }
    // Assign to objective
    setObjectives((prev) =>
      prev.map((o, j) => (j === objIndex ? { ...o, chapterName: trimmed } : o)),
    );
    setAddingChapterForObj(null);
    setNewChapterInput("");
  }

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
    <div data-testid="proposal-review" className="space-y-5">
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
          <Label className="flex cursor-pointer items-center gap-2">
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
                  onCheckedChange={(checked) => toggleChapter(i, Boolean(checked))}
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
              <div className="min-w-0 flex-1">
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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Select
                    value={obj.difficulty}
                    onValueChange={(value) =>
                      setObjectives((prev) =>
                        prev.map((o, j) =>
                          j === i
                            ? { ...o, difficulty: value as Difficulty }
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

                  {/* Chapter picker */}
                  {addingChapterForObj === i ? (
                    <div className="flex items-center gap-1">
                      <Input
                        data-testid={`proposal-objective-new-chapter-input-${i}`}
                        value={newChapterInput}
                        onChange={(e) => setNewChapterInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmNewChapter(i);
                          }
                          if (e.key === "Escape") {
                            setAddingChapterForObj(null);
                          }
                        }}
                        placeholder="New chapter name"
                        autoFocus
                        className="h-6 w-32 text-xs"
                      />
                      <Button
                        size="sm"
                        data-testid={`proposal-objective-new-chapter-confirm-${i}`}
                        aria-label="Confirm new chapter"
                        onClick={() => confirmNewChapter(i)}
                        className="h-6 px-1.5 text-xs"
                      >
                        <Check className="size-3" />
                        Add
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`proposal-objective-new-chapter-cancel-${i}`}
                        aria-label="Cancel adding chapter"
                        onClick={() => setAddingChapterForObj(null)}
                        className="h-6 px-1.5 text-xs text-muted-foreground"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={obj.chapterName ?? ""}
                      onValueChange={(value) => handleObjectiveChapterChange(i, value ?? "")}
                    >
                      <SelectTrigger
                        data-testid={`proposal-objective-chapter-${i}`}
                        size="sm"
                        className="h-6 w-auto border-none text-xs shadow-none"
                      >
                        <SelectValue placeholder="No chapter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No chapter</SelectItem>
                        {acceptedChapters.map((ch) => (
                          <SelectItem key={ch.name} value={ch.name}>
                            {ch.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">Add chapter…</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          data-testid="proposal-restart"
          aria-label="Start over"
          onClick={onRestart}
        >
          <RotateCcw className="size-3" />
          Restart
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
// AddObjectivesProposalReview — add-objectives mode (objectives only)
// ---------------------------------------------------------------------------

function AddObjectivesProposalReview({
  proposal,
  onConfirm,
  onRestart,
}: {
  proposal: AddObjectivesProposal;
  onConfirm: (objectives: ProposedAddObjective[]) => void;
  onRestart: () => void;
}) {
  const [objectives, setObjectives] = useState<EditableAddObjective[]>(
    proposal.objectives.map((o) => ({ ...o, accepted: true })),
  );

  const acceptedObjectives = objectives.filter((o) => o.accepted);

  return (
    <div data-testid="add-objectives-proposal-review" className="space-y-5">
      <p className="text-sm font-semibold text-primary">
        Here are the proposed objectives — accept, edit, or reject each one:
      </p>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          New Objectives ({acceptedObjectives.length} of {objectives.length} accepted)
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
              <div className="min-w-0 flex-1">
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
                <div className="mt-1">
                  <Select
                    value={obj.difficulty}
                    onValueChange={(value) =>
                      setObjectives((prev) =>
                        prev.map((o, j) =>
                          j === i
                            ? { ...o, difficulty: value as Difficulty }
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
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          data-testid="proposal-restart"
          aria-label="Start over"
          onClick={onRestart}
        >
          <RotateCcw className="size-3" />
          Restart
        </Button>
        <Button
          data-testid="proposal-confirm"
          onClick={() => onConfirm(acceptedObjectives)}
          disabled={acceptedObjectives.length === 0}
          className="flex-1"
        >
          Add Objectives ✨
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestBuilderChat — unified component for both modes
// ---------------------------------------------------------------------------

type NewQuestProps = {
  mode: "new-quest";
  onSuccess: () => void;
  onCancel: () => void;
};

type AddObjectivesProps = {
  mode: "add-objectives";
  questId: number;
  questName: string;
  existingObjectiveNames: string[];
  onSuccess: () => void;
  onCancel: () => void;
};

type QuestBuilderChatProps = NewQuestProps | AddObjectivesProps;

export function QuestBuilderChat(props: QuestBuilderChatProps) {
  const { mode, onSuccess, onCancel } = props;

  const isAddMode = mode === "add-objectives";
  const questId = isAddMode ? (props as AddObjectivesProps).questId : undefined;
  const questNameContext = isAddMode
    ? (props as AddObjectivesProps).questName
    : undefined;
  const existingObjectiveNames = isAddMode
    ? (props as AddObjectivesProps).existingObjectiveNames
    : [];

  type Phase = "chat" | "review" | "confirming" | "skip";
  const [phase, setPhase] = useState<Phase>("chat");
  const [newQuestProposal, setNewQuestProposal] = useState<QuestProposal | null>(null);
  const [addObjectivesProposal, setAddObjectivesProposal] =
    useState<AddObjectivesProposal | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const utils = api.useUtils();
  const createQuest = api.quest.createQuest.useMutation();
  const createChapter = api.chapter.createChapter.useMutation();
  const createObjective = api.objective.createObjective.useMutation();

  const chatBody =
    mode === "add-objectives"
      ? {
          mode: "add-objectives",
          questName: questNameContext,
          existingObjectives: existingObjectiveNames.join("\n"),
        }
      : { mode: "new-quest" };

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/quest-chat",
      body: chatBody,
      onFinish: (message) => {
        if (mode === "new-quest") {
          const extracted = extractQuestProposal(message.content);
          if (extracted) {
            setNewQuestProposal(extracted);
            setPhase("review");
          }
        } else {
          const extracted = extractAddObjectivesProposal(message.content);
          if (extracted) {
            setAddObjectivesProposal(extracted);
            setPhase("review");
          }
        }
      },
    });

  async function handleNewQuestConfirm(finalProposal: QuestProposal) {
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
      onSuccess();
    } catch (err) {
      setConfirmError((err as Error).message);
      setPhase("review");
    }
  }

  async function handleAddObjectivesConfirm(
    objectives: ProposedAddObjective[],
  ) {
    if (!questId) return;
    setPhase("confirming");
    setConfirmError(null);
    try {
      for (const obj of objectives) {
        await createObjective.mutateAsync({
          questId,
          name: obj.name,
          difficulty: obj.difficulty,
          isRecruitable: obj.isRecruitable,
        });
      }
      void utils.quest.listActiveQuests.invalidate();
      onSuccess();
    } catch (err) {
      setConfirmError((err as Error).message);
      setPhase("review");
    }
  }

  if (phase === "skip" && mode === "new-quest") {
    return (
      <CreateQuestForm
        onSuccess={onSuccess}
        onCancel={() => setPhase("chat")}
      />
    );
  }

  const title = mode === "add-objectives" ? "Add Objectives" : "New Quest";

  return (
    <div
      data-testid="quest-builder-chat"
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Button
          variant="outline"
          size="sm"
          data-testid="quest-builder-discard"
          aria-label="Cancel quest builder"
          onClick={onCancel}
          className="text-xs"
        >
          <X className="size-3" />
          Cancel
        </Button>
      </div>

      {/* Confirming spinner */}
      {phase === "confirming" && (
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">
            {mode === "add-objectives" ? "Adding objectives…" : "Creating your quest…"}
          </span>
        </div>
      )}

      {/* Error */}
      {confirmError && (
        <Alert variant="destructive">
          <AlertDescription>{confirmError}</AlertDescription>
        </Alert>
      )}

      {/* Review phase */}
      {phase === "review" && mode === "new-quest" && newQuestProposal && (
        <ProposalReview
          proposal={newQuestProposal}
          onConfirm={handleNewQuestConfirm}
          onRestart={() => {
            setPhase("chat");
            setNewQuestProposal(null);
          }}
        />
      )}

      {phase === "review" && mode === "add-objectives" && addObjectivesProposal && (
        <AddObjectivesProposalReview
          proposal={addObjectivesProposal}
          onConfirm={handleAddObjectivesConfirm}
          onRestart={() => {
            setPhase("chat");
            setAddObjectivesProposal(null);
          }}
        />
      )}

      {/* Chat phase */}
      {phase === "chat" && (
        <>
          {/* Opening prompt */}
          {messages.length === 0 && (
            <Card className="text-center">
              <CardContent className="pt-4">
                {mode === "add-objectives" ? (
                  <>
                    <p className="text-sm font-semibold">
                      What should we add to &ldquo;{questNameContext}&rdquo;?
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tell me what else needs to happen.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">
                      What&apos;s the new quest about?
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tell me what you want to accomplish.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Messages */}
          <div className="space-y-3">
            {messages
              .filter((m) => !hasProposal(m.content, mode))
              .map((m) => (
                <div
                  key={m.id}
                  data-testid={`quest-chat-msg-${m.role}`}
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
            data-testid="quest-chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(e);
            }}
            className="flex gap-2"
          >
            <Input
              data-testid="quest-chat-input"
              value={input}
              onChange={handleInputChange}
              placeholder={
                messages.length === 0
                  ? mode === "add-objectives"
                    ? "What needs to be done…"
                    : "Describe your quest…"
                  : "Reply…"
              }
              autoFocus
            />
            <Button
              type="submit"
              data-testid="quest-chat-send"
              disabled={isLoading || !input.trim()}
            >
              →
            </Button>
          </form>

          {/* Quick propose shortcut */}
          {messages.length >= 2 && !isLoading && (
            <Button
              variant="ghost"
              size="sm"
              data-testid="quest-chat-propose-btn"
              onClick={() => {
                void append({
                  role: "user",
                  content:
                    mode === "add-objectives"
                      ? "That's everything. Please propose objectives now."
                      : "That's everything. Please propose a structured quest now.",
                });
              }}
              className="text-xs text-muted-foreground"
            >
              {mode === "add-objectives"
                ? "I'm done — propose objectives →"
                : "I'm done — propose a quest →"}
            </Button>
          )}

          {/* Skip to quick add (new-quest only) */}
          {mode === "new-quest" && (
            <Button
              variant="ghost"
              size="sm"
              data-testid="quest-chat-skip"
              onClick={() => setPhase("skip")}
              className="text-xs text-muted-foreground/50"
            >
              Skip chat — quick add
            </Button>
          )}
        </>
      )}
    </div>
  );
}
