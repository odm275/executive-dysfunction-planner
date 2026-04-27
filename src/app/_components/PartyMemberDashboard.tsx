"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function PartyMemberDashboard() {
  const upgradeToAdventurer = api.collaboration.upgradeToAdventurer.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  return (
    <main
      data-testid="party-member-dashboard"
      className="flex min-h-screen flex-col bg-background"
    >
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">
          Party Member Dashboard
        </h1>
      </header>

      <div className="flex-1 px-4 pb-8">
        <p className="mb-6 text-sm text-muted-foreground">
          You&apos;re a Party Member. You can see objectives you&apos;ve been invited to.
        </p>

        {/* Upgrade CTA */}
        <Card>
          <CardHeader>
            <CardTitle>Ready for your own quests?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Upgrade to Adventurer to create your own World Map and manage your own quests.
            </p>
            <Button
              data-testid="upgrade-to-adventurer-btn"
              onClick={() => upgradeToAdventurer.mutate()}
              disabled={upgradeToAdventurer.isPending}
              className="mt-3"
            >
              {upgradeToAdventurer.isPending ? "Upgrading…" : "Upgrade to Adventurer ✨"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
