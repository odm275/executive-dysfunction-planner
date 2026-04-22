"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

type Props = {
  onSuccess: () => void;
  onCancel: () => void;
};

export function CreateQuestForm({ onSuccess, onCancel }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSideQuest, setIsSideQuest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const createQuest = api.quest.createQuest.useMutation({
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
    createQuest.mutate({
      name: trimmed,
      description: description.trim() || undefined,
      isSideQuest,
    });
  }

  return (
    <form
      data-testid="create-quest-form"
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
    >
      <h3 className="font-semibold text-white/90 text-sm">New Quest</h3>

      {error && (
        <p data-testid="create-quest-error" className="rounded bg-red-500/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Quest name */}
      <div>
        <label className="mb-1 block text-xs text-white/50" htmlFor="quest-name">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          id="quest-name"
          data-testid="create-quest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Driving Lessons"
          maxLength={255}
          required
          className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/40"
        />
      </div>

      {/* Optional description */}
      <div>
        <label className="mb-1 block text-xs text-white/50" htmlFor="quest-description">
          Description (optional)
        </label>
        <input
          id="quest-description"
          data-testid="create-quest-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description…"
          maxLength={500}
          className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/40"
        />
      </div>

      {/* Side Quest toggle */}
      <label
        data-testid="create-quest-side-quest-label"
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
      >
        <input
          type="checkbox"
          data-testid="create-quest-side-quest-toggle"
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

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          data-testid="create-quest-cancel"
          onClick={onCancel}
          className="rounded px-4 py-2 text-sm text-white/40 hover:text-white/70"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="create-quest-submit"
          disabled={createQuest.isPending || !name.trim()}
          className="rounded bg-[hsl(280,100%,70%)]/20 px-4 py-2 text-sm font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/30 disabled:opacity-40"
        >
          {createQuest.isPending ? "Creating…" : "Create Quest"}
        </button>
      </div>
    </form>
  );
}
