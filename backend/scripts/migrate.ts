// Aplica as migrations do drizzle (usado no deploy; drizzle-kit engole o erro real).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: `${import.meta.dir}/../src/database/migrations` });
await client.end();
console.log("migrations applied");
