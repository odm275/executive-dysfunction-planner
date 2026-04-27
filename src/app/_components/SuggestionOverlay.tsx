"use client";

import { Loader2 } from "lucide-react";
import { Badge, type badgeVariants } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import type { VariantProps } from "class-variance-authority";

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

const DIFFICULTY_VARIANTS: Record<
  Difficulty,
  VariantProps<typeof badgeVariants>["variant"]
> = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
  LEGENDARY: "legendary",
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
    <Button
      variant="outline"
      data-testid={`suggestion-card-${suggestion.id}`}
      onClick={() => onClick(suggestion.id, suggestion.questId)}
      className="h-auto w-full flex-col items-start gap-1 px-3 py-3 text-left"
    >
      {/* Top row: name + difficulty badge */}
      <div className="flex w-full items-start justify-between gap-2">
        <span className="text-sm font-semibold">{suggestion.name}</span>
        <Badge variant={DIFFICULTY_VARIANTS[suggestion.difficulty]}>
          {DIFFICULTY_LABELS[suggestion.difficulty]}
        </Badge>
      </div>

      {/* Quest name */}
      <p className="text-xs text-muted-foreground">
        {suggestion.isSideQuest && (
          <span className="mr-1 text-primary">Side Quest •</span>
        )}
        {suggestion.questName}
      </p>

      {/* Debuff indicator */}
      {suggestion.isDebuffed && (
        <p className="text-xs text-destructive">⚡ Emotionally Charged</p>
      )}

      {/* Counter-tools for debuffed objectives */}
      {suggestion.isDebuffed && suggestion.counterTools.length > 0 && (
        <ul className="mt-1 w-full space-y-1 rounded border border-destructive/20 bg-destructive/5 p-2">
          {suggestion.counterTools.map((ct) => (
            <li key={ct.id} className="flex items-center gap-1.5 text-xs">
              <span className="text-destructive">→</span>
              {ct.name}
            </li>
          ))}
        </ul>
      )}
    </Button>
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
    <Card
      data-testid="suggestion-overlay"
      className="mb-6 px-4 py-3"
    >
      <CardContent className="p-0">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggestions for {ENERGY_LABELS[energy]} energy
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Finding suggestions…</span>
          </div>
        ) : suggestions.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
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

        <p
          data-testid="world-map-release-valve"
          className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground"
        >
          Or,{" "}
          <span className="text-primary/70">
            you could work on your World Map instead
          </span>{" "}
          — browse your Side Quests below.
        </p>
      </CardContent>
    </Card>
  );
}
