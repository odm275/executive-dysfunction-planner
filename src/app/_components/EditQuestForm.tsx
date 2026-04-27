"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

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
      className="space-y-3 px-4 py-3"
    >
      <Separator />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Edit Quest
      </h4>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`edit-quest-name-${questId}`}>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`edit-quest-name-${questId}`}
          data-testid={`edit-quest-name-${questId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`edit-quest-desc-${questId}`}>
          Description (optional)
        </Label>
        <Input
          id={`edit-quest-desc-${questId}`}
          data-testid={`edit-quest-description-${questId}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Side Quest toggle */}
      <Label
        data-testid={`edit-quest-side-quest-label-${questId}`}
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
      >
        <Checkbox
          data-testid={`edit-quest-side-quest-toggle-${questId}`}
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
          data-testid={`edit-quest-cancel-${questId}`}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          data-testid={`edit-quest-submit-${questId}`}
          disabled={updateQuest.isPending || !name.trim()}
        >
          {updateQuest.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
