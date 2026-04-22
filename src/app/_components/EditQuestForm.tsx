"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

type Props = {
  questId: number;
  initialName: string;
  initialDescription: string | null;
  initialIsSideQuest: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

export function EditQuestForm({
  questId,
  initialName,
  initialDescription,
  initialIsSideQuest,
  onSuccess,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [isSideQuest, setIsSideQuest] = useState(initialIsSideQuest);
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const updateQuest = api.quest.updateQuest.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      void utils.suggestion.getSuggestions.invalidate();
      onSuccess();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    updateQuest.mutate({
      id: questId,
      name: trimmed,
      description: description.trim() || undefined,
      isSideQuest,
    });
  }

  return (
    <form
      data-testid={`edit-quest-form-${questId}`}
      onSubmit={handleSubmit}
      className="space-y-3 px-4 py-3 border-t border-white/10"
    >
      <h4 className="text-xs font-semibold uppercase tracking-wide text-white/40">
        Edit Quest
      </h4>

      {error && (
        <p className="rounded bg-red-500/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div>
        <label className="mb-1 block text-xs text-white/50" htmlFor={`edit-quest-name-${questId}`}>
          Name <span className="text-red-400">*</span>
        </label>
        <input
          id={`edit-quest-name-${questId}`}
          data-testid={`edit-quest-name-${questId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          required
          className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/40"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/50" htmlFor={`edit-quest-desc-${questId}`}>
          Description (optional)
        </label>
        <input
          id={`edit-quest-desc-${questId}`}
          data-testid={`edit-quest-description-${questId}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/40"
        />
      </div>

      {/* Side Quest toggle */}
      <label
        data-testid={`edit-quest-side-quest-label-${questId}`}
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
      >
        <input
          type="checkbox"
          data-testid={`edit-quest-side-quest-toggle-${questId}`}
          checked={isSideQuest}
          onChange={(e) => setIsSideQuest(e.target.checked)}
          className="h-4 w-4 accent-cyan-400"
        />
        <span className="text-sm text-white/70">
          Side Quest{" "}
          <span className="text-xs text-white/30">
            — passion project, no debuff mechanics
          </span>
        </span>
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          data-testid={`edit-quest-cancel-${questId}`}
          onClick={onCancel}
          className="rounded px-4 py-2 text-sm text-white/40 hover:text-white/70"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid={`edit-quest-submit-${questId}`}
          disabled={updateQuest.isPending || !name.trim()}
          className="rounded bg-[hsl(280,100%,70%)]/20 px-4 py-2 text-sm font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/30 disabled:opacity-40"
        >
          {updateQuest.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
