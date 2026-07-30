import { createDb, type Database } from '@tim/db';
import { env } from './env.js';

const globalForDb = globalThis as typeof globalThis & {
  __timApiDb?: Database;
};

export function getDb(): Database {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada');
  }
  if (!globalForDb.__timApiDb) {
    globalForDb.__timApiDb = createDb(env.DATABASE_URL);
  }
  return globalForDb.__timApiDb;
}

export function getEncryptionSecret(): string {
  if (!env.ENCRYPTION_SECRET) {
    throw new Error('ENCRYPTION_SECRET não configurada');
  }
  return env.ENCRYPTION_SECRET;
}
