"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { AvailabilitySettings } from "~/app/_components/AvailabilitySettings";
import { CurrentFocusHero } from "~/app/_components/CurrentFocusHero";
import { MiniTimeline } from "~/app/_components/MiniTimeline";
import { QueueManager } from "~/app/_components/QueueManager";
import { AddObjectiveDialog } from "~/app/_components/AddObjectiveDialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { api } from "~/trpc/react";

export function WarTableClient() {
  const [showAvailability, setShowAvailability] = useState(false);
  const [addObjectiveOpen, setAddObjectiveOpen] = useState(false);

  const { data: schedule } = api.warTable.getTodaySchedule.useQuery();

  function openAddObjective() {
    setAddObjectiveOpen(true);
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">The War Table</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAvailability(true)}
          >
            🕐 Availability
          </Button>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            🗺 World Map
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Two-zone layout */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6 pb-6">
        {/* Top zone — Current Focus Hero */}
        <section
          className="flex flex-1 overflow-hidden rounded-lg border border-border bg-card"
          aria-label="Current Focus Hero"
        >
          <CurrentFocusHero onOpenAddObjective={openAddObjective} />
        </section>

        {/* Bottom zone — Mini Timeline + Queue Manager */}
        <section
          className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
          aria-label="Mini Timeline"
        >
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Mini Timeline */}
            <div className="flex-1 overflow-hidden border-r border-border">
              <MiniTimeline onOpenAddObjective={openAddObjective} />
            </div>
            {/* Right: Queue controls */}
            <div className="w-72 shrink-0 overflow-y-auto p-4">
              <QueueManager onOpenAddObjective={openAddObjective} />
            </div>
          </div>
        </section>
      </div>

      {/* Shared Add Objective modal — rendered once, opened from multiple places */}
      <AddObjectiveDialog
        open={addObjectiveOpen}
        onOpenChange={setAddObjectiveOpen}
        schedule={schedule ?? []}
      />

      {/* Availability settings sheet */}
      <Sheet open={showAvailability} onOpenChange={setShowAvailability}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Availability Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto">
            <AvailabilitySettings />
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
