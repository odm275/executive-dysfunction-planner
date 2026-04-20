"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

const ENERGY_LABELS: Record<EnergyLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

interface UpdateEnergyButtonProps {
  currentEnergy: EnergyLevel;
}

export function UpdateEnergyButton({ currentEnergy }: UpdateEnergyButtonProps) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const setEnergy = api.energy.setEnergy.useMutation({
    onSuccess: async () => {
      await utils.energy.getTodayEnergy.invalidate();
      setOpen(false);
    },
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/20"
        aria-label="Update energy level"
      >
        <span>Energy: {ENERGY_LABELS[currentEnergy]}</span>
        <span className="text-white/40">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#1a0533] shadow-xl">
          {(["LOW", "MEDIUM", "HIGH"] as EnergyLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => setEnergy.mutate({ value: level })}
              disabled={setEnergy.isPending}
              className={`w-full px-4 py-3 text-left text-sm transition hover:bg-white/10 disabled:opacity-50 ${
                level === currentEnergy
                  ? "font-semibold text-white"
                  : "text-white/70"
              }`}
            >
              {ENERGY_LABELS[level]}
              {level === currentEnergy && (
                <span className="ml-2 text-purple-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
