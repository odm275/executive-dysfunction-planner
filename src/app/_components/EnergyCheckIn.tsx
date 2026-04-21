"use client";

import { api } from "~/trpc/react";

type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

interface EnergyOption {
  value: EnergyLevel;
  label: string;
  description: string;
  color: string;
  hoverColor: string;
}

const ENERGY_OPTIONS: EnergyOption[] = [
  {
    value: "LOW",
    label: "Low",
    description: "Gentle tasks only",
    color: "bg-blue-900/40 border-blue-700/50",
    hoverColor: "hover:bg-blue-800/60 hover:border-blue-500",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    description: "Steady and capable",
    color: "bg-purple-900/40 border-purple-700/50",
    hoverColor: "hover:bg-purple-800/60 hover:border-purple-500",
  },
  {
    value: "HIGH",
    label: "High",
    description: "Ready for anything",
    color: "bg-amber-900/40 border-amber-700/50",
    hoverColor: "hover:bg-amber-800/60 hover:border-amber-500",
  },
];

interface EnergyCheckInProps {
  onComplete: () => void;
}

export function EnergyCheckIn({ onComplete }: EnergyCheckInProps) {
  const utils = api.useUtils();
  const setEnergy = api.energy.setEnergy.useMutation({
    onSuccess: async () => {
      await utils.energy.getTodayEnergy.invalidate();
      onComplete();
    },
  });

  function handleSelect(value: EnergyLevel) {
    setEnergy.mutate({ value });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            How&apos;s your energy today?
          </h1>
        </div>

        <div className="flex flex-col gap-4">
          {ENERGY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              disabled={setEnergy.isPending}
              aria-label={option.label}
              className={`flex items-center justify-between rounded-xl border px-6 py-4 text-left transition-all disabled:opacity-50 ${option.color} ${option.hoverColor}`}
            >
              <div>
                <div className="text-lg font-semibold text-white">
                  {option.label}
                </div>
                <div className="text-sm text-white/60">{option.description}</div>
              </div>
              {setEnergy.isPending && setEnergy.variables?.value === option.value && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
