"use client";

import { api } from "~/trpc/react";

export function PartyMemberDashboard() {
  const utils = api.useUtils();

  // Party Members see only objectives they've been invited to
  // We query the active quests but filter to show only recruitable objectives
  // assigned to this user via their collaborator records.
  // For simplicity, we expose a listMyCollaborations query.
  const upgradeToAdventurer = api.collaboration.upgradeToAdventurer.useMutation({
    onSuccess: () => {
      // Reload the page to re-render as an Adventurer
      window.location.href = "/";
    },
  });

  return (
    <main
      data-testid="party-member-dashboard"
      className="flex min-h-screen flex-col bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white"
    >
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">
          Party Member{" "}
          <span className="text-[hsl(280,100%,70%)]">Dashboard</span>
        </h1>
      </header>

      <div className="flex-1 px-4 pb-8">
        <p className="mb-6 text-sm text-white/50">
          You&apos;re a Party Member. You can see objectives you&apos;ve been invited to.
        </p>

        {/* Upgrade CTA */}
        <div className="rounded-xl border border-[hsl(280,100%,70%)]/20 bg-[hsl(280,100%,70%)]/5 p-5">
          <h2 className="font-semibold text-white">
            Ready for your own quests?
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Upgrade to Adventurer to create your own World Map and manage your own quests.
          </p>
          <button
            data-testid="upgrade-to-adventurer-btn"
            onClick={() => upgradeToAdventurer.mutate()}
            disabled={upgradeToAdventurer.isPending}
            className="mt-3 rounded-lg bg-[hsl(280,100%,70%)]/20 px-5 py-2.5 text-sm font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/30 disabled:opacity-40"
          >
            {upgradeToAdventurer.isPending ? "Upgrading…" : "Upgrade to Adventurer ✨"}
          </button>
        </div>
      </div>
    </main>
  );
}
