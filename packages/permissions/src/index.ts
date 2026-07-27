export type Role = 'admin' | 'editor' | 'viewer';

export type Capability =
  | 'household.manage'
  | 'members.manage'
  | 'settings.write'
  | 'settings.read'
  | 'transactions.read'
  | 'transactions.write'
  | 'financings.read'
  | 'financings.write'
  | 'plans.read'
  | 'plans.write'
  | 'import.write'
  | 'export.read'
  | 'jarvis.chat'
  | 'jarvis.mutate'
  | 'audit.read'
  | 'dashboard.read';

const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set([
    'household.manage',
    'members.manage',
    'settings.write',
    'settings.read',
    'transactions.read',
    'transactions.write',
    'financings.read',
    'financings.write',
    'plans.read',
    'plans.write',
    'import.write',
    'export.read',
    'jarvis.chat',
    'jarvis.mutate',
    'audit.read',
    'dashboard.read',
  ]),
  editor: new Set([
    'settings.write',
    'settings.read',
    'transactions.read',
    'transactions.write',
    'financings.read',
    'financings.write',
    'plans.read',
    'plans.write',
    'import.write',
    'export.read',
    'jarvis.chat',
    'jarvis.mutate',
    'dashboard.read',
  ]),
  viewer: new Set([
    'settings.read',
    'transactions.read',
    'financings.read',
    'plans.read',
    'export.read',
    'jarvis.chat',
    'dashboard.read',
  ]),
};

export function hasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export function assertCapability(role: Role, capability: Capability): void {
  if (!hasCapability(role, capability)) {
    throw new Error(`Forbidden: role "${role}" lacks capability "${capability}"`);
  }
}

export function listCapabilities(role: Role): Capability[] {
  return [...ROLE_CAPABILITIES[role]];
}
