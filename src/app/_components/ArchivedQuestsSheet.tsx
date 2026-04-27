"use client";

import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";

// ---------------------------------------------------------------------------
// ArchivedQuestsSheet
// ---------------------------------------------------------------------------
export function ArchivedQuestsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();

  const { data: archivedQuests, isLoading } = api.quest.listArchivedQuests.useQuery(
    undefined,
    { enabled: open },
  );

  const deleteQuest = api.quest.deleteQuest.useMutation({
    onSuccess: () => {
      void utils.quest.listArchivedQuests.invalidate();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="archived-quests-sheet"
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>🗂 Archives</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !archivedQuests || archivedQuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-semibold text-muted-foreground">
                No archived quests yet.
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                Quests you archive will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {archivedQuests.map((q) => (
                <div
                  key={q.id}
                  data-testid={`archived-quest-item-${q.id}`}
                  className="rounded-lg border border-border bg-muted/20 p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{q.name}</p>
                      {q.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {q.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`delete-archived-quest-btn-${q.id}`}
                      onClick={() => deleteQuest.mutate({ id: q.id })}
                      disabled={deleteQuest.isPending}
                      className="shrink-0 h-auto px-2 py-0.5 text-xs text-destructive/60 hover:text-destructive"
                    >
                      {deleteQuest.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        "Delete permanently"
                      )}
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {q.objectives.length} objective
                    {q.objectives.length !== 1 ? "s" : ""}
                    {q.updatedAt && (
                      <span className="ml-2 text-muted-foreground/60">
                        · archived{" "}
                        {new Date(q.updatedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  {q.objectives.length > 0 && (
                    <>
                      <Separator className="my-2" />
                      <ul className="space-y-1">
                        {q.objectives.slice(0, 5).map((obj) => (
                          <li
                            key={obj.id}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground"
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                obj.isCompleted ? "bg-green-400" : "bg-border"
                              }`}
                            />
                            <span
                              className={
                                obj.isCompleted ? "line-through" : ""
                              }
                            >
                              {obj.name}
                            </span>
                          </li>
                        ))}
                        {q.objectives.length > 5 && (
                          <li className="text-xs text-muted-foreground/50">
                            +{q.objectives.length - 5} more
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
