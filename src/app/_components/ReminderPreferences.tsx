"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export function ReminderPreferences({ onClose }: { onClose: () => void }) {
  const { data: prefs, isLoading } = api.reminder.getReminderPreferences.useQuery();
  const utils = api.useUtils();

  const update = api.reminder.updateReminderPreferences.useMutation({
    onSuccess: () => void utils.reminder.getReminderPreferences.invalidate(),
  });

  const subscribeToPush = api.reminder.subscribeToPush.useMutation();
  const [pushStatus, setPushStatus] = useState<"idle" | "pending" | "granted" | "denied">("idle");

  async function handleEnablePush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      alert("Web Push is not supported in this browser.");
      return;
    }

    setPushStatus("pending");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushStatus("denied");
      return;
    }

    setPushStatus("granted");

    // Register a minimal service worker if not already registered
    const reg = await navigator.serviceWorker.register("/sw.js");

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — skipping push subscribe");
      return;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
    });

    const json = subscription.toJSON();
    if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
      subscribeToPush.mutate({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
    }
  }

  if (isLoading) {
    return (
      <div
        data-testid="reminder-preferences"
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      >
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a0533] p-5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-white" />
            <span className="text-sm text-white/30">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="reminder-preferences"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a0533] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Reminder Preferences</h2>
          <button
            data-testid="reminder-prefs-close"
            onClick={onClose}
            className="text-white/40 hover:text-white/70"
          >
            ✕
          </button>
        </div>

        {/* Enable/disable */}
        <label
          data-testid="reminder-enabled-label"
          className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
        >
          <span className="text-sm text-white/80">Enable reminders</span>
          <input
            type="checkbox"
            data-testid="reminder-enabled-toggle"
            checked={prefs?.enabled ?? true}
            onChange={(e) =>
              update.mutate({ enabled: e.target.checked })
            }
            className="h-5 w-5 accent-[hsl(280,100%,70%)]"
          />
        </label>

        {/* Frequency */}
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <label className="mb-2 block text-xs text-white/50">
            Reminder frequency (days between reminders)
          </label>
          <input
            type="range"
            data-testid="reminder-frequency-slider"
            min={1}
            max={14}
            step={1}
            defaultValue={prefs?.frequencyDays ?? 3}
            onMouseUp={(e) =>
              update.mutate({
                frequencyDays: parseInt(
                  (e.target as HTMLInputElement).value,
                  10,
                ),
              })
            }
            onTouchEnd={(e) =>
              update.mutate({
                frequencyDays: parseInt(
                  (e.target as HTMLInputElement).value,
                  10,
                ),
              })
            }
            className="w-full accent-[hsl(280,100%,70%)]"
          />
          <p className="mt-1 text-xs text-white/30">
            Every {prefs?.frequencyDays ?? 3} day{(prefs?.frequencyDays ?? 3) !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Push notification opt-in */}
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="mb-2 text-xs text-white/50">
            Push notifications are delivered directly to your browser.
          </p>
          {pushStatus === "granted" ? (
            <p className="text-xs text-green-400">
              ✓ Push notifications enabled
            </p>
          ) : pushStatus === "denied" ? (
            <p className="text-xs text-red-400">
              Notifications blocked. Enable them in your browser settings.
            </p>
          ) : (
            <button
              data-testid="enable-push-btn"
              onClick={() => void handleEnablePush()}
              disabled={pushStatus === "pending"}
              className="rounded border border-[hsl(280,100%,70%)]/30 bg-[hsl(280,100%,70%)]/10 px-4 py-2 text-sm text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/20 disabled:opacity-40"
            >
              {pushStatus === "pending" ? "Requesting permission…" : "Enable push notifications"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper: decode base64 url-safe VAPID key for push manager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
