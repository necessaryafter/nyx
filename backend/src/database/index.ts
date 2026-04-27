import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { assets } from "./schema/assets";
import { templates, templatesRelations } from "./schema/templates";
import { jobs, jobsRelations } from "./schema/jobs";
import { creditTransactions, creditTransactionsRelations } from "./schema/credits";
import { integrations } from "./schema/integrations";
import { apiKeys } from "./schema/api-keys";
import {
  user, session, account, verification,
  userRelations, sessionRelations, accountRelations,
} from "./schema/auth";

const schema = {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
  assets,
  templates,
  templatesRelations,
  jobs,
  jobsRelations,
  creditTransactions,
  creditTransactionsRelations,
  integrations,
  apiKeys,
};

const client = postgres(process.env.DATABASE_URL!);

export const database = drizzle(client, { schema });
