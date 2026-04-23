"use client";

import { useCallback, useState } from "react";
import { EnergyCheckIn } from "~/app/_components/EnergyCheckIn";
import { QuestCard } from "~/app/_components/QuestCard";
import { SuggestionOverlay } from "~/app/_components/SuggestionOverlay";
import { UpdateEnergyButton } from "~/app/_components/UpdateEnergyButton";
import { CreateQuestForm } from "~/app/_components/CreateQuestForm";
import { QuestBuilderChat } from "~/app/_components/QuestBuilderChat";
import { RewardMenu } from "~/app/_components/RewardMenu";
import { RewardChat } from "~/app/_components/RewardChat";
import { OnboardingConversation } from "~/app/_components/OnboardingConversation";
import { PartyMemberDashboard } from "~/app/_components/PartyMemberDashboard";
import { ReminderPreferences } from "~/app/_components/ReminderPreferences";
import { api } from "~/trpc/react";

type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

const MAX_ACTIVE_QUESTS = 6;

// Fixed positions for up to 6 quest nodes — winding RPG path
const NODE_POSITIONS = [
  { left: 15, top: 20 },
  { left: 38, top: 10 },
  { left: 62, top: 25 },
  { left: 75, top: 55 },
  { left: 50, top: 70 },
  { left: 22, top: 65 },
] as const;

function progressPercent(objectives: { isCompleted: boolean }[]): number {
  if (objectives.length === 0) return 0;
  const completed = objectives.filter((o) => o.isCompleted).length;
  return Math.round((completed / objectives.length) * 100);
}

// ---------------------------------------------------------------------------
// QuestMapNode
// ---------------------------------------------------------------------------
type QuestForNode = {
  id: number;
  name: string;
  isSideQuest: boolean;
  objectives: { isCompleted: boolean }[];
};

function QuestMapNode({
  quest,
  index,
  isSelected,
  onClick,
}: {
  quest: QuestForNode;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const pct = progressPercent(quest.objectives);
  const pos = NODE_POSITIONS[index % NODE_POSITIONS.length]!;
  const size = quest.isSideQuest ? 52 : 68;
  const r = size / 2 - 6;
  const circumference = 2 * Math.PI * r;
  const strokeDash = (pct / 100) * circumference;
  const accent = quest.isSideQuest
    ? {
        ring: "#22d3ee",
        fill: "rgba(6,182,212,0.15)",
        glow: "rgba(34,211,238,0.45)",
      }
    : {
        ring: "hsl(280,100%,70%)",
        fill: "rgba(139,92,246,0.15)",
        glow: "rgba(167,139,250,0.45)",
      };

  return (
    <div
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        transform: "translate(-50%, -50%)",
      }}
      className="absolute flex flex-col items-center"
    >
      <button
        data-testid={`quest-region-${quest.id}`}
        onClick={onClick}
        className={`relative rounded-full transition-all focus:outline-none ${
          isSelected ? "scale-110" : "hover:scale-105"
        }`}
        style={{
          filter: isSelected
            ? `drop-shadow(0 0 14px ${accent.glow})`
            : undefined,
        }}
        aria-label={quest.name}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
        >
          {/* Background fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill={accent.fill}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
          />
          {/* Progress ring track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="4"
          />
          {/* Progress ring fill */}
          {pct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={accent.ring}
              strokeWidth="4"
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
          {/* Percent label */}
          <text
            x={size / 2}
            y={size / 2 + (quest.isSideQuest ? 4 : 5)}
            textAnchor="middle"
            fontSize={quest.isSideQuest ? "10" : "12"}
            fontWeight="600"
            fill="rgba(255,255,255,0.85)"
          >
            {pct}%
          </text>
        </svg>
      </button>

      {/* Label beneath node */}
      <div className="mt-1.5 max-w-[96px] text-center">
        <p
          className="truncate text-xs font-semibold leading-tight text-white/80"
          title={quest.name}
        >
          {quest.name}
        </p>
        {quest.isSideQuest && (
          <span className="mt-0.5 inline-block rounded bg-cyan-500/20 px-1 py-0.5 text-[10px] font-medium text-cyan-300">
            Side Quest
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MapPaths — decorative dashed lines connecting nodes
// ---------------------------------------------------------------------------
function MapPaths({ count }: { count: number }) {
  if (count < 2) return null;
  const segs = [];
  for (let i = 1; i < count; i++) {
    const from = NODE_POSITIONS[i - 1]!;
    const to = NODE_POSITIONS[i]!;
    const mx = (from.left + to.left) / 2;
    const my = (from.top + to.top) / 2 - 6;
    segs.push(
      <path
        key={i}
        d={`M${from.left},${from.top} Q${mx},${my} ${to.left},${to.top}`}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.6"
        strokeDasharray="2.5 2.5"
      />,
    );
  }
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {segs}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// QuestDrawer — right-side slide-in panel
// ---------------------------------------------------------------------------
function QuestDrawer({
  quest,
  focusObjectiveId,
  onClose,
  onObjectiveCompleted,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quest: any;
  focusObjectiveId: number | null;
  onClose: () => void;
  onObjectiveCompleted: (name: string, difficulty: string) => void;
}) {
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  function handleClose() {
    if (
      hasUnsavedEdits &&
      !window.confirm("You have unsaved changes. Discard them and close?")
    ) {
      return;
    }
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-20 bg-black/40"
        onClick={handleClose}
      />
      {/* Panel */}
      <div
        data-testid="quest-drawer"
        className="absolute right-0 top-0 z-30 flex h-full w-full flex-col border-l border-white/10 bg-[#0d0f1e] md:w-[420px]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="font-semibold text-white/80">Quest Detail</h3>
          <button
            data-testid="quest-drawer-close"
            onClick={handleClose}
            className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/80"
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>
        {/* Scrollable content lives only inside the drawer */}
        <div className="flex-1 overflow-y-auto p-3">
          <QuestCard
            quest={quest}
            focusObjectiveId={focusObjectiveId}
            onObjectiveCompleted={onObjectiveCompleted}
            onUnsavedEditsChange={setHasUnsavedEdits}
            alwaysExpanded
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// WorldMapClient
// ---------------------------------------------------------------------------
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
  const [showReminderPrefs, setShowReminderPrefs] = useState(false);
  const [selectedQuestId, setSelectedQuestId] = useState<number | null>(null);

  const handleObjectiveCompleted = useCallback(
    (objectiveName: string, difficulty: string) => {
      if (difficulty === "HARD" || difficulty === "LEGENDARY") {
        setRewardChat({ objectiveName, difficulty });
      }
    },
    [],
  );

  // When a suggestion is selected, open the matching quest in the drawer
  const [focusedObjectiveId, setFocusedObjectiveId] = useState<number | null>(
    null,
  );

  const handleSuggestionSelect = useCallback(
    (objectiveId: number, questId: number) => {
      setFocusedObjectiveId(objectiveId);
      setSelectedQuestId(questId);
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
  const selectedQuest =
    selectedQuestId !== null
      ? (activeQuests.find((q) => q.id === selectedQuestId) ?? null)
      : null;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-6 py-4">
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
          <button
            data-testid="reminder-prefs-btn"
            onClick={() => setShowReminderPrefs(true)}
            className="rounded border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/10"
          >
            🔔
          </button>
          <UpdateEnergyButton currentEnergy={energy} />
        </div>
      </header>

      {/* Map canvas — fills remaining viewport height, never scrolls */}
      <div
        className="relative flex-1 overflow-hidden"
        data-testid="quest-list"
      >
        {/* Decorative SVG paths between nodes */}
        {!questsLoading && <MapPaths count={activeQuests.length} />}

        {/* HUD: title + slots + add-quest */}
        <div className="absolute left-4 top-3 z-10 flex items-baseline gap-3">
          <h2 className="text-lg font-extrabold">Your World Map</h2>
          <span
            className="text-xs text-white/40"
            data-testid="slots-remaining"
          >
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

        {/* HUD: energy badge — bottom left, above suggestion overlay */}
        <p className="absolute bottom-14 left-4 z-10 text-xs text-white/50">
          Energy:{" "}
          <span className="font-semibold text-white">{energy}</span>
        </p>

        {/* Suggestion overlay — floating HUD bottom-left */}
        <div className="absolute bottom-4 left-4 z-10 max-w-xs">
          <SuggestionOverlay
            energy={resolvedEnergy}
            suggestions={suggestions}
            isLoading={suggestionsLoading}
            onSelectObjective={handleSuggestionSelect}
          />
        </div>

        {/* Quest nodes */}
        {questsLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : activeQuests.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg font-semibold text-white/50">
              No active quests yet.
            </p>
            <p className="max-w-xs text-sm text-white/30">
              Your adventure awaits — add your first quest to get started.
            </p>
          </div>
        ) : (
          activeQuests.map((q, i) => (
            <QuestMapNode
              key={q.id}
              quest={q}
              index={i}
              isSelected={selectedQuestId === q.id}
              onClick={() => {
                setSelectedQuestId(q.id);
                setFocusedObjectiveId(null);
              }}
            />
          ))
        )}

        {/* Quest drawer */}
        {selectedQuest && (
          <QuestDrawer
            quest={selectedQuest}
            focusObjectiveId={focusedObjectiveId}
            onClose={() => {
              setSelectedQuestId(null);
              setFocusedObjectiveId(null);
            }}
            onObjectiveCompleted={handleObjectiveCompleted}
          />
        )}

        {/* Create quest modal */}
        {showCreateForm && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md overflow-y-auto max-h-screen py-8">
              <QuestBuilderChat
                mode="new-quest"
                onSuccess={() => setShowCreateForm(false)}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
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

      {/* Reminder Preferences modal */}
      {showReminderPrefs && (
        <ReminderPreferences onClose={() => setShowReminderPrefs(false)} />
      )}
    </main>
  );
}
