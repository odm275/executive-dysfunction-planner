"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        {!token ? (
          <>
            <h1 className="text-xl font-bold text-red-400">Invalid Link</h1>
            <p className="mt-2 text-sm text-white/50">
              No invite token found. Ask the Adventurer to resend the link.
            </p>
          </>
        ) : status === "accepting" ? (
          <>
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm text-white/50">Joining quest…</p>
          </>
        ) : status === "success" ? (
          <>
            <p className="text-4xl">🎉</p>
            <h1 className="mt-3 text-xl font-bold text-white">You&apos;re in!</h1>
            <p className="mt-2 text-sm text-white/50">
              You&apos;ve been added as a collaborator. Head to your dashboard to see your objective.
            </p>
            <a
              href="/"
              className="mt-4 inline-block rounded-lg bg-[hsl(280,100%,70%)]/20 px-5 py-2.5 text-sm font-medium text-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,70%)]/30"
            >
              Go to Dashboard
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-red-400">Something went wrong</h1>
            <p className="mt-2 text-sm text-white/50">{errorMsg}</p>
            <a
              href="/"
              className="mt-4 inline-block text-sm text-white/40 hover:text-white/60"
            >
              Back to home
            </a>
          </>
        )}
      </div>
    </main>
  );
}
