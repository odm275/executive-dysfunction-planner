import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { HydrateClient } from "~/trpc/server";
import { WorldMapClient } from "~/app/_components/WorldMapClient";

export default async function Home() {
  const session = await getSession();

  // Middleware handles unauthenticated redirect, but this is a safety net
  if (!session) {
    redirect("/auth/sign-in");
  }

  return (
    <HydrateClient>
      <WorldMapClient />
    </HydrateClient>
  );
}
