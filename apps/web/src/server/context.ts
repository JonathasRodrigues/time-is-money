import type { AppContext } from '@tim/application';
import { getAuthSession, getDb, getEncryptionSecret } from '@/server/db';

export async function createAppContext(): Promise<AppContext> {
  const session = await getAuthSession();
  return {
    db: getDb(),
    session,
    encryptionSecret: getEncryptionSecret(),
  };
}
