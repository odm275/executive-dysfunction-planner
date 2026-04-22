"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";

type Props = {
  objectiveName: string;
  difficulty: "HARD" | "LEGENDARY";
  onClose: () => void;
};

const DIFFICULTY_LABELS = {
  HARD: "Hard",
  LEGENDARY: "Legendary ✨",
};

const DIFFICULTY_COLOURS = {
  HARD: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  LEGENDARY: "border-purple-500/30 bg-purple-500/10 text-purple-300",
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
    <div
      data-testid="reward-chat"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col rounded-2xl border border-[hsl(280,100%,70%)]/20 bg-[#1a0533] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-bold text-white">
              {difficulty === "LEGENDARY" ? "🏆 Legendary Win!" : "⭐ Well Done!"}
            </h2>
            <p className="mt-0.5 text-xs text-white/40">
              Completed:{" "}
              <span className="font-medium text-white/60">{objectiveName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLOURS[difficulty]}`}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </span>
            <button
              data-testid="reward-chat-close"
              onClick={onClose}
              className="text-white/40 hover:text-white/70"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages — only show assistant messages to keep UI clean */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-80">
          {messages.length === 0 && !isLoading && !error && (
            <p className="text-sm text-white/30">Starting your celebration…</p>
          )}

          {error && (
            <p className="text-sm text-red-400">
              Something went wrong. Close and try again.
            </p>
          )}

          {messages
            .filter((m) => m.role === "assistant")
            .map((m) => (
              <div
                key={m.id}
                data-testid="reward-chat-assistant-msg"
                className="rounded-lg bg-[hsl(280,100%,70%)]/10 px-3 py-2 text-sm text-white/90"
              >
                {m.content}
              </div>
            ))}

          {/* Show user messages (reactions) after the first AI message */}
          {messages
            .filter((m) => m.role === "user")
            .slice(1) // skip the auto-trigger message
            .map((m) => (
              <div
                key={m.id}
                data-testid="reward-chat-user-msg"
                className="ml-8 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/70"
              >
                {m.content}
              </div>
            ))}

          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" />
              <span className="text-xs text-white/30">Thinking…</span>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          data-testid="reward-chat-form"
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-white/10 px-4 py-3"
        >
          <input
            data-testid="reward-chat-input"
            value={input}
            onChange={handleInputChange}
            placeholder="React or ask…"
            className="flex-1 rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-[hsl(280,100%,70%)]/40"
          />
          <button
            type="submit"
            data-testid="reward-chat-send"
            disabled={isLoading || !input.trim()}
            className="rounded bg-[hsl(280,100%,70%)]/20 px-4 py-2 text-sm font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/30 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
