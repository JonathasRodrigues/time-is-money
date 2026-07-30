import type { AppContext } from '@tim/application';
import { getAuthSession } from './auth.js';
import { getDb, getEncryptionSecret } from './db.js';

export async function createAppContext(request: Request): Promise<AppContext> {
  const session = await getAuthSession(request);
  return {
    db: getDb(),
    session,
    encryptionSecret: getEncryptionSecret(),
  };
}
