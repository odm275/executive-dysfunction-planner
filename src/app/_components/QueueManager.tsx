"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

type ScheduleItem = {
  id: number;
  objectiveId: number;
  objectiveName: string;
  questName: string;
  intendedDuration: number;
  order: number;
  scheduledStart?: Date;
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type Props = {
  onOpenAddObjective: () => void;
};

// ---------------------------------------------------------------------------
// QueueManager — the full queue controls panel
// ---------------------------------------------------------------------------
export function QueueManager({ onOpenAddObjective }: Props) {
  const utils = api.useUtils();

  const { data: schedule } = api.warTable.getTodaySchedule.useQuery();
  const items = (schedule ?? []) as ScheduleItem[];

  const removeFromToday = api.warTable.removeFromToday.useMutation({
    onSuccess: () => void utils.warTable.getTodaySchedule.invalidate(),
  });

  const reorderQueue = api.warTable.reorderQueue.useMutation({
    onSuccess: () => void utils.warTable.getTodaySchedule.invalidate(),
  });

  function moveItem(index: number, direction: -1 | 1) {
    const newOrder = [...items];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const tmp = newOrder[index]!;
    newOrder[index] = newOrder[targetIndex]!;
    newOrder[targetIndex] = tmp;
    reorderQueue.mutate({ orderedIds: newOrder.map((item) => item.id) });
  }

  function handleReschedule() {
    void utils.warTable.getTodaySchedule.invalidate();
  }

  return (
    <div className="space-y-3 text-sm">
      {/* Actions toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenAddObjective}>
          + Add objective
        </Button>
        <Button variant="outline" size="sm" onClick={handleReschedule}>
          🔄 Reschedule from now
        </Button>
      </div>

      {/* Queue list with controls */}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No objectives queued. Add some to get started.
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2"
            >
              {/* Up/down reorder */}
              <div className="flex flex-col gap-0.5">
                <button
                  aria-label="Move up"
                  disabled={index === 0 || reorderQueue.isPending}
                  onClick={() => moveItem(index, -1)}
                  className="rounded p-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  aria-label="Move down"
                  disabled={
                    index === items.length - 1 || reorderQueue.isPending
                  }
                  onClick={() => moveItem(index, 1)}
                  className="rounded p-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              {/* Item info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.objectiveName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.questName} · {formatDuration(item.intendedDuration)}
                </p>
              </div>

              {/* Remove button */}
              <button
                aria-label={`Remove ${item.objectiveName}`}
                disabled={removeFromToday.isPending}
                onClick={() =>
                  removeFromToday.mutate({ scheduleItemId: item.id })
                }
                className="shrink-0 rounded p-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
