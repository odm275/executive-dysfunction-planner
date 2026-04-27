"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export default function InvitePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const acceptInvite = api.collaboration.acceptInvite.useMutation({
    onSuccess: () => setStatus("success"),
    onError: (err) => {
      setErrorMsg(err.message);
      setStatus("error");
    },
  });

  useEffect(() => {
    if (token && status === "idle") {
      setStatus("accepting");
      acceptInvite.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm text-center">
        <CardContent className="pt-6">
          {!token ? (
            <Alert variant="destructive">
              <AlertTitle>Invalid Link</AlertTitle>
              <AlertDescription>
                No invite token found. Ask the Adventurer to resend the link.
              </AlertDescription>
            </Alert>
          ) : status === "accepting" ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Joining quest…</p>
            </div>
          ) : status === "success" ? (
            <>
              <p className="text-4xl">🎉</p>
              <h1 className="mt-3 text-xl font-bold">You&apos;re in!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;ve been added as a collaborator. Head to your dashboard to see your objective.
              </p>
              <Button
                className="mt-4"
                onClick={() => { window.location.href = "/"; }}
              >
                Go to Dashboard
              </Button>
            </>
          ) : (
            <>
              <Alert variant="destructive">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => { window.location.href = "/"; }}
              >
                Back to home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
