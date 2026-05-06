"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { AvailabilitySettings } from "~/app/_components/AvailabilitySettings";
import { CurrentFocusHero } from "~/app/_components/CurrentFocusHero";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

export function WarTableClient() {
  const [showAvailability, setShowAvailability] = useState(false);

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
          <CurrentFocusHero />
        </section>

        {/* Bottom zone — Mini Timeline (placeholder) */}
        <section
          className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30"
          aria-label="Mini Timeline"
        >
          <p className="text-sm text-muted-foreground">
            Add objectives to get started
          </p>
        </section>
      </div>

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
