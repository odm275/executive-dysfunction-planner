"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { EditQuestForm } from "~/app/_components/EditQuestForm";
import { QuestBuilderChat } from "~/app/_components/QuestBuilderChat";

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

const DIFFICULTY_COLOURS: Record<Objective["difficulty"], string> = {
  EASY: "bg-green-500/20 text-green-300 border border-green-500/30",
  MEDIUM: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  HARD: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  LEGENDARY: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
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
  onRefresh,
  onCompleted,
}: {
  obj: Objective;
  isSideQuest: boolean;
  onRefresh: () => void;
  onCompleted?: (objectiveName: string, difficulty: string) => void;
}) {
  const progress = objectiveProgress(obj);
  const utils = api.useUtils();

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

  // Debuff toggle
  const updateObjective = api.objective.updateObjective.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onRefresh();
    },
  });

  // Complete objective
  const completeObjective = api.objective.completeObjective.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onRefresh();
      onCompleted?.(obj.name, obj.difficulty);
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
      className="rounded-lg border border-white/10 bg-white/5 p-4"
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="font-semibold text-white/90">{obj.name}</span>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLOURS[obj.difficulty]}`}
        >
          {DIFFICULTY_LABELS[obj.difficulty]}
        </span>
      </div>

      {/* Attributes row */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-white/50">
        <span>Mode: {obj.trackingMode === "BINARY" ? "Binary" : "Progress Bar"}</span>
        {obj.isRecruitable && (
          <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-cyan-300">
            Recruitable
          </span>
        )}
        {obj.isDebuffed && (
          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-300">
            ⚡ Emotionally Charged
          </span>
        )}
        {obj.isCompleted && (
          <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-green-300">
            ✓ Complete
          </span>
        )}
      </div>

      {/* Debuff toggle — hidden for Side Quest objectives */}
      {!obj.isCompleted && !isSideQuest && (
        <div className="mb-3">
          <button
            data-testid={`debuff-toggle-${obj.id}`}
            onClick={handleToggleDebuff}
            disabled={updateObjective.isPending}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              obj.isDebuffed
                ? "border border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                : "border border-white/20 bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {obj.isDebuffed ? "⚡ Emotionally Charged — Remove tag" : "Tag as Emotionally Charged"}
          </button>
        </div>
      )}

      {/* Complete button */}
      {!obj.isCompleted && (
        <div className="mb-3">
          <button
            data-testid={`complete-objective-btn-${obj.id}`}
            onClick={() => completeObjective.mutate({ id: obj.id })}
            disabled={completeObjective.isPending}
            className="rounded border border-green-500/40 bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-40"
          >
            {completeObjective.isPending ? "Completing…" : "✓ Mark Complete"}
          </button>
        </div>
      )}

      {/* Progress bar for PROGRESS_BAR mode */}
      {obj.trackingMode === "PROGRESS_BAR" && !obj.isCompleted && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-white/40">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[hsl(280,100%,70%)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Sub-tasks */}
      {obj.trackingMode === "PROGRESS_BAR" && obj.subTasks.length > 0 && (
        <ul className="mb-3 space-y-1">
          {obj.subTasks.map((st) => (
            <li key={st.id} className="flex items-center gap-2 text-sm">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  st.isCompleted
                    ? "border-green-500 bg-green-500/30 text-green-300"
                    : "border-white/20"
                }`}
              >
                {st.isCompleted && "✓"}
              </span>
              <span
                className={
                  st.isCompleted ? "text-white/40 line-through" : "text-white/70"
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
          className="rounded-lg border border-red-500/20 bg-red-500/10 p-3"
        >
          <p className="mb-2 text-xs font-semibold text-red-300">Counter-tools</p>

          {/* Existing counter-tools */}
          {obj.counterTools.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {obj.counterTools.map((ct) => (
                <li key={ct.id} className="flex items-center gap-2">
                  {editingId === ct.id ? (
                    <>
                      <input
                        data-testid={`counter-tool-edit-input-${ct.id}`}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditSave(ct.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 rounded border border-white/20 bg-white/10 px-2 py-0.5 text-sm text-white/90 outline-none focus:border-white/40"
                        autoFocus
                      />
                      <button
                        data-testid={`counter-tool-save-${ct.id}`}
                        onClick={() => handleEditSave(ct.id)}
                        disabled={updateCounterTool.isPending}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-white/30 hover:text-white/60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-red-400">→</span>
                      <span
                        data-testid={`counter-tool-name-${ct.id}`}
                        className="flex-1 text-sm text-white/70"
                      >
                        {ct.name}
                      </span>
                      <button
                        data-testid={`counter-tool-edit-${ct.id}`}
                        onClick={() => {
                          setEditingId(ct.id);
                          setEditingName(ct.name);
                        }}
                        className="text-xs text-white/30 hover:text-white/60"
                      >
                        Edit
                      </button>
                      <button
                        data-testid={`counter-tool-remove-${ct.id}`}
                        onClick={() =>
                          removeCounterTool.mutate({ id: ct.id })
                        }
                        disabled={removeCounterTool.isPending}
                        className="text-xs text-red-400/60 hover:text-red-400"
                      >
                        Remove
                      </button>
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
            <input
              ref={newToolInputRef}
              data-testid={`counter-tool-new-input-${obj.id}`}
              value={newToolName}
              onChange={(e) => setNewToolName(e.target.value)}
              placeholder="Add a counter-tool…"
              className="flex-1 rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-white/90 placeholder-white/30 outline-none focus:border-red-500/40"
            />
            <button
              type="submit"
              data-testid={`counter-tool-add-btn-${obj.id}`}
              disabled={addCounterTool.isPending || !newToolName.trim()}
              className="rounded border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      )}

      {/* Recruitable: invite link + collaborators */}
      {obj.isRecruitable && (
        <div
          data-testid={`collaborators-section-${obj.id}`}
          className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3"
        >
          <p className="mb-2 text-xs font-semibold text-cyan-300">Collaborators</p>

          {/* Collaborator list */}
          {collaborators && collaborators.length > 0 && (
            <ul className="mb-2 space-y-1">
              {collaborators.map((c) => (
                <li
                  key={c.id}
                  data-testid={`collaborator-item-${c.id}`}
                  className="flex items-center gap-2 text-xs text-white/60"
                >
                  <span className="text-cyan-400">•</span>
                  <span>{(c as { user?: { name?: string | null; email: string } }).user?.name ?? (c as { user?: { email: string } }).user?.email ?? "Party Member"}</span>
                  {c.contribution && (
                    <span className="text-white/30">— {c.contribution}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Invite link generator */}
          {!inviteLink ? (
            <button
              data-testid={`generate-invite-btn-${obj.id}`}
              onClick={() => generateInvite.mutate({ objectiveId: obj.id })}
              disabled={generateInvite.isPending}
              className="text-xs text-cyan-400/70 hover:text-cyan-400"
            >
              {generateInvite.isPending ? "Generating…" : "🔗 Generate invite link"}
            </button>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-white/40">Share this link:</p>
              <div className="flex items-center gap-2">
                <input
                  data-testid={`invite-link-input-${obj.id}`}
                  value={inviteLink}
                  readOnly
                  className="flex-1 truncate rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/60"
                />
                <button
                  data-testid={`copy-invite-btn-${obj.id}`}
                  onClick={() => void navigator.clipboard.writeText(inviteLink)}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Copy
                </button>
              </div>
              <button
                onClick={() => setInviteLink(null)}
                className="text-xs text-white/20 hover:text-white/40"
              >
                Reset
              </button>
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
  autoExpand,
  onRefresh,
  onCompleted,
}: {
  obj: Objective;
  isSideQuest: boolean;
  autoExpand?: boolean;
  onRefresh: () => void;
  onCompleted?: (objectiveName: string, difficulty: string) => void;
}) {
  const [expanded, setExpanded] = useState(autoExpand ?? false);

  // If the parent signals this objective should be focused after mount, expand it.
  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);

  return (
    <li>
      <button
        data-testid={`objective-row-${obj.id}`}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/5"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              obj.isCompleted ? "bg-green-400" : "bg-white/20"
            }`}
          />
          <span
            className={`truncate text-sm ${
              obj.isCompleted ? "text-white/40 line-through" : "text-white/80"
            }`}
          >
            {obj.name}
          </span>
          {obj.isDebuffed && (
            <span className="shrink-0 text-xs text-red-400" title="Emotionally Charged">
              ⚡
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${DIFFICULTY_COLOURS[obj.difficulty]}`}
          >
            {DIFFICULTY_LABELS[obj.difficulty]}
          </span>
          <span className="text-xs text-white/30">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {expanded && (
        <div className="mt-1 px-3 pb-2">
          <ObjectiveDetail obj={obj} isSideQuest={isSideQuest} onRefresh={onRefresh} onCompleted={onCompleted} />
        </div>
      )}
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
  focusObjectiveId,
  onRefresh,
  onCompleted,
}: {
  chapter: Chapter;
  objectives: Objective[];
  isSideQuest: boolean;
  focusObjectiveId?: number | null;
  onRefresh: () => void;
  onCompleted?: (objectiveName: string, difficulty: string) => void;
}) {
  const hasFocusedObjective =
    focusObjectiveId != null &&
    objectives.some((o) => o.id === focusObjectiveId);
  const [collapsed, setCollapsed] = useState(!hasFocusedObjective);

  useEffect(() => {
    if (hasFocusedObjective) setCollapsed(false);
  }, [hasFocusedObjective]);

  return (
    <div className="mb-2">
      <button
        data-testid={`chapter-toggle-${chapter.id}`}
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-white/40 hover:bg-white/5"
        aria-expanded={!collapsed}
      >
        <span>{collapsed ? "▶" : "▼"}</span>
        <span>{chapter.name}</span>
        <span className="text-white/25">({objectives.length})</span>
      </button>
      {!collapsed && (
        <ul className="mt-1 space-y-1">
          {objectives.map((obj) => (
            <ObjectiveRow
              key={obj.id}
              obj={obj}
              isSideQuest={isSideQuest}
              autoExpand={focusObjectiveId === obj.id}
              onRefresh={onRefresh}
              onCompleted={onCompleted}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestCard
// ---------------------------------------------------------------------------
export function QuestCard({
  quest,
  focusObjectiveId,
  onObjectiveCompleted,
  alwaysExpanded = false,
}: {
  quest: Quest;
  focusObjectiveId?: number | null;
  onObjectiveCompleted?: (objectiveName: string, difficulty: string) => void;
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

  const utils = api.useUtils();
  const handleRefresh = () => {
    void utils.quest.listActiveQuests.invalidate();
    void utils.suggestion.getSuggestions.invalidate();
  };

  const pct = progressPercent(quest.objectives);

  // Separate objectives by chapter membership
  const topLevelObjectives = quest.objectives.filter(
    (o) => o.chapterId === null,
  );

  return (
    <div
      data-testid={`quest-card-${quest.id}`}
      className={`rounded-xl border transition-all ${
        quest.isSideQuest
          ? "border-cyan-500/30 bg-gradient-to-br from-cyan-900/30 to-[#0a0d1a]"
          : "border-white/10 bg-white/5"
      }`}
    >
      {/* Quest region header — tap to expand (not shown when alwaysExpanded inside drawer) */}
      <button
        data-testid={alwaysExpanded ? undefined : `quest-region-${quest.id}`}
        onClick={alwaysExpanded ? undefined : () => setExpanded((v) => !v)}
        className={`flex w-full items-start justify-between gap-3 p-4 text-left${
          alwaysExpanded ? " cursor-default" : ""
        }`}
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {quest.isSideQuest && (
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-xs font-medium text-cyan-300">
                Side Quest
              </span>
            )}
            <h3 className="truncate font-bold text-white">{quest.name}</h3>
          </div>
          {quest.description && (
            <p className="mt-0.5 truncate text-xs text-white/40">
              {quest.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold text-white/70">{pct}%</span>
          {!alwaysExpanded && (
            <span className="text-xs text-white/30">{expanded ? "▲" : "▼"}</span>
          )}
        </div>
      </button>

      {/* Edit button — shown when expanded */}
      {expanded && !showEditForm && (
        <div className="px-4 pb-1">
          <button
            data-testid={`quest-edit-btn-${quest.id}`}
            onClick={() => setShowEditForm(true)}
            className="text-xs text-white/30 hover:text-white/60"
          >
            Edit quest
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${
              quest.isSideQuest ? "bg-cyan-400" : "bg-[hsl(280,100%,70%)]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-white/30">
          {quest.objectives.filter((o) => o.isCompleted).length} /{" "}
          {quest.objectives.length} objectives complete
        </p>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/10 px-2 py-3">
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
                focusObjectiveId={focusObjectiveId}
                onRefresh={handleRefresh}
                onCompleted={onObjectiveCompleted}
              />
            );
          })}

          {/* Top-level objectives (no chapter) */}
          {topLevelObjectives.length > 0 && (
            <ul className="space-y-1">
              {topLevelObjectives.map((obj) => (
                <ObjectiveRow
                  key={obj.id}
                  obj={obj}
                  isSideQuest={quest.isSideQuest}
                  autoExpand={focusObjectiveId === obj.id}
                  onRefresh={handleRefresh}
                  onCompleted={onObjectiveCompleted}
                />
              ))}
            </ul>
          )}

          {quest.objectives.length === 0 && !showAddObjectivesChat && (
            <div className="px-3 py-4 text-center">
              <p className="mb-3 text-xs text-white/30">No objectives yet.</p>
              <button
                data-testid={`add-objectives-cta-${quest.id}`}
                onClick={() => setShowAddObjectivesChat(true)}
                className="rounded-lg border border-[hsl(280,100%,70%)]/30 bg-[hsl(280,100%,70%)]/10 px-4 py-2 text-sm font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/20"
              >
                ✨ Add objectives
              </button>
            </div>
          )}

          {quest.objectives.length > 0 && !showAddObjectivesChat && (
            <div className="mt-2 px-3">
              <button
                data-testid={`add-more-objectives-link-${quest.id}`}
                onClick={() => setShowAddObjectivesChat(true)}
                className="text-xs text-white/30 hover:text-white/60"
              >
                + Add more objectives
              </button>
            </div>
          )}

          {showAddObjectivesChat && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
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
      )}

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
    </div>
  );
}
