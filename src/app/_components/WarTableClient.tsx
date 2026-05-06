"use client";

import Link from "next/link";
import { buttonVariants } from "~/components/ui/button";
import { ThemeToggle } from "~/components/ui/theme-toggle";

export function WarTableClient() {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">The War Table</h1>
        <div className="flex items-center gap-3">
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
        {/* Top zone — Current Focus Hero (placeholder) */}
        <section
          className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30"
          aria-label="Current Focus Hero"
        >
          <p className="text-sm text-muted-foreground">
            Current Focus Hero — coming soon
          </p>
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
    </main>
  );
}
