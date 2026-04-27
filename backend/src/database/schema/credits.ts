import { pgTable, pgEnum, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { jobs } from "./jobs";

export const creditReasonEnum = pgEnum("credit_reason", ["render", "tts", "purchase", "refund"]);

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: creditReasonEnum("reason").notNull(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (transaction) => [
  index("credit_transactions_user_id_idx").on(transaction.userId),
]);

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  job: one(jobs, {
    fields: [creditTransactions.jobId],
    references: [jobs.id],
  }),
}));
