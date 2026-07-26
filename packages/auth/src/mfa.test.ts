import { describe, expect, it } from 'vitest';
import { resolveMfaSatisfied } from './index';

describe('resolveMfaSatisfied', () => {
  it('aceita bypass e claims', () => {
    expect(resolveMfaSatisfied({ bypass: true })).toBe(true);
    expect(resolveMfaSatisfied({ claimMfa: true })).toBe(true);
  });

  it('aceita MFA TOTP/backup do Clerk', () => {
    expect(resolveMfaSatisfied({ twoFactorEnabled: true })).toBe(true);
    expect(resolveMfaSatisfied({ totpEnabled: true })).toBe(true);
    expect(resolveMfaSatisfied({ backupCodeEnabled: true })).toBe(true);
  });

  it('aceita login social sem TOTP', () => {
    expect(resolveMfaSatisfied({ hasSocialLogin: true })).toBe(true);
  });

  it('rejeita senha sem MFA nem social', () => {
    expect(resolveMfaSatisfied({})).toBe(false);
    expect(
      resolveMfaSatisfied({
        twoFactorEnabled: false,
        totpEnabled: false,
        hasSocialLogin: false,
      }),
    ).toBe(false);
  });
});
