import type { AuthSession } from '@tim/auth';
import type { Database } from '@tim/db';

export interface AppContext {
  db: Database;
  session: AuthSession | null;
  encryptionSecret: string;
}
