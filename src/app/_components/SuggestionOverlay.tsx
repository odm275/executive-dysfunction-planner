"use client";

type Difficulty = "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";

type CounterTool = {
  id: number;
  name: string;
};

type SuggestionObjective = {
  id: number;
  questId: number;
  questName: string;
  isSideQuest: boolean;
  name: string;
  difficulty: Difficulty;
  isDebuffed: boolean;
  isCompleted: boolean;
  counterTools: CounterTool[];
};

type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  LEGENDARY: "Legendary",
};

const DIFFICULTY_COLOURS: Record<Difficulty, string> = {
  EASY: "bg-green-500/20 text-green-300 border border-green-500/30",
  MEDIUM: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  HARD: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  LEGENDARY: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
};

const ENERGY_LABELS: Record<EnergyLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

function SuggestionCard({
  suggestion,
  onClick,
}: {
  suggestion: SuggestionObjective;
  onClick: (objectiveId: number, questId: number) => void;
}) {
  return (
    <button
      data-testid={`suggestion-card-${suggestion.id}`}
      onClick={() => onClick(suggestion.id, suggestion.questId)}
      className="w-full rounded-lg border border-[hsl(280,100%,70%)]/20 bg-white/5 p-3 text-left transition hover:border-[hsl(280,100%,70%)]/40 hover:bg-white/10"
    >
      {/* Top row: name + difficulty badge */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-white/90">
          {suggestion.name}
        </span>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLOURS[suggestion.difficulty]}`}
        >
          {DIFFICULTY_LABELS[suggestion.difficulty]}
        </span>
      </div>

      {/* Quest name */}
      <p className="mt-0.5 text-xs text-white/40">
        {suggestion.isSideQuest && (
          <span className="mr-1 text-cyan-400">Side Quest •</span>
        )}
        {suggestion.questName}
      </p>

      {/* Debuff indicator */}
      {suggestion.isDebuffed && (
        <p className="mt-1 text-xs text-red-400">⚡ Emotionally Charged</p>
      )}

      {/* Counter-tools for debuffed objectives */}
      {suggestion.isDebuffed && suggestion.counterTools.length > 0 && (
        <ul className="mt-2 space-y-1 rounded border border-red-500/20 bg-red-500/10 p-2">
          {suggestion.counterTools.map((ct) => (
            <li key={ct.id} className="flex items-center gap-1.5 text-xs text-white/70">
              <span className="text-red-400">→</span>
              {ct.name}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

export function SuggestionOverlay({
  energy,
  suggestions,
  isLoading,
  onSelectObjective,
}: {
  energy: EnergyLevel;
  suggestions: SuggestionObjective[];
  isLoading: boolean;
  onSelectObjective: (objectiveId: number, questId: number) => void;
}) {
  return (
    <div
      data-testid="suggestion-overlay"
      className="mb-6 rounded-xl border border-[hsl(280,100%,70%)]/20 bg-[hsl(280,100%,70%)]/5 px-4 py-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(280,100%,70%)]/70">
          Suggestions for {ENERGY_LABELS[energy]} energy
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-white/60" />
          <span className="text-sm text-white/30">Finding suggestions…</span>
        </div>
      ) : suggestions.length === 0 ? (
        <p className="py-2 text-sm text-white/30">
          No suggestions right now — all objectives for your energy level are
          complete. 🎉
        </p>
      ) : (
        <div className="space-y-2" data-testid="suggestion-cards">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} onClick={onSelectObjective} />
          ))}
        </div>
      )}

      {/* Release valve — always visible */}
      <p
        data-testid="world-map-release-valve"
        className="mt-3 border-t border-white/10 pt-3 text-xs text-white/30"
      >
        Or,{" "}
        <span className="text-cyan-400/70">
          you could work on your World Map instead
        </span>{" "}
        — browse your Side Quests below.
      </p>
    </div>
  );
}
