import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const envFiles = [
  resolve(monorepoRoot, 'apps/web/.env.local'),
  resolve(monorepoRoot, 'apps/web/.env'),
  resolve(monorepoRoot, '.env.local'),
  resolve(monorepoRoot, '.env'),
];

for (const path of envFiles) {
  if (existsSync(path)) {
    config({ path, override: false });
  }
}
