"use client";

import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

const CATEGORY_LABELS = {
  COMFORT: "🛁 Comfort",
  ENTERTAINMENT: "🎮 Entertainment",
  SOCIAL: "👥 Social",
};

export function RewardMenu({ onClose }: { onClose: () => void }) {
  const { data: rewards, isLoading } = api.reward.listRewards.useQuery();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="reward-menu"
        className="max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>What&apos;s my reward? 🎉</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              data-testid="reward-menu-close"
              onClick={onClose}
            >
              ✕
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading rewards…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {(["COMFORT", "ENTERTAINMENT", "SOCIAL"] as const).map(
              (category) => {
                const items = rewards?.[category] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={category}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABELS[category]}
                    </h3>
                    <ul className="space-y-1.5">
                      {items.map((r) => (
                        <li key={r.id} data-testid={`reward-item-${r.id}`}>
                          <Card>
                            <CardContent className="px-3 py-2">
                              <p className="text-sm font-medium">{r.name}</p>
                              {r.description && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {r.description}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              },
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
