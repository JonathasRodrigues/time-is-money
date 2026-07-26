import { describe, expect, it } from 'vitest';
import { assertCapability, hasCapability, listCapabilities } from './index';

describe('permissions', () => {
  it('grants admin all capabilities', () => {
    expect(hasCapability('admin', 'members.manage')).toBe(true);
    expect(listCapabilities('admin').length).toBeGreaterThan(10);
  });

  it('blocks viewer from writing transactions', () => {
    expect(hasCapability('viewer', 'transactions.write')).toBe(false);
    expect(() => assertCapability('viewer', 'transactions.write')).toThrow(/Forbidden/);
  });

  it('allows editor to import but not manage members', () => {
    expect(hasCapability('editor', 'import.write')).toBe(true);
    expect(hasCapability('editor', 'members.manage')).toBe(false);
  });
});
