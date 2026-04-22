"use client";

import { api } from "~/trpc/react";

const CATEGORY_LABELS = {
  COMFORT: "🛁 Comfort",
  ENTERTAINMENT: "🎮 Entertainment",
  SOCIAL: "👥 Social",
};

const CATEGORY_COLOURS = {
  COMFORT: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  ENTERTAINMENT: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  SOCIAL: "border-green-500/30 bg-green-500/10 text-green-300",
};

export function RewardMenu({ onClose }: { onClose: () => void }) {
  const { data: rewards, isLoading } = api.reward.listRewards.useQuery();

  return (
    <div
      data-testid="reward-menu"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[hsl(280,100%,70%)]/20 bg-[#1a0533] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            What&apos;s my reward? 🎉
          </h2>
          <button
            data-testid="reward-menu-close"
            onClick={onClose}
            className="text-white/40 hover:text-white/70"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4">
            <div className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-white/60" />
            <span className="text-sm text-white/30">Loading rewards…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {(["COMFORT", "ENTERTAINMENT", "SOCIAL"] as const).map(
              (category) => {
                const items = rewards?.[category] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={category}>
                    <h3
                      className={`mb-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${CATEGORY_COLOURS[category]}`}
                    >
                      {CATEGORY_LABELS[category]}
                    </h3>
                    <ul className="space-y-1.5">
                      {items.map((r) => (
                        <li
                          key={r.id}
                          data-testid={`reward-item-${r.id}`}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-white/90">
                            {r.name}
                          </p>
                          {r.description && (
                            <p className="mt-0.5 text-xs text-white/40">
                              {r.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}
