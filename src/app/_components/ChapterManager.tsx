"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type Chapter = {
  id: number;
  name: string;
  order: number;
};

interface ChapterManagerProps {
  questId: number;
  chapters: Chapter[];
}

export function ChapterManager({ questId, chapters: _chapters }: ChapterManagerProps) {
  const utils = api.useUtils();

  // ── Create flow state ──────────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const createChapter = api.chapter.createChapter.useMutation({
    onSuccess: () => {
      void utils.quest.listActiveQuests.invalidate();
      setNewName("");
      setShowAddForm(false);
    },
  });

  function openAddForm() {
    setShowAddForm(true);
    setNewName("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSave() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createChapter.mutate({ questId, name: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setShowAddForm(false);
      setNewName("");
    }
  }

  function handleCancel() {
    setShowAddForm(false);
    setNewName("");
    createChapter.reset();
  }

  return (
    <div
      className="mb-3 px-2"
      data-testid={`chapter-manager-${questId}`}
    >
      {!showAddForm ? (
        <Button
          variant="ghost"
          size="sm"
          data-testid={`chapter-add-btn-${questId}`}
          aria-label="Add chapter"
          onClick={openAddForm}
          className="h-auto px-2 py-0.5 text-xs text-muted-foreground"
        >
          <Plus className="size-3" />
          Add
        </Button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Input
              ref={inputRef}
              data-testid={`chapter-name-input-${questId}`}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (createChapter.isError) createChapter.reset();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Chapter name"
              className="h-7 text-xs"
              disabled={createChapter.isPending}
            />
            <Button
              size="sm"
              data-testid={`chapter-save-btn-${questId}`}
              aria-label="Save chapter"
              onClick={handleSave}
              disabled={createChapter.isPending || !newName.trim()}
              className="h-7 px-2 text-xs"
            >
              {createChapter.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-testid={`chapter-cancel-btn-${questId}`}
              aria-label="Cancel adding chapter"
              onClick={handleCancel}
              disabled={createChapter.isPending}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              <X className="size-3" />
              Cancel
            </Button>
          </div>
          {createChapter.isError && (
            <p
              className="text-xs text-destructive"
              data-testid={`chapter-error-${questId}`}
            >
              {createChapter.error.message ?? "Failed to create chapter. Please try again."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
