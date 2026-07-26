#!/usr/bin/env node
import { createDb } from '@tim/db';
import { seedDemoWorld } from './seed';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const encryptionSecret = process.env.ENCRYPTION_SECRET;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL obrigatória');
  }
  if (!encryptionSecret) {
    throw new Error('ENCRYPTION_SECRET obrigatória');
  }

  const db = createDb(databaseUrl);
  const result = await seedDemoWorld(db, encryptionSecret);

  console.log('Demo seed OK');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nAbra /dashboard com DEMO_MODE=1');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
