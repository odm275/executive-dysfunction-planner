"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";

type Props = {
  objectiveName: string;
  difficulty: "HARD" | "LEGENDARY";
  onClose: () => void;
};

const DIFFICULTY_LABELS = {
  HARD: "Hard",
  LEGENDARY: "Legendary ✨",
};

const DIFFICULTY_BADGE_VARIANTS: Record<"HARD" | "LEGENDARY", "hard" | "legendary"> = {
  HARD: "hard",
  LEGENDARY: "legendary",
};

export function RewardChat({ objectiveName, difficulty, onClose }: Props) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, append } =
    useChat({
      api: "/api/reward-chat",
      body: { objectiveName, difficulty },
    });

  const triggered = useRef(false);

  // Kick off the conversation automatically when the chat mounts
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    void append({
      role: "user",
      content: `I just completed: "${objectiveName}"`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="reward-chat"
        className="flex max-w-md flex-col"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>
                {difficulty === "LEGENDARY" ? "🏆 Legendary Win!" : "⭐ Well Done!"}
              </DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Completed:{" "}
                <span className="font-medium">{objectiveName}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={DIFFICULTY_BADGE_VARIANTS[difficulty]}>
                {DIFFICULTY_LABELS[difficulty]}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                data-testid="reward-chat-close"
                onClick={onClose}
              >
                ✕
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Messages — only show assistant messages to keep UI clean */}
        <div className="flex-1 overflow-y-auto space-y-3 max-h-80 py-2">
          {messages.length === 0 && !isLoading && !error && (
            <p className="text-sm text-muted-foreground">Starting your celebration…</p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>Something went wrong. Close and try again.</AlertDescription>
            </Alert>
          )}

          {messages
            .filter((m) => m.role === "assistant")
            .map((m) => (
              <div
                key={m.id}
                data-testid="reward-chat-assistant-msg"
                className="rounded-lg bg-muted px-3 py-2 text-sm"
              >
                {m.content}
              </div>
            ))}

          {messages
            .filter((m) => m.role === "user")
            .slice(1)
            .map((m) => (
              <div
                key={m.id}
                data-testid="reward-chat-user-msg"
                className="ml-8 rounded-lg bg-muted/50 px-3 py-2 text-sm"
              >
                {m.content}
              </div>
            ))}

          {isLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Thinking…</span>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          data-testid="reward-chat-form"
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-border pt-3"
        >
          <Input
            data-testid="reward-chat-input"
            value={input}
            onChange={handleInputChange}
            placeholder="React or ask…"
            className="flex-1"
          />
          <Button
            type="submit"
            data-testid="reward-chat-send"
            disabled={isLoading || !input.trim()}
          >
            Send
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
