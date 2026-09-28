import { mock } from "bun:test";

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Every method returns `this`, and `await` resolves to `resolveValue`.
 */
export function chainResult(value: unknown = []) {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    "select", "from", "where", "leftJoin", "orderBy", "limit", "offset",
    "insert", "values", "returning",
    "update", "set",
    "delete",
    "groupBy",
  ];

  for (const method of chainMethods) {
    builder[method] = mock(() => builder);
  }

  // Make it thenable so `await` resolves to `value`
  builder.then = (resolve: (v: unknown) => unknown) => resolve(value);

  return builder;
}

/**
 * Creates the mock database object with top-level methods.
 */
export function createMockDatabase() {
  const db: Record<string, unknown> = {
    select: mock(() => chainResult([])),
    insert: mock(() => chainResult([])),
    update: mock(() => chainResult([])),
    delete: mock(() => chainResult(undefined)),
    transaction: mock(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(db);
    }),
  };
  return db;
}

export type MockDatabase = ReturnType<typeof createMockDatabase>;
