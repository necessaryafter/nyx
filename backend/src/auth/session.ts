import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { database } from "../database";
import { apiKeys } from "../database/schema/api-keys";
import { user } from "../database/schema/auth";

async function resolveApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer nyx_")) return null;
  const raw = authHeader.slice("Bearer ".length);
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  const rows = await database
    .select({ id: apiKeys.id, userId: apiKeys.userId })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!rows.length) return null;

  const { id, userId } = rows[0];

  // Update lastUsedAt without blocking the request
  database.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id)).catch(() => {});

  const userRows = await database
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userRows.length) return null;

  return { user: userRows[0], session: null };
}

export const sessionMiddleware = new Elysia({ name: "session" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return { session };
  });

export const requireAuth = new Elysia({ name: "requireAuth" })
  .derive(async ({ request, set }) => {
    const authHeader = request.headers.get("authorization");
    const apiKeySession = await resolveApiKey(authHeader);
    if (apiKeySession) {
      return { session: apiKeySession };
    }

    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session) {
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { session };
  })
  .as("scoped");
