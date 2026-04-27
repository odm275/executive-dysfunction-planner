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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold tracking-tight">
              How&apos;s your energy today?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ENERGY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                onClick={() => handleSelect(option.value)}
                disabled={setEnergy.isPending}
                aria-label={option.label}
                className="flex h-auto w-full items-center justify-between px-6 py-4 text-left"
              >
                <div>
                  <div className="text-lg font-semibold">{option.label}</div>
                  <div className="text-sm text-muted-foreground">{option.description}</div>
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
