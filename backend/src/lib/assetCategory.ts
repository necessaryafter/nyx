import { eq, isNull, type SQL } from "drizzle-orm";
import { assets } from "../database/schema/assets";

/** Valor do filtro ?category= que seleciona só os assets avulsos (sem categoria). */
export const NO_CATEGORY = "__none__";

/** "  prensa  " -> "prensa"; vazio/ausente -> null (avulso). */
export function normalizeCategory(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  return clean === "" || clean === NO_CATEGORY ? null : clean;
}

/** Condição SQL do filtro ?category=: undefined = todas, NO_CATEGORY = avulsos, senão o nome exato. */
export function categoryCondition(category: string | undefined): SQL | undefined {
  if (category === undefined || category === "") return undefined;
  if (category === NO_CATEGORY) return isNull(assets.category);
  return eq(assets.category, category);
}
