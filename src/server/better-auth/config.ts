import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

import { db } from "~/server/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        // In development, log the magic link to the console
        // In production, replace with a real email provider (e.g. Resend)
        console.log(`\n[Magic Link] To: ${email}\nURL: ${url}\nToken: ${token}\n`);
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
