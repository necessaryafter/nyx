import { betterAuth as createBetterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { database } from "../database";
import { account, session, user, verification } from "../database/schema/auth";

const discordEnabled = !!(
  process.env.DISCORD_CLIENT_ID &&
  process.env.DISCORD_CLIENT_SECRET
);

const googleEnabled = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
);

export const auth = createBetterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],
  database: drizzleAdapter(database, {
    provider: "pg",
    schema: {
      user: user,
      session: session,
      verification: verification,
      account: account,
    },
  }),
  socialProviders: {
    ...(discordEnabled && {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        redirectURI: process.env.DISCORD_REDIRECT_URI!,
        scope: ["identify", "email"],
      },
    }),
    ...(googleEnabled && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  ...(process.env.NODE_ENV === "production" && {
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
  }),
});

export type Auth = typeof auth;
