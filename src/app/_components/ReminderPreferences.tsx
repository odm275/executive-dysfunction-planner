"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";

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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="reminder-preferences"
        className="max-w-sm"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Reminder Preferences</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              data-testid="reminder-prefs-close"
              onClick={onClose}
            >
              ✕
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Enable/disable */}
            <Label
              data-testid="reminder-enabled-label"
              className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-4 py-3"
            >
              <span className="text-sm">Enable reminders</span>
              <Checkbox
                data-testid="reminder-enabled-toggle"
                checked={prefs?.enabled ?? true}
                onCheckedChange={(checked) =>
                  update.mutate({ enabled: Boolean(checked) })
                }
              />
            </Label>

            {/* Frequency */}
            <div className="rounded-lg border border-border px-4 py-3">
              <Label className="mb-2 block text-xs text-muted-foreground">
                Reminder frequency (days between reminders)
              </Label>
              <Slider
                data-testid="reminder-frequency-slider"
                min={1}
                max={14}
                step={1}
                defaultValue={prefs?.frequencyDays ?? 3}
                onValueCommitted={(value) =>
                  update.mutate({ frequencyDays: value as number })
                }
                className="w-full"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Every {prefs?.frequencyDays ?? 3} day{(prefs?.frequencyDays ?? 3) !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Push notification opt-in */}
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Push notifications are delivered directly to your browser.
              </p>
              {pushStatus === "granted" ? (
                <Alert>
                  <AlertDescription className="text-xs text-green-700 dark:text-green-400">
                    ✓ Push notifications enabled
                  </AlertDescription>
                </Alert>
              ) : pushStatus === "denied" ? (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">
                    Notifications blocked. Enable them in your browser settings.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  variant="outline"
                  data-testid="enable-push-btn"
                  onClick={() => void handleEnablePush()}
                  disabled={pushStatus === "pending"}
                >
                  {pushStatus === "pending" ? (
                    <><Loader2 className="size-4 animate-spin" /> Requesting permission…</>
                  ) : (
                    "Enable push notifications"
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
