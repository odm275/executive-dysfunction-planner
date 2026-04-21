"use client";

import { useState } from "react";

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
function ObjectiveDetail({ obj }: { obj: Objective }) {
  const progress = objectiveProgress(obj);

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

      {/* Counter-tools for debuffed objectives */}
      {obj.isDebuffed && obj.counterTools.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="mb-1.5 text-xs font-semibold text-red-300">
            Counter-tools
          </p>
          <ul className="space-y-1">
            {obj.counterTools.map((ct) => (
              <li key={ct.id} className="flex items-center gap-2 text-sm text-white/70">
                <span className="text-red-400">→</span>
                {ct.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectiveRow
// ---------------------------------------------------------------------------
function ObjectiveRow({ obj }: { obj: Objective }) {
  const [expanded, setExpanded] = useState(false);

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
          <ObjectiveDetail obj={obj} />
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
}: {
  chapter: Chapter;
  objectives: Objective[];
}) {
  const [collapsed, setCollapsed] = useState(true);

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
            <ObjectiveRow key={obj.id} obj={obj} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestCard
// ---------------------------------------------------------------------------
export function QuestCard({ quest }: { quest: Quest }) {
  const [expanded, setExpanded] = useState(false);
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
      {/* Quest region header — tap to expand */}
      <button
        data-testid={`quest-region-${quest.id}`}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
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
          <span className="text-xs text-white/30">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

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
              <ChapterSection key={ch.id} chapter={ch} objectives={chObjs} />
            );
          })}

          {/* Top-level objectives (no chapter) */}
          {topLevelObjectives.length > 0 && (
            <ul className="space-y-1">
              {topLevelObjectives.map((obj) => (
                <ObjectiveRow key={obj.id} obj={obj} />
              ))}
            </ul>
          )}

          {quest.objectives.length === 0 && (
            <p className="px-3 py-2 text-xs text-white/30">
              No objectives yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
