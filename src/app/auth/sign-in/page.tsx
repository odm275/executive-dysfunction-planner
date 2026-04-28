"use client";

import { useState } from "react";
import { authClient } from "~/server/better-auth/client";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

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
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl" aria-hidden>
            🗝️
          </div>
          <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight">
            Executive Dysfunction{" "}
            <span className="bg-gradient-to-br from-primary to-chart-2 bg-clip-text text-transparent">
              Planner
            </span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your quest log awaits, Adventurer.
          </p>
        </div>

        {submitted ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="mb-3 text-4xl">📬</div>
              <h2 className="font-heading text-xl font-semibold">Check your inbox</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a magic link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Click it to sign in — no password needed.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                (In development, the link is printed to the server console.)
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full"
                >
                  {loading ? "Sending…" : "Send magic link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
