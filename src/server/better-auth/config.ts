import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

import { env } from "~/env";
import { db } from "~/server/db";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        if (resend) {
          await resend.emails.send({
            from: "onboarding@resend.dev",
            to: email,
            subject: "Your magic link",
            html: `<p>Click the link below to sign in:</p><p><a href="${url}">${url}</a></p>`,
          });
        } else {
          // Fallback: log to console in development when no API key is set
          console.log(`\n[Magic Link] To: ${email}\nURL: ${url}\nToken: ${token}\n`);
        }
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
