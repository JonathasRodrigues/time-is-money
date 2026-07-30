import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

type PostgresClient = ReturnType<typeof postgres>;
type PostgresDb = ReturnType<typeof drizzlePostgres<typeof schema>>;
type NeonDb = ReturnType<typeof drizzleNeon<typeof schema>>;

export type Database = PostgresDb | NeonDb;

/** Database client or an open transaction (for seeds / multi-step writes). */
export type DbClient = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

const globalForDb = globalThis as typeof globalThis & {
  __timPostgres?: PostgresClient;
  __timNeonPool?: Pool;
  __timDrizzle?: Database;
};

function isNeonUrl(databaseUrl: string): boolean {
  return /neon\.tech|neon\.build/i.test(databaseUrl);
}

function withSslMode(databaseUrl: string): string {
  if (!isNeonUrl(databaseUrl)) return databaseUrl;
  try {
    const url = new URL(databaseUrl);
    if (!url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }
    return url.toString();
  } catch {
    return databaseUrl.includes('sslmode=')
      ? databaseUrl
      : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require`;
  }
}

/**
 * Singleton global — em Next/Turbopack o HMR recria módulos e, sem isso,
 * cada reload abre um pool novo até o Postgres estourar "too many clients".
 *
 * Neon (Vercel): WebSocket pool via @neondatabase/serverless.
 * Local Postgres: postgres.js TCP.
 */
export function createDb(databaseUrl: string): Database {
  if (globalForDb.__timDrizzle) {
    return globalForDb.__timDrizzle;
  }

  const url = withSslMode(databaseUrl);

  if (isNeonUrl(url)) {
    // Node ≥ 22 já expõe WebSocket global
    if (typeof WebSocket !== 'undefined') {
      neonConfig.webSocketConstructor = WebSocket;
    }
    const pool = globalForDb.__timNeonPool ?? new Pool({ connectionString: url, max: 1 });
    globalForDb.__timNeonPool = pool;
    const db = drizzleNeon(pool, { schema });
    globalForDb.__timDrizzle = db;
    return db;
  }

  const client =
    globalForDb.__timPostgres ??
    postgres(url, {
      max: 5,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      prepare: false,
    });

  globalForDb.__timPostgres = client;
  const db = drizzlePostgres(client, { schema });
  globalForDb.__timDrizzle = db;
  return db;
}

export * from './schema/index';
export { seedHouseholdDefaults } from './seed';
