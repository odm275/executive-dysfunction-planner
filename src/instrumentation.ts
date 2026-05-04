/**
 * Next.js Instrumentation Hook
 *
 * `register()` is called automatically by Next.js once when the server process
 * starts (both locally via `next start` and on Vercel cold starts), before any
 * requests are handled. This makes it a reliable place to run database
 * migrations.
 *
 * Why here instead of `postbuild`:
 * The previous approach ran `drizzle-kit migrate` as a postbuild script, which
 * executed at *build* time. On Vercel, builds can be cached and the postbuild
 * step skipped entirely when no source files changed — meaning new migrations
 * would never be applied unless a code change triggered a fresh build. Running
 * migrations at server startup guarantees they always run against the live
 * production database with the correct credentials.
 *
 * Safety:
 * - Drizzle tracks applied migrations in a `__drizzle_migrations` table, so
 *   this is idempotent — already-applied migrations are skipped with no
 *   overhead.
 * - This project uses a single Turso instance, so there is no risk of
 *   concurrent migration races across multiple server instances.
 */
export async function register() {
  // Only run on the Node.js server runtime, not in the Edge runtime or during
  // client-side bundling.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const { db } = await import("~/server/db");

  await migrate(db, { migrationsFolder: "./drizzle" });
}
