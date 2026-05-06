"use client";

import { api } from "~/trpc/react";

type ScheduleItem = {
  id: number;
  objectiveName: string;
  questName: string;
  intendedDuration: number;
  scheduledStart?: Date;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function MiniTimeline() {
  const utils = api.useUtils();
  const { data: schedule, isLoading } =
    api.warTable.getTodaySchedule.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const items = (schedule ?? []) as ScheduleItem[];

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted-foreground">
          Add objectives to get started
        </p>
      </div>
    );
  }

  const scheduled = items.filter((item) => item.scheduledStart != null);
  const unscheduled = items.filter((item) => item.scheduledStart == null);

  // Group scheduled items by window (group items with sequential scheduledStarts)
  type WindowGroup = {
    windowStart: Date;
    windowEnd: Date;
    items: ScheduleItem[];
  };

  const windows: WindowGroup[] = [];
  for (const item of scheduled) {
    const start = new Date(item.scheduledStart!);
    const end = new Date(start.getTime() + item.intendedDuration * 60_000);
    const last = windows[windows.length - 1];
    if (last && start <= last.windowEnd) {
      last.items.push(item);
      if (end > last.windowEnd) last.windowEnd = end;
    } else {
      windows.push({ windowStart: start, windowEnd: end, items: [item] });
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4 text-sm">
      <h3 className="shrink-0 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
        Today&rsquo;s Schedule
      </h3>

      {/* Availability windows with scheduled items */}
      {windows.map((win, wi) => (
        <div key={wi} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {formatTime(win.windowStart)} – {formatTime(win.windowEnd)}
          </p>
          <div className="space-y-1 pl-2 border-l-2 border-border">
            {win.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
              >
                <div className="space-y-0.5">
                  <p className="font-medium leading-tight">{item.objectiveName}</p>
                  <p className="text-xs text-muted-foreground">{item.questName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium">
                    {formatTime(new Date(item.scheduledStart!))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(item.intendedDuration)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Unscheduled overflow */}
      {unscheduled.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Overflow — didn&rsquo;t fit today
          </p>
          <div className="space-y-1 pl-2 border-l-2 border-dashed border-border">
            {unscheduled.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 opacity-60"
              >
                <div className="space-y-0.5">
                  <p className="font-medium leading-tight">{item.objectiveName}</p>
                  <p className="text-xs text-muted-foreground">{item.questName}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatDuration(item.intendedDuration)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
