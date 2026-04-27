"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

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
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        aria-label="Update energy level"
      >
        <span>Energy: {ENERGY_LABELS[currentEnergy]}</span>
        <span className="text-muted-foreground">▾</span>
      </Button>

      {open && (
        <Card className="absolute right-0 top-full z-10 mt-2 w-44 overflow-hidden p-0">
          <CardContent className="flex flex-col gap-0 p-0">
            {(["LOW", "MEDIUM", "HIGH"] as EnergyLevel[]).map((level) => (
              <Button
                key={level}
                variant="ghost"
                onClick={() => setEnergy.mutate({ value: level })}
                disabled={setEnergy.isPending}
                aria-label={ENERGY_LABELS[level]}
                className="w-full justify-start rounded-none px-4 py-3 text-left text-sm"
              >
                {ENERGY_LABELS[level]}
                {level === currentEnergy && (
                  <span className="ml-2 text-primary">✓</span>
                )}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
