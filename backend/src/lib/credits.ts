import { eq, sum } from "drizzle-orm";
import { database } from "../database";
import { creditTransactions } from "../database/schema/credits";

export const RENDER_CREDITS_PER_MIN = Number(process.env.RENDER_CREDITS_PER_MIN ?? 10);
export const TTS_CREDITS_PER_MIN = Number(process.env.TTS_CREDITS_PER_MIN ?? 5);

export async function getBalance(userId: string): Promise<number> {
  const [result] = await database
    .select({ total: sum(creditTransactions.amount) })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId));

  return Number(result?.total ?? 0);
}

export async function debitCredits(
  userId: string,
  amount: number,
  reason: "render" | "tts" | "purchase",
  jobId?: string,
): Promise<void> {
  await database.insert(creditTransactions).values({
    userId,
    amount: -amount,
    reason,
    jobId,
  });
}
