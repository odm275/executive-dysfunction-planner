"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

import { formatHHMM } from "~/lib/time-format";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type Window = { startTime: string; endTime: string };

function WindowRow({
  win,
  onChange,
  onRemove,
}: {
  win: Window;
  onChange: (w: Window) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        value={win.startTime}
        onChange={(e) => onChange({ ...win, startTime: e.target.value })}
        className="rounded border border-border bg-background px-2 py-1 text-sm"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <input
        type="time"
        value={win.endTime}
        onChange={(e) => onChange({ ...win, endTime: e.target.value })}
        className="rounded border border-border bg-background px-2 py-1 text-sm"
      />
      <Button variant="ghost" size="xs" onClick={onRemove}>
        ✕
      </Button>
    </div>
  );
}

export function AvailabilitySettings() {
  const utils = api.useUtils();
  const { data: template, isLoading } =
    api.availability.getWeeklyTemplate.useQuery();
  const { data: todayOverride } = api.availability.getTodayOverride.useQuery();

  const setWindowForDay = api.availability.setWindowForDay.useMutation({
    onSuccess: () => utils.availability.getWeeklyTemplate.invalidate(),
  });
  const setTodayOverride = api.availability.setTodayOverride.useMutation({
    onSuccess: () => utils.availability.getTodayOverride.invalidate(),
  });

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editWindows, setEditWindows] = useState<Window[]>([]);
  const [overrideWindows, setOverrideWindows] = useState<Window[] | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const windowsByDay: Record<number, Window[]> = {};
  for (const w of template ?? []) {
    windowsByDay[w.dayOfWeek] ??= [];
    windowsByDay[w.dayOfWeek]!.push({ startTime: w.startTime, endTime: w.endTime });
  }

  function startEditDay(day: number) {
    setEditingDay(day);
    setEditWindows(windowsByDay[day] ?? [{ startTime: "09:00", endTime: "17:00" }]);
  }

  function saveDay() {
    if (editingDay === null) return;
    setWindowForDay.mutate({ dayOfWeek: editingDay, windows: editWindows });
    setEditingDay(null);
  }

  const effectiveOverride = overrideWindows ?? (todayOverride?.map((w) => ({ startTime: w.startTime, endTime: w.endTime })) ?? []);

  function saveOverride() {
    setTodayOverride.mutate({ windows: effectiveOverride });
    setOverrideWindows(null);
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold">Weekly Availability Template</h3>
        <p className="text-xs text-muted-foreground">Click a day to edit its windows.</p>
      </div>

      <div className="space-y-2">
        {DAYS.map((name, day) => {
          const wins = windowsByDay[day] ?? [];
          return (
            <div key={day} className="flex items-center gap-3">
              <span className="w-24 text-xs font-medium">{name}</span>
              <span className="flex-1 text-xs text-muted-foreground">
                {wins.length === 0
                  ? "No windows"
                  : wins.map((w) => `${formatHHMM(w.startTime)}–${formatHHMM(w.endTime)}`).join(", ")}
              </span>
              <Button variant="outline" size="xs" onClick={() => startEditDay(day)}>
                Edit
              </Button>
            </div>
          );
        })}
      </div>

      {editingDay !== null && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="font-medium">{DAYS[editingDay]}</p>
          {editWindows.map((w, i) => (
            <WindowRow
              key={i}
              win={w}
              onChange={(updated) =>
                setEditWindows((prev) =>
                  prev.map((x, idx) => (idx === i ? updated : x)),
                )
              }
              onRemove={() =>
                setEditWindows((prev) => prev.filter((_, idx) => idx !== i))
              }
            />
          ))}
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              setEditWindows((prev) => [
                ...prev,
                { startTime: "09:00", endTime: "17:00" },
              ])
            }
          >
            + Add window
          </Button>
          <div className="flex gap-2">
            <Button size="xs" onClick={saveDay} disabled={setWindowForDay.isPending}>
              Save
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setEditingDay(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold">Today&rsquo;s Override</h3>
        <p className="text-xs text-muted-foreground">
          Override replaces the template for today only.
        </p>
        <div className="mt-2 space-y-2">
          {(overrideWindows ?? effectiveOverride).map((w, i) => (
            <WindowRow
              key={i}
              win={w}
              onChange={(updated) =>
                setOverrideWindows((prev) =>
                  (prev ?? effectiveOverride).map((x, idx) =>
                    idx === i ? updated : x,
                  ),
                )
              }
              onRemove={() =>
                setOverrideWindows((prev) =>
                  (prev ?? effectiveOverride).filter((_, idx) => idx !== i),
                )
              }
            />
          ))}
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              setOverrideWindows((prev) => [
                ...(prev ?? effectiveOverride),
                { startTime: "09:00", endTime: "17:00" },
              ])
            }
          >
            + Add override window
          </Button>
          <Button
            size="xs"
            onClick={saveOverride}
            disabled={setTodayOverride.isPending}
          >
            Set today&rsquo;s override
          </Button>
        </div>
      </div>
    </div>
  );
}
