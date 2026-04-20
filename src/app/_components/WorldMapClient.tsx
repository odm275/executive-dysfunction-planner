"use client";

import { useState } from "react";
import { EnergyCheckIn } from "~/app/_components/EnergyCheckIn";
import { UpdateEnergyButton } from "~/app/_components/UpdateEnergyButton";
import { api } from "~/trpc/react";

type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

export function WorldMapClient() {
  const { data: todayEnergy, isLoading } = api.energy.getTodayEnergy.useQuery();
  const [justSet, setJustSet] = useState(false);

  if (isLoading) {
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

      {/* World Map placeholder */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold">Your World Map</h2>
          <p className="text-white/50">
            Energy: <span className="font-semibold text-white">{energy}</span>
          </p>
        </div>
        <p className="max-w-sm text-sm text-white/40">
          Quest regions coming soon — Quest Engine is being forged.
        </p>
      </div>
    </main>
  );
}
