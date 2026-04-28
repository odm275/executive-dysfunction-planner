"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
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

// ---------------------------------------------------------------------------
// ChapterRow — renders one chapter with inline rename + delete-confirm flows
// ---------------------------------------------------------------------------
function ChapterRow({
  chapter,
  onMutated,
}: {
  chapter: Chapter;
  onMutated: () => void;
}) {
  // ── Rename state ──────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(chapter.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const updateChapter = api.chapter.updateChapter.useMutation({
    onSuccess: () => {
      onMutated();
      setIsEditing(false);
    },
  });

  function startEdit() {
    setEditName(chapter.name);
    setIsEditing(true);
    setShowDeleteConfirm(false);
    updateChapter.reset();
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }

  function commitSave() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === chapter.name) {
      cancelEdit();
      return;
    }
    updateChapter.mutate({ id: chapter.id, name: trimmed });
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditName(chapter.name);
    updateChapter.reset();
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitSave();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  }

  function handleBlur() {
    if (!updateChapter.isPending) {
      cancelEdit();
    }
  }

  // ── Delete state ──────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteChapter = api.chapter.deleteChapter.useMutation({
    onSuccess: () => {
      onMutated();
    },
  });

  function openDeleteConfirm() {
    setShowDeleteConfirm(true);
    setIsEditing(false);
    deleteChapter.reset();
  }

  function confirmDelete() {
    deleteChapter.mutate({ id: chapter.id });
  }

  function cancelDelete() {
    setShowDeleteConfirm(false);
    deleteChapter.reset();
  }

  // ── Inline rename form ───────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Input
            ref={renameInputRef}
            data-testid={`chapter-rename-input-${chapter.id}`}
            value={editName}
            onChange={(e) => {
              setEditName(e.target.value);
              if (updateChapter.isError) updateChapter.reset();
            }}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleBlur}
            className="h-7 text-xs"
            disabled={updateChapter.isPending}
          />
          <Button
            size="sm"
            data-testid={`chapter-rename-save-btn-${chapter.id}`}
            aria-label="Save chapter name"
            onClick={commitSave}
            disabled={updateChapter.isPending || !editName.trim()}
            className="h-7 shrink-0 px-2 text-xs"
          >
            {updateChapter.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid={`chapter-rename-cancel-btn-${chapter.id}`}
            aria-label="Cancel renaming chapter"
            onMouseDown={(e) => {
              // Prevent blur from firing before click
              e.preventDefault();
            }}
            onClick={cancelEdit}
            disabled={updateChapter.isPending}
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          >
            <X className="size-3" />
            Cancel
          </Button>
        </div>
        {updateChapter.isError && (
          <p
            className="text-xs text-destructive"
            data-testid={`chapter-rename-error-${chapter.id}`}
          >
            {updateChapter.error.message ?? "Failed to rename chapter. Please try again."}
          </p>
        )}
      </div>
    );
  }

  // ── Inline delete confirmation ────────────────────────────────────────────
  if (showDeleteConfirm) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 rounded bg-destructive/10 px-2 py-1">
          <p
            className="flex-1 text-xs text-destructive"
            data-testid={`chapter-delete-warning-${chapter.id}`}
          >
            Delete &ldquo;{chapter.name}&rdquo; and all its objectives permanently?
          </p>
          <Button
            size="sm"
            variant="destructive"
            data-testid={`chapter-delete-confirm-btn-${chapter.id}`}
            aria-label="Confirm delete chapter"
            onClick={confirmDelete}
            disabled={deleteChapter.isPending}
            className="h-7 shrink-0 px-2 text-xs"
          >
            {deleteChapter.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Trash2 className="size-3" />
            )}
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid={`chapter-delete-cancel-btn-${chapter.id}`}
            aria-label="Cancel deleting chapter"
            onClick={cancelDelete}
            disabled={deleteChapter.isPending}
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          >
            <X className="size-3" />
            Cancel
          </Button>
        </div>
        {deleteChapter.isError && (
          <p
            className="text-xs text-destructive"
            data-testid={`chapter-delete-error-${chapter.id}`}
          >
            {deleteChapter.error.message ?? "Failed to delete chapter. Please try again."}
          </p>
        )}
      </div>
    );
  }

  // ── Default row view ──────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-1.5">
      <button
        data-testid={`chapter-name-label-${chapter.id}`}
        onClick={startEdit}
        className="flex-1 truncate text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
        aria-label={`Rename chapter: ${chapter.name}`}
      >
        {chapter.name}
      </button>
      <Button
        variant="ghost"
        size="sm"
        data-testid={`chapter-rename-btn-${chapter.id}`}
        aria-label={`Rename chapter: ${chapter.name}`}
        onClick={startEdit}
        className="h-6 shrink-0 px-1.5 text-xs text-muted-foreground"
      >
        <Pencil className="size-3" />
        Rename
      </Button>
      <Button
        variant="ghost"
        size="sm"
        data-testid={`chapter-delete-btn-${chapter.id}`}
        aria-label={`Delete chapter: ${chapter.name}`}
        onClick={openDeleteConfirm}
        className="h-6 shrink-0 px-1.5 text-xs text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3" />
        Delete
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChapterManager — create flow + chapter rows
// ---------------------------------------------------------------------------
export function ChapterManager({ questId, chapters }: ChapterManagerProps) {
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

  function handleMutated() {
    void utils.quest.listActiveQuests.invalidate();
  }

  return (
    <div
      className="mb-3 px-2"
      data-testid={`chapter-manager-${questId}`}
    >
      {/* Existing chapter rows */}
      {chapters.length > 0 && (
        <div className="mb-2 space-y-1">
          {chapters.map((ch) => (
            <ChapterRow key={ch.id} chapter={ch} onMutated={handleMutated} />
          ))}
        </div>
      )}

      {/* Add chapter form */}
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
