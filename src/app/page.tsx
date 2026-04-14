import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await getSession();

  // Middleware handles unauthenticated redirect, but this is a safety net
  if (!session) {
    redirect("/auth/sign-in");
  }

  async function signOut() {
    "use server";
    await auth.api.signOut({
      headers: await headers(),
    });
    redirect("/auth/sign-in");
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white">
        <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Executive Dysfunction{" "}
            <span className="text-[hsl(280,100%,70%)]">Planner</span>
          </h1>

          <p className="text-xl text-white/70">
            Welcome back, Adventurer.{" "}
            <span className="font-semibold text-white">
              {session.user.name ?? session.user.email}
            </span>
          </p>

          <p className="text-sm text-white/40">
            World Map coming soon — Quest Engine is being forged.
          </p>

          <form>
            <button
              formAction={signOut}
              className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    </HydrateClient>
  );
}
