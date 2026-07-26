import { describe, expect, it } from 'vitest';
import {
  emailsMatchForInvite,
  inviteExpiresAt,
  isInviteExpired,
  normalizeInviteEmail,
} from './invites';

describe('invites domain', () => {
  it('normalizes email', () => {
    expect(normalizeInviteEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('matches invite email ignoring case', () => {
    expect(emailsMatchForInvite('a@b.com', 'A@B.COM')).toBe(true);
    expect(emailsMatchForInvite('a@b.com', null)).toBe(false);
    expect(emailsMatchForInvite('a@b.com', 'other@b.com')).toBe(false);
  });

  it('detects expiry', () => {
    const now = new Date('2026-07-26T12:00:00Z');
    expect(isInviteExpired(new Date('2026-07-26T11:00:00Z'), now)).toBe(true);
    expect(isInviteExpired(new Date('2026-07-27T12:00:00Z'), now)).toBe(false);
  });

  it('computes ttl', () => {
    const from = new Date('2026-07-26T00:00:00Z');
    const expires = inviteExpiresAt(from, 7);
    expect(expires.toISOString()).toBe('2026-08-02T00:00:00.000Z');
  });
});
