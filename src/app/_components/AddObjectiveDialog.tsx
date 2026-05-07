"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DurationPicker } from "~/components/DurationPicker";
import { api } from "~/trpc/react";

type ScheduleItem = {
  id: number;
  objectiveId: number;
};

type ActiveObjective = {
  id: number;
  name: string;
  questName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current schedule items — used to mark already-queued objectives. */
  schedule: ScheduleItem[];
};

/**
 * Shared Add Objective modal — Pick Existing mode (Issue #75).
 *
 * Shows all non-completed objectives grouped by quest. The user picks one,
 * selects a duration via DurationPicker, then confirms. Already-queued
 * objectives are visually disabled.
 */
export function AddObjectiveDialog({ open, onOpenChange, schedule }: Props) {
  const utils = api.useUtils();
  const { data: quests, isLoading } = api.quest.listActiveQuests.useQuery(
    undefined,
    { enabled: open },
  );

  const addToToday = api.warTable.addToToday.useMutation({
    onSuccess: () => {
      void utils.warTable.getTodaySchedule.invalidate();
      onOpenChange(false);
      setSelectedObjectiveId(null);
      setDuration(null);
    },
  });

  const [selectedObjectiveId, setSelectedObjectiveId] = useState<
    number | null
  >(null);
  const [duration, setDuration] = useState<number | null>(null);

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

  function handleClose() {
    onOpenChange(false);
    setSelectedObjectiveId(null);
    setDuration(null);
  }

  function handleConfirm() {
    if (selectedObjectiveId == null || duration == null) return;
    addToToday.mutate({
      objectiveId: selectedObjectiveId,
      intendedDuration: duration,
    });
  }

  const selectedObjective = allObjectives.find(
    (o) => o.id === selectedObjectiveId,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Objective to Today</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : selectedObjectiveId === null ? (
          /* Step 1: Browse and pick */
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Pick an objective to schedule for today.
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {allObjectives.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No active objectives
                </p>
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
          </div>
        ) : (
          /* Step 2: Pick duration */
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {selectedObjective?.questName}
              </p>
              <p className="font-semibold">{selectedObjective?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                How long do you intend to spend?
              </p>
              <DurationPicker value={duration} onChange={setDuration} />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleConfirm}
                disabled={duration == null || addToToday.isPending}
              >
                Add to today
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSelectedObjectiveId(null)}
                disabled={addToToday.isPending}
              >
                ← Back
              </Button>
            </div>
            {addToToday.isError && (
              <p className="text-xs text-destructive">
                Failed to add objective. Please try again.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
