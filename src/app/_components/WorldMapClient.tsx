"use client";

import { useCallback, useRef, useState } from "react";
import { EnergyCheckIn } from "~/app/_components/EnergyCheckIn";
import { QuestCard } from "~/app/_components/QuestCard";
import { SuggestionOverlay } from "~/app/_components/SuggestionOverlay";
import { UpdateEnergyButton } from "~/app/_components/UpdateEnergyButton";
import { CreateQuestForm } from "~/app/_components/CreateQuestForm";
import { RewardMenu } from "~/app/_components/RewardMenu";
import { RewardChat } from "~/app/_components/RewardChat";
import { OnboardingConversation } from "~/app/_components/OnboardingConversation";
import { PartyMemberDashboard } from "~/app/_components/PartyMemberDashboard";
import { api } from "~/trpc/react";

type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

const MAX_ACTIVE_QUESTS = 6;

export function WorldMapClient() {
  const { data: todayEnergy, isLoading: energyLoading } =
    api.energy.getTodayEnergy.useQuery();
  const { data: quests, isLoading: questsLoading } =
    api.quest.listActiveQuests.useQuery();
  const { data: suggestionData, isLoading: suggestionsLoading } =
    api.suggestion.getSuggestions.useQuery();
  const { data: hasAnyQuests, isLoading: hasAnyQuestsLoading } =
    api.quest.hasAnyQuests.useQuery();
  const { data: profile, isLoading: profileLoading } =
    api.user.getProfile.useQuery();
  const [justSet, setJustSet] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRewardMenu, setShowRewardMenu] = useState(false);
  const [rewardChat, setRewardChat] = useState<{
    objectiveName: string;
    difficulty: "HARD" | "LEGENDARY";
  } | null>(null);

  const handleObjectiveCompleted = useCallback(
    (objectiveName: string, difficulty: string) => {
      if (difficulty === "HARD" || difficulty === "LEGENDARY") {
        setRewardChat({ objectiveName, difficulty });
      }
    },
    [],
  );

  // Track which objective (if any) was tapped in the suggestion overlay so the
  // matching quest card can auto-expand to it.
  const [focusedObjectiveId, setFocusedObjectiveId] = useState<number | null>(
    null,
  );
  const questRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleSuggestionSelect = useCallback(
    (objectiveId: number, questId: number) => {
      setFocusedObjectiveId(objectiveId);
      // Scroll the matching quest card into view
      const el = questRefs.current[questId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [],
  );

  // Only block render on energy loading — quests load inside the map
  if (energyLoading || hasAnyQuestsLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1a0533] to-[#0a0d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  // Party Members see a limited dashboard
  if (profile?.accountTier === "PARTY_MEMBER") {
    return <PartyMemberDashboard />;
  }

  // First-time user: show onboarding conversation
  if (!hasAnyQuests && !onboardingComplete) {
    return (
      <OnboardingConversation
        onComplete={() => setOnboardingComplete(true)}
      />
    );
  }

  // Show energy check-in if not yet set today
  if (!todayEnergy && !justSet) {
    return <EnergyCheckIn onComplete={() => setJustSet(true)} />;
  }

  const energy = (todayEnergy?.value ?? "MEDIUM") as EnergyLevel;
  const activeQuests = quests ?? [];
  const slotsRemaining = MAX_ACTIVE_QUESTS - activeQuests.length;
  const suggestions = suggestionData?.suggestions ?? [];
  const resolvedEnergy: EnergyLevel =
    (suggestionData?.energy ?? energy) as EnergyLevel;

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">
          Executive Dysfunction{" "}
          <span className="text-[hsl(280,100%,70%)]">Planner</span>
        </h1>
        <div className="flex items-center gap-3">
          <button
            data-testid="whats-my-reward-btn"
            onClick={() => setShowRewardMenu(true)}
            className="rounded border border-[hsl(280,100%,70%)]/30 bg-[hsl(280,100%,70%)]/10 px-3 py-1.5 text-xs font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/20"
          >
            🎁 Reward?
          </button>
          <UpdateEnergyButton currentEnergy={energy} />
        </div>
      </header>

      {/* World Map content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* Page title + slot counter + add quest button */}
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl font-extrabold">Your World Map</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/40" data-testid="slots-remaining">
              {slotsRemaining > 0
                ? `${slotsRemaining} quest slot${slotsRemaining !== 1 ? "s" : ""} remaining`
                : "Quest limit reached"}
            </span>
            {slotsRemaining > 0 && !showCreateForm && (
              <button
                data-testid="add-quest-btn"
                onClick={() => setShowCreateForm(true)}
                className="rounded bg-[hsl(280,100%,70%)]/20 px-3 py-1.5 text-xs font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/30"
              >
                + New Quest
              </button>
            )}
          </div>
        </div>

        {/* Energy badge */}
        <p className="mb-6 text-sm text-white/50">
          Energy today:{" "}
          <span className="font-semibold text-white">{energy}</span>
        </p>

        {/* Create quest form */}
        {showCreateForm && (
          <div className="mb-4">
            <CreateQuestForm
              onSuccess={() => setShowCreateForm(false)}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {/* Suggestion overlay */}
        <SuggestionOverlay
          energy={resolvedEnergy}
          suggestions={suggestions}
          isLoading={suggestionsLoading}
          onSelectObjective={handleSuggestionSelect}
        />

        {/* Quest regions */}
        {questsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : activeQuests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-lg font-semibold text-white/50">
              No active quests yet.
            </p>
            <p className="max-w-xs text-sm text-white/30">
              Your adventure awaits — add your first quest to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="quest-list">
            {activeQuests.map((q) => (
              <div
                key={q.id}
                ref={(el) => {
                  questRefs.current[q.id] = el;
                }}
              >
                <QuestCard
                  quest={q}
                  focusObjectiveId={focusedObjectiveId}
                  onObjectiveCompleted={handleObjectiveCompleted}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reward Menu modal */}
      {showRewardMenu && (
        <RewardMenu onClose={() => setShowRewardMenu(false)} />
      )}

      {/* AI Reward Chat modal */}
      {rewardChat && (
        <RewardChat
          objectiveName={rewardChat.objectiveName}
          difficulty={rewardChat.difficulty}
          onClose={() => setRewardChat(null)}
        />
      )}
    </main>
  );
}
