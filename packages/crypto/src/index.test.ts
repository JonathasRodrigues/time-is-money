import { describe, expect, it } from 'vitest';
import { decryptSensitiveField, encryptSensitiveField } from './index';

describe('crypto', () => {
  it('round-trips sensitive notes', () => {
    const secret = 'test-secret-key-please-change';
    const householdId = '11111111-1111-1111-1111-111111111111';
    const cipher = encryptSensitiveField('nota secreta', secret, householdId);
    expect(cipher).not.toContain('nota');
    expect(decryptSensitiveField(cipher, secret, householdId)).toBe('nota secreta');
  });
});
