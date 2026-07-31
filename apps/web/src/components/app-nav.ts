import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Building2,
  FolderTree,
  HandCoins,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  SlidersHorizontal,
  Target,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';

export type PaymentsFlow = 'pay' | 'receive';

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Fluxo em /payments — itens irmãos, não aba da outra tela. */
  paymentsFlow?: PaymentsFlow;
};

export const primaryNav: AppNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/payments', label: 'Contas a pagar', icon: Wallet, paymentsFlow: 'pay' },
  { href: '/payments', label: 'Contas a receber', icon: HandCoins, paymentsFlow: 'receive' },
  { href: '/wealth', label: 'Patrimônio', icon: Landmark },
  { href: '/transactions', label: 'Extrato', icon: ArrowLeftRight },
  { href: '/financings', label: 'Financiamentos', icon: PiggyBank },
  { href: '/planning', label: 'Planejamento', icon: Target },
];

/** Atalhos fixos na barra flutuante mobile (o centro abre o menu completo). */
export const mobileDockNav: AppNavItem[] = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/payments', label: 'Pagar', icon: Wallet, paymentsFlow: 'pay' },
  { href: '/transactions', label: 'Extrato', icon: ArrowLeftRight },
  { href: '/wealth', label: 'Patrimônio', icon: Landmark },
];

export const cadastrosNav: AppNavItem[] = [
  { href: '/cadastros/accounts', label: 'Bancos e contas', icon: Landmark },
  { href: '/cadastros/categories', label: 'Categorias', icon: FolderTree },
  { href: '/cadastros/cost-centers', label: 'Centros de custo', icon: Building2 },
];

export type SystemNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function buildSystemNav(canManageMembers: boolean): SystemNavItem[] {
  const items: SystemNavItem[] = [
    { href: '/import-export', label: 'Importar / Exportar', icon: Upload },
  ];
  if (canManageMembers) {
    items.push({ href: '/settings/members', label: 'Família', icon: Users });
  }
  items.push({ href: '/settings/preferences', label: 'Preferências', icon: SlidersHorizontal });
  return items;
}

export function titleFromPath(pathname: string, flow?: string | null): string {
  if (pathname.startsWith('/payments')) {
    return flow === 'receive' ? 'Contas a receber' : 'Contas a pagar';
  }
  if (pathname.startsWith('/wealth')) return 'Patrimônio';
  if (pathname.startsWith('/transactions')) return 'Extrato';
  if (pathname.startsWith('/financings')) return 'Financiamentos';
  if (pathname.startsWith('/import-export')) return 'Importar / Exportar';
  if (pathname.startsWith('/cadastros/categories')) return 'Categorias';
  if (pathname.startsWith('/cadastros/cost-centers')) return 'Centros de custo';
  if (pathname.startsWith('/cadastros/accounts')) return 'Bancos e contas';
  if (pathname.startsWith('/cadastros')) return 'Cadastros';
  if (pathname.startsWith('/settings/members')) return 'Família';
  if (pathname.startsWith('/settings')) return 'Preferências';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/planning')) return 'Planejamento';
  return 'Time is Money';
}

export function isActivePath(
  pathname: string,
  href: string,
  opts?: { paymentsFlow?: PaymentsFlow; currentPaymentsFlow?: PaymentsFlow },
): boolean {
  if (href === '/settings/preferences') {
    return pathname.startsWith('/settings/preferences') || pathname === '/settings';
  }
  if (href === '/payments' && opts?.paymentsFlow) {
    return (
      (pathname === '/payments' || pathname.startsWith('/payments/')) &&
      opts.currentPaymentsFlow === opts.paymentsFlow
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function paymentsNavHref(scopedHref: string, flow: PaymentsFlow): string {
  const [path, query = ''] = scopedHref.split('?');
  const params = new URLSearchParams(query);
  if (flow === 'receive') params.set('flow', 'receive');
  else params.delete('flow');
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
