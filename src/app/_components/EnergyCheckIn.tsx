"use client";

import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

interface EnergyOption {
  value: EnergyLevel;
  label: string;
  description: string;
}

const ENERGY_OPTIONS: EnergyOption[] = [
  {
    value: "LOW",
    label: "Low",
    description: "Gentle tasks only",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    description: "Steady and capable",
  },
  {
    value: "HIGH",
    label: "High",
    description: "Ready for anything",
  },
];

const ENERGY_EMOJI: Record<EnergyLevel, string> = {
  LOW: "🌱",
  MEDIUM: "☀️",
  HIGH: "🔥",
};

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
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mb-2 text-4xl" aria-hidden>
            ✨
          </div>
          <p className="text-sm text-muted-foreground">A gentle check-in before you begin</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-center font-heading text-2xl font-semibold tracking-tight">
              How&apos;s your energy today?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ENERGY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                onClick={() => handleSelect(option.value)}
                disabled={setEnergy.isPending}
                aria-label={option.label}
                className="flex h-auto w-full items-center justify-between rounded-2xl px-5 py-4 text-left transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {ENERGY_EMOJI[option.value]}
                  </span>
                  <div>
                    <div className="text-base font-semibold">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </div>
                </div>
                {setEnergy.isPending && setEnergy.variables?.value === option.value && (
                  <Loader2 className="size-4 animate-spin" />
                )}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
