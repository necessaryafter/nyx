import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { creditTransactions } from "../src/database/schema/credits";
import { user } from "../src/database/schema/auth";

const AMOUNT = Number(process.argv[2] ?? 90000);

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const users = await db.select({ id: user.id, email: user.email }).from(user);

if (users.length === 0) {
  console.log("No users found.");
  await client.end();
  process.exit(0);
}

await db.insert(creditTransactions).values(
  users.map((u) => ({ userId: u.id, amount: AMOUNT, reason: "purchase" as const }))
);

for (const u of users) {
  console.log(`Added ${AMOUNT} credits to ${u.email}`);
}

await client.end();
