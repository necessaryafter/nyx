import { Elysia } from "elysia";
import { eq, and, or, desc, count } from "drizzle-orm";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { templates } from "../database/schema/templates";
import { createTemplateSchema, updateTemplateSchema, validateGraphStructure, paginationSchema } from "../lib/schemas";

export const templateRoutes = new Elysia({ prefix: "/api/templates" })
  .use(requireAuth)

  // Create template
  .post("/", async ({ body, session, set }) => {
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    if (parsed.data.graph.nodes.length > 0) {
      const structErrors = validateGraphStructure(parsed.data.graph as Parameters<typeof validateGraphStructure>[0], { requireAssets: false });
      if (structErrors.length > 0) {
        set.status = 400;
        return { error: "invalid graph structure", details: structErrors };
      }
    }

    const [row] = await database
      .insert(templates)
      .values({
        userId: session.user.id,
        name: parsed.data.name,
        graph: parsed.data.graph,
      })
      .returning();

    set.status = 201;
    return row;
  })

  // List user templates (paginated)
  .get("/", async ({ session, query, set }) => {
    const pagination = paginationSchema.safeParse(query);
    if (!pagination.success) {
      set.status = 400;
      return { error: "invalid pagination", details: pagination.error.flatten() };
    }
    const { limit, offset } = pagination.data;
    const userId = session.user.id;

    const [rows, [total]] = await Promise.all([
      database
        .select()
        .from(templates)
        .where(eq(templates.userId, userId))
        .orderBy(desc(templates.updatedAt))
        .limit(limit)
        .offset(offset),
      database
        .select({ count: count() })
        .from(templates)
        .where(eq(templates.userId, userId)),
    ]);

    return { data: rows, total: total!.count, limit, offset };
  })

  // Get template by ID (owner or public)
  .get("/:id", async ({ params, session, set }) => {
    const [row] = await database
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.id, params.id),
          or(eq(templates.userId, session.user.id), eq(templates.isPublic, true)),
        ),
      )
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: "template not found" };
    }

    return row;
  })

  // Update template
  .put("/:id", async ({ params, body, session, set }) => {
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "invalid fields", details: parsed.error.flatten() };
    }

    if (parsed.data.graph && parsed.data.graph.nodes.length > 0) {
      const structErrors = validateGraphStructure(parsed.data.graph as Parameters<typeof validateGraphStructure>[0], { requireAssets: false });
      
      if (structErrors.length > 0) {
        set.status = 400;
        return { error: "invalid graph structure", details: structErrors };
      }
    }

    const [existing] = await database
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.id, params.id), eq(templates.userId, session.user.id)))
      .limit(1);

    if (!existing) {
      set.status = 404;
      return { error: "template not found" };
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.graph !== undefined) updates.graph = parsed.data.graph;

    if (Object.keys(updates).length === 0) {
      set.status = 400;
      return { error: "no fields to update" };
    }

    const [row] = await database
      .update(templates)
      .set(updates)
      .where(eq(templates.id, params.id))
      .returning();

    return row;
  })

  // Delete template
  .delete("/:id", async ({ params, session, set }) => {
    const [existing] = await database
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.id, params.id), eq(templates.userId, session.user.id)))
      .limit(1);

    if (!existing) {
      set.status = 404;
      return { error: "template not found" };
    }

    await database.delete(templates).where(eq(templates.id, params.id));

    return { deleted: true };
  });
