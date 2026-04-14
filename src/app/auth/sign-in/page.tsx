"use client";

import { useState } from "react";
import { authClient } from "~/server/better-auth/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/",
    });

    if (authError) {
      setError(authError.message ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Executive Dysfunction{" "}
            <span className="text-[hsl(280,100%,70%)]">Planner</span>
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Your quest log awaits, Adventurer.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-xl bg-white/10 p-6 text-center">
            <div className="mb-3 text-3xl">📬</div>
            <h2 className="text-xl font-bold">Check your inbox</h2>
            <p className="mt-2 text-sm text-white/70">
              We sent a magic link to{" "}
              <span className="font-medium text-white">{email}</span>.
              Click it to sign in — no password needed.
            </p>
            <p className="mt-4 text-xs text-white/40">
              (In development, the link is printed to the server console.)
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-white/80">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[hsl(280,100%,70%)] focus:ring-1 focus:ring-[hsl(280,100%,70%)]"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="rounded-full bg-[hsl(280,100%,70%)] px-6 py-3 font-semibold text-white transition hover:bg-[hsl(280,100%,60%)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
