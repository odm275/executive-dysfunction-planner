"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

const DURATION_OPTIONS = [
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h", value: 120 },
] as const;

type ScheduleItem = {
  id: number;
  objectiveId: number;
  objectiveName: string;
  questName: string;
  intendedDuration: number;
  order: number;
  scheduledStart?: Date;
};

type ActiveObjective = {
  id: number;
  name: string;
  questName: string;
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Add objectives browse + duration picker flow
// ---------------------------------------------------------------------------
function AddObjectivesPanel({
  schedule,
  onClose,
}: {
  schedule: ScheduleItem[];
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const { data: quests, isLoading } = api.quest.listActiveQuests.useQuery();
  const addToToday = api.warTable.addToToday.useMutation({
    onSuccess: () => {
      void utils.warTable.getTodaySchedule.invalidate();
    },
  });

  const [selectedObjectiveId, setSelectedObjectiveId] = useState<
    number | null
  >(null);

  const scheduledObjectiveIds = new Set(schedule.map((s) => s.objectiveId));

  const allObjectives: ActiveObjective[] = (quests ?? []).flatMap((q) =>
    q.objectives
      .filter((o) => !o.isCompleted)
      .map((o) => ({
        id: o.id,
        name: o.name,
        questName: q.name,
      })),
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Add objective to today</h3>
      {selectedObjectiveId === null ? (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {allObjectives.length === 0 && (
            <p className="text-sm text-muted-foreground">No active objectives</p>
          )}
          {allObjectives.map((obj) => {
            const alreadyQueued = scheduledObjectiveIds.has(obj.id);
            return (
              <button
                key={obj.id}
                disabled={alreadyQueued}
                onClick={() => setSelectedObjectiveId(obj.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  alreadyQueued
                    ? "cursor-not-allowed opacity-50 bg-muted"
                    : "hover:bg-muted bg-muted/30"
                }`}
              >
                <p className="font-medium">{obj.name}</p>
                <p className="text-xs text-muted-foreground">
                  {obj.questName}
                  {alreadyQueued ? " · Already queued" : ""}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            How long do you intend to spend?
          </p>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map(({ label, value }) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                disabled={addToToday.isPending}
                onClick={() =>
                  addToToday.mutate({
                    objectiveId: selectedObjectiveId,
                    intendedDuration: value,
                  })
                }
              >
                {label}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedObjectiveId(null)}
          >
            ← Back
          </Button>
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueueManager — the full queue controls panel
// ---------------------------------------------------------------------------
export function QueueManager() {
  const utils = api.useUtils();

  const { data: schedule } = api.warTable.getTodaySchedule.useQuery();
  const items = (schedule ?? []) as ScheduleItem[];

  const removeFromToday = api.warTable.removeFromToday.useMutation({
    onSuccess: () => void utils.warTable.getTodaySchedule.invalidate(),
  });

  const reorderQueue = api.warTable.reorderQueue.useMutation({
    onSuccess: () => void utils.warTable.getTodaySchedule.invalidate(),
  });

  const [showAdd, setShowAdd] = useState(false);

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd((prev) => !prev)}
        >
          + Add objective
        </Button>
        <Button variant="outline" size="sm" onClick={handleReschedule}>
          🔄 Reschedule from now
        </Button>
      </div>

      {/* Add objectives panel */}
      {showAdd && (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <AddObjectivesPanel
            schedule={items}
            onClose={() => setShowAdd(false)}
          />
        </div>
      )}

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
