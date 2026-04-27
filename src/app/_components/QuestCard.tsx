"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import { api } from "~/trpc/react";
import { EditQuestForm } from "~/app/_components/EditQuestForm";
import { QuestBuilderChat } from "~/app/_components/QuestBuilderChat";
import { Badge, type badgeVariants } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import type { VariantProps } from "class-variance-authority";

type SubTask = {
  id: number;
  name: string;
  isCompleted: boolean;
  order: number;
};

type CounterTool = {
  id: number;
  name: string;
};

type Objective = {
  id: number;
  name: string;
  description: string | null;
  trackingMode: "BINARY" | "PROGRESS_BAR";
  difficulty: "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";
  isDebuffed: boolean;
  isRecruitable: boolean;
  isCompleted: boolean;
  chapterId: number | null;
  order: number;
  subTasks: SubTask[];
  counterTools: CounterTool[];
};

type Chapter = {
  id: number;
  name: string;
  order: number;
};

type Quest = {
  id: number;
  name: string;
  description: string | null;
  isSideQuest: boolean;
  isArchived: boolean;
  chapters: Chapter[];
  objectives: Objective[];
};

const DIFFICULTY_LABELS: Record<Objective["difficulty"], string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  LEGENDARY: "Legendary",
};

const DIFFICULTY_VARIANTS: Record<
  Objective["difficulty"],
  VariantProps<typeof badgeVariants>["variant"]
> = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
  LEGENDARY: "legendary",
};

function progressPercent(objectives: Objective[]): number {
  if (objectives.length === 0) return 0;
  const completed = objectives.filter((o) => o.isCompleted).length;
  return Math.round((completed / objectives.length) * 100);
}

function objectiveProgress(obj: Objective): number {
  if (obj.isCompleted) return 100;
  if (obj.trackingMode === "BINARY") return 0;
  if (obj.subTasks.length === 0) return 0;
  const done = obj.subTasks.filter((s) => s.isCompleted).length;
  return Math.round((done / obj.subTasks.length) * 100);
}

// ---------------------------------------------------------------------------
// ObjectiveDetail
// ---------------------------------------------------------------------------
function ObjectiveDetail({
  obj,
  isSideQuest,
  chapters,
  onRefresh,
  onCompleted,
  onEditingChange,
}: {
  obj: Objective;
  isSideQuest: boolean;
  chapters: Chapter[];
  onRefresh: () => void;
  onCompleted?: (objectiveName: string, difficulty: string) => void;
  onEditingChange?: (isEditing: boolean) => void;
}) {
  const progress = objectiveProgress(obj);
  const utils = api.useUtils();

  // ---- Edit mode state ----
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(obj.name);
  const [editDifficulty, setEditDifficulty] = useState<Objective["difficulty"]>(obj.difficulty);
  const [editChapterId, setEditChapterId] = useState<number | null | undefined>(obj.chapterId);
  const [editIsRecruitable, setEditIsRecruitable] = useState(obj.isRecruitable);
  const [editDescription, setEditDescription] = useState(obj.description ?? "");

  // ---- Description collapse state ----
  const [descriptionOpen, setDescriptionOpen] = useState(true);

  function enterEdit() {
    setEditName(obj.name);
    setEditDifficulty(obj.difficulty);
    setEditChapterId(obj.chapterId);
    setEditIsRecruitable(obj.isRecruitable);
    setEditDescription(obj.description ?? "");
    setIsEditing(true);
    onEditingChange?.(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    onEditingChange?.(false);
  }

  // Invite link generation
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const generateInvite = api.collaboration.generateInviteLink.useMutation({
    onSuccess: ({ token }) => {
      const url = `${window.location.origin}/invite?token=${token}`;
      setInviteLink(url);
    },
  });

  // Collaborators query (only for recruitable objectives)
  const { data: collaborators } = api.collaboration.listCollaborators.useQuery(
    { objectiveId: obj.id },
    { enabled: obj.isRecruitable },
  );

  // Debuff toggle / update objective
  const updateObjective = api.objective.updateObjective.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onRefresh();
    },
  });

  function saveEdit() {
    updateObjective.mutate(
      {
        id: obj.id,
        name: editName.trim() || obj.name,
        description: editDescription.trim() || null,
        difficulty: editDifficulty,
        chapterId: editChapterId === undefined ? null : editChapterId,
        isRecruitable: editIsRecruitable,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          onEditingChange?.(false);
        },
      },
    );
  }

  // Complete objective
  const completeObjective = api.objective.completeObjective.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onRefresh();
      onCompleted?.(obj.name, obj.difficulty);
    },
  });

  // Archive objective
  const archiveObjective = api.objective.archiveObjective.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.objective.listArchivedObjectives.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onRefresh();
    },
  });

  // Counter-tool mutations
  const addCounterTool = api.debuff.addCounterTool.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onRefresh();
    },
  });
  const updateCounterTool = api.debuff.updateCounterTool.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onRefresh();
    },
  });
  const removeCounterTool = api.debuff.removeCounterTool.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onRefresh();
    },
  });

  // New counter-tool input state
  const [newToolName, setNewToolName] = useState("");
  const newToolInputRef = useRef<HTMLInputElement>(null);

  // Edit state: which counter-tool is being edited
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  function handleToggleDebuff() {
    updateObjective.mutate({ id: obj.id, isDebuffed: !obj.isDebuffed });
  }

  function handleAddTool(e: React.FormEvent) {
    e.preventDefault();
    const name = newToolName.trim();
    if (!name) return;
    addCounterTool.mutate(
      { objectiveId: obj.id, name },
      {
        onSuccess: () => {
          setNewToolName("");
          newToolInputRef.current?.focus();
        },
      },
    );
  }

  function handleEditSave(id: number) {
    const name = editingName.trim();
    if (!name) return;
    updateCounterTool.mutate(
      { id, name },
      { onSuccess: () => setEditingId(null) },
    );
  }

  return (
    <div
      data-testid={`objective-detail-${obj.id}`}
      className="rounded-lg border border-border bg-muted/30 p-4"
    >
      {/* Edit form */}
      {isEditing && (
        <div
          data-testid={`objective-edit-form-${obj.id}`}
          className="mb-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3"
        >
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              data-testid={`objective-edit-name-${obj.id}`}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Difficulty</Label>
            <Select
              value={editDifficulty}
              onValueChange={(value) =>
                setEditDifficulty(value as Objective["difficulty"])
              }
            >
              <SelectTrigger data-testid={`objective-edit-difficulty-${obj.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
                <SelectItem value="LEGENDARY">Legendary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Chapter</Label>
            <Select
              value={editChapterId?.toString() ?? ""}
              onValueChange={(value) =>
                setEditChapterId(value === "" ? null : Number(value))
              }
            >
              <SelectTrigger data-testid={`objective-edit-chapter-${obj.id}`}>
                <SelectValue placeholder="No chapter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No chapter</SelectItem>
                {chapters.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id.toString()}>
                    {ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              data-testid={`objective-edit-recruitable-${obj.id}`}
              checked={editIsRecruitable}
              onCheckedChange={(checked) => setEditIsRecruitable(Boolean(checked))}
            />
            <span className="text-xs text-muted-foreground">Recruitable</span>
          </Label>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Description (optional)</Label>
            <Textarea
              data-testid={`objective-edit-description-${obj.id}`}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Add context, motivation, or approach notes…"
              className="min-h-20 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              data-testid={`objective-edit-cancel-${obj.id}`}
              onClick={cancelEdit}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              data-testid={`objective-edit-save-${obj.id}`}
              onClick={saveEdit}
              disabled={updateObjective.isPending || !editName.trim()}
            >
              {updateObjective.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="font-semibold">{obj.name}</span>
        <div className="flex shrink-0 items-center gap-2">
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`objective-edit-btn-${obj.id}`}
              onClick={enterEdit}
              className="h-auto px-2 py-0.5 text-xs"
            >
              Edit
            </Button>
          )}
          <Badge variant={DIFFICULTY_VARIANTS[obj.difficulty]}>
            {DIFFICULTY_LABELS[obj.difficulty]}
          </Badge>
        </div>
      </div>

      {/* Attributes row */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Mode: {obj.trackingMode === "BINARY" ? "Binary" : "Progress Bar"}</span>
        {obj.isRecruitable && (
          <Badge variant="secondary">Recruitable</Badge>
        )}
        {obj.isDebuffed && (
          <Badge variant="destructive">⚡ Emotionally Charged</Badge>
        )}
        {obj.isCompleted && (
          <Badge variant="outline">✓ Complete</Badge>
        )}
      </div>

      {/* Description section — collapsible, expanded by default */}
      {!isEditing && (obj.description ?? "") !== "" && (
        <div className="mb-3">
          <Collapsible open={descriptionOpen} onOpenChange={setDescriptionOpen}>
            <CollapsibleTrigger
              data-testid={`objective-description-toggle-${obj.id}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {descriptionOpen ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              <span>Notes</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p
                data-testid={`objective-description-${obj.id}`}
                className="mt-1.5 rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
              >
                {obj.description}
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Debuff toggle — hidden for Side Quest objectives */}
      {!obj.isCompleted && !isSideQuest && (
        <div className="mb-3">
          <Button
            variant={obj.isDebuffed ? "destructive" : "outline"}
            size="sm"
            data-testid={`debuff-toggle-${obj.id}`}
            onClick={handleToggleDebuff}
            disabled={updateObjective.isPending}
          >
            {obj.isDebuffed ? "⚡ Emotionally Charged — Remove tag" : "Tag as Emotionally Charged"}
          </Button>
        </div>
      )}

      {/* Complete button */}
      {!obj.isCompleted && (
        <div className="mb-3">
          <Button
            variant="outline"
            size="sm"
            data-testid={`complete-objective-btn-${obj.id}`}
            onClick={() => completeObjective.mutate({ id: obj.id })}
            disabled={completeObjective.isPending}
            className="border-green-500/40 text-green-700 hover:bg-green-500/20 dark:text-green-300"
          >
            {completeObjective.isPending ? (
              <><Loader2 className="size-3 animate-spin" /> Completing…</>
            ) : (
              "✓ Mark Complete"
            )}
          </Button>
        </div>
      )}

      {/* Archive button */}
      <div className="mb-3">
        <Button
          variant="ghost"
          size="sm"
          data-testid={`archive-objective-btn-${obj.id}`}
          onClick={() => archiveObjective.mutate({ id: obj.id })}
          disabled={archiveObjective.isPending}
          className="text-muted-foreground"
        >
          {archiveObjective.isPending ? (
            <><Loader2 className="size-3 animate-spin" /> Archiving…</>
          ) : (
            "Archive"
          )}
        </Button>
      </div>

      {/* Progress bar for PROGRESS_BAR mode */}
      {obj.trackingMode === "PROGRESS_BAR" && !obj.isCompleted && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {/* Sub-tasks */}
      {obj.trackingMode === "PROGRESS_BAR" && obj.subTasks.length > 0 && (
        <ul className="mb-3 space-y-1">
          {obj.subTasks.map((st) => (
            <li key={st.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={st.isCompleted} disabled />
              <span
                className={
                  st.isCompleted ? "text-muted-foreground line-through" : ""
                }
              >
                {st.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Counter-tools section — hidden for Side Quest objectives */}
      {obj.isDebuffed && !isSideQuest && (
        <div
          data-testid={`counter-tools-section-${obj.id}`}
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3"
        >
          <p className="mb-2 text-xs font-semibold text-destructive">Counter-tools</p>

          {/* Existing counter-tools */}
          {obj.counterTools.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {obj.counterTools.map((ct) => (
                <li key={ct.id} className="flex items-center gap-2">
                  {editingId === ct.id ? (
                    <>
                      <Input
                        data-testid={`counter-tool-edit-input-${ct.id}`}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditSave(ct.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 h-7 text-sm"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`counter-tool-save-${ct.id}`}
                        onClick={() => handleEditSave(ct.id)}
                        disabled={updateCounterTool.isPending}
                        className="text-green-700 dark:text-green-400"
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-destructive">→</span>
                      <span
                        data-testid={`counter-tool-name-${ct.id}`}
                        className="flex-1 text-sm"
                      >
                        {ct.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`counter-tool-edit-${ct.id}`}
                        onClick={() => {
                          setEditingId(ct.id);
                          setEditingName(ct.name);
                        }}
                        className="text-muted-foreground text-xs h-auto px-2 py-0.5"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`counter-tool-remove-${ct.id}`}
                        onClick={() => removeCounterTool.mutate({ id: ct.id })}
                        disabled={removeCounterTool.isPending}
                        className="text-destructive/60 hover:text-destructive text-xs h-auto px-2 py-0.5"
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add new counter-tool */}
          <form
            onSubmit={handleAddTool}
            className="flex gap-2"
            data-testid={`counter-tool-add-form-${obj.id}`}
          >
            <Input
              ref={newToolInputRef}
              data-testid={`counter-tool-new-input-${obj.id}`}
              value={newToolName}
              onChange={(e) => setNewToolName(e.target.value)}
              placeholder="Add a counter-tool…"
              className="flex-1 h-7 text-sm"
            />
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              data-testid={`counter-tool-add-btn-${obj.id}`}
              disabled={addCounterTool.isPending || !newToolName.trim()}
            >
              Add
            </Button>
          </form>
        </div>
      )}

      {/* Recruitable: invite link + collaborators */}
      {obj.isRecruitable && (
        <div
          data-testid={`collaborators-section-${obj.id}`}
          className="rounded-lg border border-border bg-muted/20 p-3"
        >
          <p className="mb-2 text-xs font-semibold text-foreground">Collaborators</p>

          {/* Collaborator list */}
          {collaborators && collaborators.length > 0 && (
            <ul className="mb-2 space-y-1">
              {collaborators.map((c) => (
                <li
                  key={c.id}
                  data-testid={`collaborator-item-${c.id}`}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span>•</span>
                  <span>{(c as { user?: { name?: string | null; email: string } }).user?.name ?? (c as { user?: { email: string } }).user?.email ?? "Party Member"}</span>
                  {c.contribution && (
                    <span className="text-muted-foreground/50">— {c.contribution}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Invite link generator */}
          {!inviteLink ? (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`generate-invite-btn-${obj.id}`}
              onClick={() => generateInvite.mutate({ objectiveId: obj.id })}
              disabled={generateInvite.isPending}
              className="text-xs h-auto px-2 py-0.5"
            >
              {generateInvite.isPending ? "Generating…" : "🔗 Generate invite link"}
            </Button>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Share this link:</p>
              <div className="flex items-center gap-2">
                <Input
                  data-testid={`invite-link-input-${obj.id}`}
                  value={inviteLink}
                  readOnly
                  className="flex-1 h-7 truncate text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`copy-invite-btn-${obj.id}`}
                  onClick={() => void navigator.clipboard.writeText(inviteLink)}
                  className="text-xs h-auto px-2 py-0.5"
                >
                  Copy
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInviteLink(null)}
                className="text-xs h-auto px-2 py-0.5 text-muted-foreground/50"
              >
                Reset
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectiveRow
// ---------------------------------------------------------------------------
function ObjectiveRow({
  obj,
  isSideQuest,
  chapters,
  autoExpand,
  onRefresh,
  onCompleted,
  onEditingChange,
}: {
  obj: Objective;
  isSideQuest: boolean;
  chapters: Chapter[];
  autoExpand?: boolean;
  onRefresh: () => void;
  onCompleted?: (objectiveName: string, difficulty: string) => void;
  onEditingChange?: (isEditing: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(autoExpand ?? false);

  // If the parent signals this objective should be focused after mount, expand it.
  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);

  return (
    <li>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger
          data-testid={`objective-row-${obj.id}`}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                obj.isCompleted ? "bg-green-400" : "bg-border"
              }`}
            />
            <span
              className={`truncate text-sm ${
                obj.isCompleted ? "text-muted-foreground line-through" : ""
              }`}
            >
              {obj.name}
            </span>
            {obj.isDebuffed && (
              <span className="shrink-0 text-xs text-destructive" title="Emotionally Charged">
                ⚡
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={DIFFICULTY_VARIANTS[obj.difficulty]}>
              {DIFFICULTY_LABELS[obj.difficulty]}
            </Badge>
            {expanded ? (
              <ChevronDown className="size-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1 px-3 pb-2">
            <ObjectiveDetail
              obj={obj}
              isSideQuest={isSideQuest}
              chapters={chapters}
              onRefresh={onRefresh}
              onCompleted={onCompleted}
              onEditingChange={onEditingChange}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

// ---------------------------------------------------------------------------
// ChapterSection
// ---------------------------------------------------------------------------
function ChapterSection({
  chapter,
  objectives,
  isSideQuest,
  chapters,
  focusObjectiveId,
  onRefresh,
  onCompleted,
  onEditingChange,
}: {
  chapter: Chapter;
  objectives: Objective[];
  isSideQuest: boolean;
  chapters: Chapter[];
  focusObjectiveId?: number | null;
  onRefresh: () => void;
  onCompleted?: (objectiveName: string, difficulty: string) => void;
  onEditingChange?: (isEditing: boolean) => void;
}) {
  const hasFocusedObjective =
    focusObjectiveId != null &&
    objectives.some((o) => o.id === focusObjectiveId);
  const [open, setOpen] = useState(hasFocusedObjective);

  useEffect(() => {
    if (hasFocusedObjective) setOpen(true);
  }, [hasFocusedObjective]);

  return (
    <div className="mb-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          data-testid={`chapter-toggle-${chapter.id}`}
          className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
        >
          {open ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          <span>{chapter.name}</span>
          <span className="text-muted-foreground/50">({objectives.length})</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-1 space-y-1">
            {objectives.map((obj) => (
              <ObjectiveRow
                key={obj.id}
                obj={obj}
                isSideQuest={isSideQuest}
                chapters={chapters}
                autoExpand={focusObjectiveId === obj.id}
                onRefresh={onRefresh}
                onCompleted={onCompleted}
                onEditingChange={onEditingChange}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArchivedObjectivesDisclosure
// ---------------------------------------------------------------------------
function ArchivedObjectivesDisclosure({
  questId,
  onRestored,
}: {
  questId: number;
  onRestored: () => void;
}) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const { data: archivedObjectives } = api.objective.listArchivedObjectives.useQuery(
    { questId },
  );

  const restoreObjective = api.objective.restoreObjective.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.objective.listArchivedObjectives.invalidate({ questId });
      onRestored();
    },
  });

  const deleteObjective = api.objective.deleteObjective.useMutation({
    onSuccess: () => {
      void utils.objective.listArchivedObjectives.invalidate({ questId });
    },
  });

  const count = archivedObjectives?.length ?? 0;
  if (count === 0) return null;

  return (
    <div
      data-testid={`archived-objectives-disclosure-${questId}`}
      className="mt-3 px-3 pt-3"
    >
      <Separator className="mb-3" />
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          data-testid={`archived-objectives-toggle-${questId}`}
          className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground"
        >
          {open ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          <span>{count} archived</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul
            data-testid={`archived-objectives-list-${questId}`}
            className="mt-2 space-y-1.5"
          >
            {archivedObjectives?.map((obj) => (
              <li
                key={obj.id}
                data-testid={`archived-objective-item-${obj.id}`}
                className="flex items-center justify-between gap-2 rounded border border-border/50 bg-muted/20 px-2 py-1.5"
              >
                <span className="truncate text-xs text-muted-foreground">{obj.name}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`restore-objective-btn-${obj.id}`}
                    onClick={() => restoreObjective.mutate({ id: obj.id })}
                    disabled={restoreObjective.isPending}
                    className="h-auto px-2 py-0.5 text-xs"
                  >
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`delete-archived-objective-btn-${obj.id}`}
                    onClick={() => deleteObjective.mutate({ id: obj.id })}
                    disabled={deleteObjective.isPending}
                    className="h-auto px-2 py-0.5 text-xs text-destructive/60 hover:text-destructive"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickAddObjectiveForm
// ---------------------------------------------------------------------------
function QuickAddObjectiveForm({
  questId,
  onAdded,
}: {
  questId: number;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "LEGENDARY">("MEDIUM");
  const utils = api.useUtils();

  const createObjective = api.objective.createObjective.useMutation({
    onSuccess: () => {
      setName("");
      setDifficulty("MEDIUM");
      void utils.quest.listActiveQuests.invalidate();
      onAdded();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createObjective.mutate({ questId, name: trimmed, difficulty });
  }

  return (
    <form
      data-testid={`quick-add-objective-form-${questId}`}
      onSubmit={handleSubmit}
      className="mt-3 flex items-center gap-2 px-3 pt-3"
    >
      <Separator className="hidden" />
      <Input
        data-testid={`quick-add-objective-name-${questId}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Quick-add an objective…"
        maxLength={255}
        className="flex-1 h-8 text-sm"
      />
      <Select
        value={difficulty}
        onValueChange={(value) => setDifficulty(value as typeof difficulty)}
      >
        <SelectTrigger
          data-testid={`quick-add-objective-difficulty-${questId}`}
          className="w-auto"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="EASY">Easy</SelectItem>
          <SelectItem value="MEDIUM">Medium</SelectItem>
          <SelectItem value="HARD">Hard</SelectItem>
          <SelectItem value="LEGENDARY">Legendary</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        data-testid={`quick-add-objective-submit-${questId}`}
        disabled={createObjective.isPending || !name.trim()}
      >
        {createObjective.isPending ? <Loader2 className="size-3 animate-spin" /> : "Add"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// QuestCard
// ---------------------------------------------------------------------------
export function QuestCard({
  quest,
  focusObjectiveId,
  onObjectiveCompleted,
  onUnsavedEditsChange,
  alwaysExpanded = false,
}: {
  quest: Quest;
  focusObjectiveId?: number | null;
  onObjectiveCompleted?: (objectiveName: string, difficulty: string) => void;
  onUnsavedEditsChange?: (hasEdits: boolean) => void;
  alwaysExpanded?: boolean;
}) {
  // Auto-expand the card when one of its objectives is focused via suggestion
  const hasFocusedObjective =
    focusObjectiveId != null &&
    quest.objectives.some((o) => o.id === focusObjectiveId);

  const [expanded, setExpanded] = useState(alwaysExpanded || hasFocusedObjective);

  useEffect(() => {
    if (hasFocusedObjective) setExpanded(true);
  }, [hasFocusedObjective]);

  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddObjectivesChat, setShowAddObjectivesChat] = useState(false);

  function handleEditingChange(isEditing: boolean) {
    onUnsavedEditsChange?.(isEditing);
  }

  const utils = api.useUtils();
  const handleRefresh = () => {
    void utils.quest.listActiveQuests.invalidate();
    void utils.suggestion.getSuggestions.invalidate();
  };

  const archiveQuest = api.quest.archiveQuest.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
    },
  });

  const pct = progressPercent(quest.objectives);

  // Separate objectives by chapter membership
  const topLevelObjectives = quest.objectives.filter(
    (o) => o.chapterId === null,
  );

  return (
    <Card
      data-testid={`quest-card-${quest.id}`}
      className="overflow-visible"
    >
      <Collapsible open={alwaysExpanded ? true : expanded} onOpenChange={alwaysExpanded ? undefined : setExpanded}>
        {/* Quest region header */}
        <CollapsibleTrigger
          data-testid={alwaysExpanded ? undefined : `quest-region-${quest.id}`}
          disabled={alwaysExpanded}
          className="flex w-full items-start justify-between gap-3 p-4 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {quest.isSideQuest && (
                <Badge variant="secondary">Side Quest</Badge>
              )}
              <h3 className="truncate font-bold">{quest.name}</h3>
            </div>
            {quest.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {quest.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-sm font-semibold text-muted-foreground">{pct}%</span>
            {!alwaysExpanded && (
              expanded ? (
                <ChevronDown className="size-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3 text-muted-foreground" />
              )
            )}
          </div>
        </CollapsibleTrigger>

        {/* Edit and Archive buttons — shown when expanded */}
        {expanded && !showEditForm && (
          <div className="flex items-center gap-2 px-4 pb-1">
            <Button
              variant="ghost"
              size="sm"
              data-testid={`quest-edit-btn-${quest.id}`}
              onClick={() => setShowEditForm(true)}
              className="h-auto px-2 py-0.5 text-xs text-muted-foreground"
            >
              Edit quest
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-testid={`quest-archive-btn-${quest.id}`}
              onClick={() => archiveQuest.mutate({ id: quest.id })}
              disabled={archiveQuest.isPending}
              className="h-auto px-2 py-0.5 text-xs text-muted-foreground"
            >
              {archiveQuest.isPending ? (
                <><Loader2 className="size-3 animate-spin" /> Archiving…</>
              ) : (
                "🗄️ Archive quest"
              )}
            </Button>
          </div>
        )}

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <Progress value={pct} className="w-full" />
          <p className="mt-1 text-xs text-muted-foreground">
            {quest.objectives.filter((o) => o.isCompleted).length} /{" "}
            {quest.objectives.length} objectives complete
          </p>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="border-t border-border px-2 py-3">
            {/* Chapters */}
            {quest.chapters.map((ch) => {
              const chObjs = quest.objectives.filter(
                (o) => o.chapterId === ch.id,
              );
              return (
                <ChapterSection
                  key={ch.id}
                  chapter={ch}
                  objectives={chObjs}
                  isSideQuest={quest.isSideQuest}
                  chapters={quest.chapters}
                  focusObjectiveId={focusObjectiveId}
                  onRefresh={handleRefresh}
                  onCompleted={onObjectiveCompleted}
                  onEditingChange={handleEditingChange}
                />
              );
            })}
            {topLevelObjectives.length > 0 && (
              <ul className="space-y-1">
                {topLevelObjectives.map((obj) => (
                  <ObjectiveRow
                    key={obj.id}
                    obj={obj}
                    isSideQuest={quest.isSideQuest}
                    chapters={quest.chapters}
                    autoExpand={focusObjectiveId === obj.id}
                    onRefresh={handleRefresh}
                    onCompleted={onObjectiveCompleted}
                    onEditingChange={handleEditingChange}
                  />
                ))}
              </ul>
            )}

            {quest.objectives.length === 0 && !showAddObjectivesChat && (
              <div className="px-3 py-4 text-center">
                <p className="mb-3 text-xs text-muted-foreground">No objectives yet.</p>
                <Button
                  variant="outline"
                  data-testid={`add-objectives-cta-${quest.id}`}
                  onClick={() => setShowAddObjectivesChat(true)}
                >
                  ✨ Add objectives
                </Button>
              </div>
            )}

            {quest.objectives.length > 0 && !showAddObjectivesChat && (
              <div className="mt-2 px-3">
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`add-more-objectives-link-${quest.id}`}
                  onClick={() => setShowAddObjectivesChat(true)}
                  className="h-auto px-2 py-0.5 text-xs text-muted-foreground"
                >
                  + Add more objectives
                </Button>
              </div>
            )}

            {!showAddObjectivesChat && (
              <ArchivedObjectivesDisclosure questId={quest.id} onRestored={handleRefresh} />
            )}

            {!showAddObjectivesChat && (
              <QuickAddObjectiveForm questId={quest.id} onAdded={handleRefresh} />
            )}

            {showAddObjectivesChat && (
              <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
                <QuestBuilderChat
                  mode="add-objectives"
                  questId={quest.id}
                  questName={quest.name}
                  existingObjectiveNames={quest.objectives.map((o) => o.name)}
                  onSuccess={() => {
                    setShowAddObjectivesChat(false);
                    handleRefresh();
                  }}
                  onCancel={() => setShowAddObjectivesChat(false)}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Edit quest form */}
      {showEditForm && (
        <EditQuestForm
          questId={quest.id}
          initialName={quest.name}
          initialDescription={quest.description}
          initialIsSideQuest={quest.isSideQuest}
          onSuccess={() => setShowEditForm(false)}
          onCancel={() => setShowEditForm(false)}
        />
      )}
    </Card>
  );
}
