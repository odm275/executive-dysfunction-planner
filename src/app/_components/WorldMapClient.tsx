"use client";

import { useState } from "react";
import { EnergyCheckIn } from "~/app/_components/EnergyCheckIn";
import { QuestCard } from "~/app/_components/QuestCard";
import { UpdateEnergyButton } from "~/app/_components/UpdateEnergyButton";
import { api } from "~/trpc/react";

type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

const MAX_ACTIVE_QUESTS = 6;

export function WorldMapClient() {
  const { data: todayEnergy, isLoading: energyLoading } =
    api.energy.getTodayEnergy.useQuery();
  const { data: quests, isLoading: questsLoading } =
    api.quest.listActiveQuests.useQuery();
  const [justSet, setJustSet] = useState(false);

  // Only block render on energy loading — quests load inside the map
  if (energyLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1a0533] to-[#0a0d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  // Show energy check-in if not yet set today
  if (!todayEnergy && !justSet) {
    return <EnergyCheckIn onComplete={() => setJustSet(true)} />;
  }

  const energy = (todayEnergy?.value ?? "MEDIUM") as EnergyLevel;
  const activeQuests = quests ?? [];
  const slotsRemaining = MAX_ACTIVE_QUESTS - activeQuests.length;

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">
          Executive Dysfunction{" "}
          <span className="text-[hsl(280,100%,70%)]">Planner</span>
        </h1>
        <UpdateEnergyButton currentEnergy={energy} />
      </header>

      {/* World Map content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* Page title + slot counter */}
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl font-extrabold">Your World Map</h2>
          <span className="text-sm text-white/40" data-testid="slots-remaining">
            {slotsRemaining > 0
              ? `${slotsRemaining} quest slot${slotsRemaining !== 1 ? "s" : ""} remaining`
              : "Quest limit reached"}
          </span>
        </div>

        {/* Energy badge */}
        <p className="mb-6 text-sm text-white/50">
          Energy today:{" "}
          <span className="font-semibold text-white">{energy}</span>
        </p>

        {/* Suggestion overlay placeholder */}
        <div
          data-testid="suggestion-overlay"
          className="mb-6 rounded-xl border border-dashed border-[hsl(280,100%,70%)]/30 bg-[hsl(280,100%,70%)]/5 px-4 py-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(280,100%,70%)]/60">
            Suggestions
          </p>
          <p className="mt-1 text-sm text-white/30">
            Powered-up suggestions coming in the next slice.
          </p>
        </div>

        {/* Quest regions */}
        {questsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : activeQuests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-lg font-semibold text-white/50">
              No active quests yet.
            </p>
            <p className="max-w-xs text-sm text-white/30">
              Your adventure awaits — add your first quest to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="quest-list">
            {activeQuests.map((q) => (
              <QuestCard key={q.id} quest={q} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
