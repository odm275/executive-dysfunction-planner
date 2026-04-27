"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

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
      className="space-y-3 p-4"
    >
      <h3 className="font-semibold text-sm">New Quest</h3>

      {error && (
        <Alert variant="destructive">
          <AlertDescription data-testid="create-quest-error">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quest-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="quest-name"
          data-testid="create-quest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Driving Lessons"
          maxLength={255}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quest-description">Description (optional)</Label>
        <Input
          id="quest-description"
          data-testid="create-quest-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description…"
          maxLength={500}
        />
      </div>

      {/* Side Quest toggle */}
      <Label
        data-testid="create-quest-side-quest-label"
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
      >
        <Checkbox
          data-testid="create-quest-side-quest-toggle"
          checked={isSideQuest}
          onCheckedChange={(checked) => setIsSideQuest(Boolean(checked))}
        />
        <span className="text-sm">
          Side Quest{" "}
          <span className="text-xs text-muted-foreground">
            — passion project, no debuff mechanics
          </span>
        </span>
      </Label>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          data-testid="create-quest-cancel"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          data-testid="create-quest-submit"
          disabled={createQuest.isPending || !name.trim()}
        >
          {createQuest.isPending ? "Creating…" : "Create Quest"}
        </Button>
      </div>
    </form>
  );
}
