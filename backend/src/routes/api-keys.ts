import { Elysia, t } from "elysia";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { apiKeys } from "../database/schema/api-keys";

const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);

async function hashKey(raw: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `nyx_${hex}`;
}

export const apiKeyRoutes = new Elysia({ prefix: "/api/api-keys" })
  .use(requireAuth)

  // List API keys (never returns the key value)
  .get("/", async ({ session }) => {
    const rows = await database
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, session.user.id));

    return rows;
  })

  // Create a new API key (returns plaintext once — admin only)
  .post(
    "/",
    async ({ session, body, set }) => {
      if (adminIds.length > 0 && !adminIds.includes(session.user.id)) {
        set.status = 403;
        return { error: "forbidden" };
      }

      const raw = generateKey();
      const keyHash = await hashKey(raw);

      await database.insert(apiKeys).values({
        userId: session.user.id,
        name: body.name,
        keyHash,
      });

      return { key: raw, name: body.name };
    },
    { body: t.Object({ name: t.String({ minLength: 1 }) }) },
  )

  // Revoke an API key
  .delete(
    "/:id",
    async ({ session, params }) => {
      await database
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, params.id), eq(apiKeys.userId, session.user.id)));

      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  );
