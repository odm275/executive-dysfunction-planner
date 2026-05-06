import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { HydrateClient } from "~/trpc/server";
import { WarTableClient } from "~/app/_components/WarTableClient";

export default async function TodayPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/sign-in");
  }

  return (
    <HydrateClient>
      <WarTableClient />
    </HydrateClient>
  );
}
