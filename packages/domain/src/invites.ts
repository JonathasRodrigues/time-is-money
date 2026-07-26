/** Normaliza e-mail para comparação/armazenamento de convites. */
export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailsMatchForInvite(inviteEmail: string, userEmail: string | null): boolean {
  if (!userEmail) return false;
  return normalizeInviteEmail(inviteEmail) === normalizeInviteEmail(userEmail);
}

export function isInviteExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export const INVITE_TTL_DAYS = 7;

export function inviteExpiresAt(from: Date = new Date(), ttlDays = INVITE_TTL_DAYS): Date {
  return new Date(from.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}

export const MEMBER_ROLE_LABEL: Record<'admin' | 'editor' | 'viewer', string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Visualizador',
};
