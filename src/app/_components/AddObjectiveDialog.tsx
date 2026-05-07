"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

type Mode = "pick-existing" | "create-new";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current schedule items — used to mark already-queued objectives. */
  schedule: ScheduleItem[];
};

/**
 * Shared Add Objective modal with two modes (Issues #75, #76).
 *
 * Pick Existing: browse non-completed objectives, pick one, select duration.
 * Create New:    pick a quest, type an objective name, select duration — all
 *                in one round-trip via createObjectiveAndAddToToday.
 *
 * Both modes close the modal on success and invalidate getTodaySchedule.
 * Modal defaults to Pick Existing when opened.
 */
export function AddObjectiveDialog({ open, onOpenChange, schedule }: Props) {
  const utils = api.useUtils();
  const { data: quests, isLoading } = api.quest.listActiveQuests.useQuery(
    undefined,
    { enabled: open },
  );

  // ── Mode toggle ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("pick-existing");

  // ── Pick Existing state ──────────────────────────────────────────────────
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<
    number | null
  >(null);
  const [pickDuration, setPickDuration] = useState<number | null>(null);

  const addToToday = api.warTable.addToToday.useMutation({
    onSuccess: () => {
      void utils.warTable.getTodaySchedule.invalidate();
      closeAndReset();
    },
  });

  // ── Create New state ─────────────────────────────────────────────────────
  const [newQuestId, setNewQuestId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState<number | null>(null);

  const createAndAdd = api.warTable.createObjectiveAndAddToToday.useMutation({
    onSuccess: () => {
      void utils.warTable.getTodaySchedule.invalidate();
      closeAndReset();
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function closeAndReset() {
    onOpenChange(false);
    setMode("pick-existing");
    setSelectedObjectiveId(null);
    setPickDuration(null);
    setNewQuestId(null);
    setNewName("");
    setNewDuration(null);
  }

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

  const selectedObjective = allObjectives.find(
    (o) => o.id === selectedObjectiveId,
  );

  function handlePickConfirm() {
    if (selectedObjectiveId == null || pickDuration == null) return;
    addToToday.mutate({
      objectiveId: selectedObjectiveId,
      intendedDuration: pickDuration,
    });
  }

  const createNewValid =
    newQuestId != null && newName.trim().length > 0 && newDuration != null;

  function handleCreateConfirm() {
    if (!createNewValid) return;
    createAndAdd.mutate({
      questId: newQuestId!,
      name: newName.trim(),
      intendedDuration: newDuration!,
    });
  }

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Objective to Today</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border p-0.5 text-sm">
          <button
            onClick={() => setMode("pick-existing")}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
              mode === "pick-existing"
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pick Existing
          </button>
          <button
            onClick={() => setMode("create-new")}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
              mode === "create-new"
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create New
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : mode === "pick-existing" ? (
          /* ── Pick Existing ── */
          selectedObjectiveId === null ? (
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
                <DurationPicker value={pickDuration} onChange={setPickDuration} />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handlePickConfirm}
                  disabled={pickDuration == null || addToToday.isPending}
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
          )
        ) : (
          /* ── Create New ── */
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Quest</p>
              <Select
                value={newQuestId != null ? String(newQuestId) : ""}
                onValueChange={(val) =>
                  setNewQuestId(val ? parseInt(val, 10) : null)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a quest…" />
                </SelectTrigger>
                <SelectContent>
                  {(quests ?? []).map((q) => (
                    <SelectItem key={q.id} value={String(q.id)}>
                      {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Objective name</p>
              <Input
                placeholder="What do you need to do?"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                How long do you intend to spend?
              </p>
              <DurationPicker value={newDuration} onChange={setNewDuration} />
            </div>

            <Button
              onClick={handleCreateConfirm}
              disabled={!createNewValid || createAndAdd.isPending}
              className="w-full"
            >
              Create &amp; add to today
            </Button>

            {createAndAdd.isError && (
              <p className="text-xs text-destructive">
                {(createAndAdd.error as { message?: string })?.message ??
                  "Failed to create objective. Please try again."}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
