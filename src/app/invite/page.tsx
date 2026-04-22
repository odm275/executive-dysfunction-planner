import { Suspense } from "react";
import InvitePageContent from "./InvitePageContent";

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1a0533] to-[#0a0d1a] text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </main>
      }
    >
      <InvitePageContent />
    </Suspense>
  );
}
