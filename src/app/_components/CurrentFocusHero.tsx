"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

type ScheduleItem = {
  id: number;
  objectiveId: number;
  objectiveName: string;
  questName: string;
  intendedDuration: number;
  scheduledStart?: Date;
};

type ActiveSession = {
  id: number;
  scheduleItemId: number;
  startedAt: Date;
  endedAt: Date | null;
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Timer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(
    Math.floor((Date.now() - startedAt.getTime()) / 1000),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="font-mono text-2xl font-bold tabular-nums">
      {formatElapsed(elapsed)}
    </span>
  );
}

export function CurrentFocusHero() {
  const utils = api.useUtils();

  const { data: schedule, isLoading: scheduleLoading } =
    api.warTable.getTodaySchedule.useQuery();
  const { data: activeSession } =
    api.workSession.getActiveSession.useQuery();

  const startSession = api.workSession.startSession.useMutation({
    onSuccess: () => utils.workSession.getActiveSession.invalidate(),
  });
  const pauseSession = api.workSession.pauseSession.useMutation({
    onSuccess: () => utils.workSession.getActiveSession.invalidate(),
  });
  const completeSession = api.workSession.completeSession.useMutation({
    onSuccess: () => {
      void utils.workSession.getActiveSession.invalidate();
      void utils.warTable.getTodaySchedule.invalidate();
    },
  });

  if (scheduleLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // Current focus = first item with scheduledStart
  const currentItem = (schedule ?? []).find(
    (item) => item.scheduledStart != null,
  ) as ScheduleItem | undefined;

  if (!currentItem) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold text-muted-foreground">
          No objectives scheduled
        </p>
        <p className="text-sm text-muted-foreground">
          Add objectives to get started
        </p>
      </div>
    );
  }

  const session = activeSession as ActiveSession | null | undefined;
  const isCurrentItemActive =
    session != null && session.scheduleItemId === currentItem.id;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Objective info */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {currentItem.questName}
        </p>
        <h2 className="text-2xl font-bold leading-tight">
          {currentItem.objectiveName}
        </h2>
      </div>

      {/* Duration info */}
      <div className="flex items-center gap-6">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Intended</p>
          <p className="text-lg font-semibold">
            {formatDuration(currentItem.intendedDuration)}
          </p>
        </div>
        {isCurrentItemActive && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Elapsed</p>
            <Timer startedAt={new Date(session.startedAt)} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isCurrentItemActive && (
          <Button
            onClick={() =>
              startSession.mutate({
                scheduleItemId: currentItem.id,
                objectiveId: currentItem.objectiveId,
              })
            }
            disabled={
              startSession.isPending ||
              (session != null && !isCurrentItemActive)
            }
          >
            ▶ Start
          </Button>
        )}
        {isCurrentItemActive && (
          <>
            <Button
              variant="outline"
              onClick={() => pauseSession.mutate({ sessionId: session.id })}
              disabled={pauseSession.isPending}
            >
              ⏸ Pause
            </Button>
            <Button
              onClick={() => completeSession.mutate({ sessionId: session.id })}
              disabled={completeSession.isPending}
            >
              ✓ Done
            </Button>
          </>
        )}
      </div>

      {session != null && !isCurrentItemActive && (
        <p className="text-xs text-muted-foreground">
          Another session is active. Complete it before starting a new one.
        </p>
      )}
    </div>
  );
}
