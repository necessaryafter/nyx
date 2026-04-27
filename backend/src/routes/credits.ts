import { Elysia } from "elysia";
import { eq, and, sum, desc, count, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../auth/session";
import { database } from "../database";
import { creditTransactions } from "../database/schema/credits";
import { paginationSchema, creditFilterSchema } from "../lib/schemas";

export const creditRoutes = new Elysia({ prefix: "/api/credits" })
  .use(requireAuth)

  // Get credit balance
  .get("/balance", async ({ session }) => {
    const [result] = await database
      .select({ total: sum(creditTransactions.amount) })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, session.user.id));

    return { balance: Number(result?.total ?? 0) };
  })

  // List credit history (paginated + filtered)
  .get("/history", async ({ session, query, set }) => {
    const pagination = paginationSchema.safeParse(query);
    if (!pagination.success) {
      set.status = 400;
      return { error: "invalid pagination", details: pagination.error.flatten() };
    }
    const { limit, offset } = pagination.data;

    const filters = creditFilterSchema.safeParse(query);
    if (!filters.success) {
      set.status = 400;
      return { error: "invalid filters", details: filters.error.flatten() };
    }

    const userId = session.user.id;

    const { reason, from, to } = filters.data;
    const conditions = [eq(creditTransactions.userId, userId)];

    if (reason) {
      conditions.push(eq(creditTransactions.reason, reason));
    }
    if (from) {
      conditions.push(gte(creditTransactions.createdAt, new Date(from)));
    }
    if (to) {
      // Add 1 day to include the entire "to" date
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      conditions.push(lte(creditTransactions.createdAt, toDate));
    }

    const where = and(...conditions);

    const [rows, [total]] = await Promise.all([
      database
        .select()
        .from(creditTransactions)
        .where(where)
        .orderBy(desc(creditTransactions.createdAt))
        .limit(limit)
        .offset(offset),
      database
        .select({ count: count() })
        .from(creditTransactions)
        .where(where),
    ]);

    return { data: rows, total: total!.count, limit, offset };
  })

  // Breakdown by month and reason
  .get("/breakdown", async ({ session }) => {
    const rows = await database
      .select({
        month: sql<string>`to_char(${creditTransactions.createdAt}, 'YYYY-MM')`,
        reason: creditTransactions.reason,
        total: sum(creditTransactions.amount),
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, session.user.id))
      .groupBy(
        sql`to_char(${creditTransactions.createdAt}, 'YYYY-MM')`,
        creditTransactions.reason,
      )
      .orderBy(sql`to_char(${creditTransactions.createdAt}, 'YYYY-MM')`);

    const breakdown: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      if (!breakdown[row.month]) breakdown[row.month] = {};
      breakdown[row.month][row.reason] = Number(row.total ?? 0);
    }

    return Object.entries(breakdown).map(([month, reasons]) => ({
      month,
      ...reasons,
    }));
  });
