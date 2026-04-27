import postgres from "postgres";
const sql = postgres("postgresql://studio:studio@localhost:5432/studio");
await sql`TRUNCATE TABLE templates CASCADE`;
console.log("Templates apagados.");
await sql.end();
