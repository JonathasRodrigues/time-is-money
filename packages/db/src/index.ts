import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

type SqlClient = ReturnType<typeof postgres>;
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as typeof globalThis & {
  __timPostgres?: SqlClient;
  __timDrizzle?: DrizzleDb;
};

/**
 * Singleton global — em Next/Turbopack o HMR recria módulos e, sem isso,
 * cada reload abre um pool novo até o Postgres estourar "too many clients".
 */
export function createDb(databaseUrl: string) {
  if (globalForDb.__timDrizzle) {
    return globalForDb.__timDrizzle;
  }

  const client =
    globalForDb.__timPostgres ??
    postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      prepare: false,
    });

  globalForDb.__timPostgres = client;
  const db = drizzle(client, { schema });
  globalForDb.__timDrizzle = db;
  return db;
}

export type Database = ReturnType<typeof createDb>;

export * from './schema/index';
export { seedHouseholdDefaults } from './seed';
