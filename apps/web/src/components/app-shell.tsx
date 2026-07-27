'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  Building2,
  CreditCard,
  FolderTree,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  SlidersHorizontal,
  Target,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { JarvisDock } from '@/components/jarvis-dock';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/payments', label: 'Contas', icon: Wallet },
  { href: '/wealth', label: 'Patrimônio', icon: Landmark },
  { href: '/transactions', label: 'Extrato', icon: ArrowLeftRight },
  { href: '/financings', label: 'Financiamentos', icon: PiggyBank },
  { href: '/planning', label: 'Planejamento', icon: Target },
] as const;

const cadastrosNav = [
  { href: '/cadastros/categories', label: 'Categorias', icon: FolderTree },
  { href: '/cadastros/cost-centers', label: 'Centros de custo', icon: Building2 },
  { href: '/cadastros/accounts', label: 'Bancos e contas', icon: CreditCard },
] as const;

type SystemNavItem = {
  href: string;
  label: string;
  icon: typeof Upload;
};

function buildSystemNav(canManageMembers: boolean): SystemNavItem[] {
  const items: SystemNavItem[] = [
    { href: '/import-export', label: 'Importar / Exportar', icon: Upload },
  ];
  if (canManageMembers) {
    items.push({ href: '/settings/members', label: 'Família', icon: Users });
  }
  items.push({ href: '/settings/preferences', label: 'Preferências', icon: SlidersHorizontal });
  return items;
}

function titleFromPath(pathname: string): string {
  if (pathname.startsWith('/payments')) return 'Contas';
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
  return 'Time is Money';
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/settings/preferences') {
    return pathname.startsWith('/settings/preferences') || pathname === '/settings';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  demo,
  userEmail,
  userLabel,
  ttsEnabled = false,
  canManageMembers = false,
}: {
  children: React.ReactNode;
  demo: boolean;
  userEmail: string;
  userLabel: string;
  ttsEnabled?: boolean;
  canManageMembers?: boolean;
}): React.ReactElement {
  const pathname = usePathname();
  const systemNav = buildSystemNav(canManageMembers);
  const initials = userLabel
    .split(/[@\s._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="gap-3 px-3 py-4">
          <div className="flex items-center gap-3 overflow-hidden px-1">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#152033] text-sm font-semibold tracking-tight text-[#eef2f6]">
              TIM
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-base font-semibold leading-tight tracking-tight">
                Time is Money
              </p>
              <p className="truncate text-xs text-muted-foreground">Finanças da casa</p>
            </div>
          </div>
          {demo ? (
            <Badge
              variant="secondary"
              className="w-fit group-data-[collapsible=icon]:hidden"
              asChild
            >
              <Link href="/">Demo local · ver home</Link>
            </Badge>
          ) : null}
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Principal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {primaryNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, item.href)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {cadastrosNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, item.href)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Sistema</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {systemNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, item.href)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <PwaInstallPrompt />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border bg-background/80 p-2 text-left transition hover:bg-accent"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-medium">{userLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/cadastros/categories">Categorias</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/cadastros/cost-centers">Centros de custo</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/cadastros/accounts">Bancos e contas</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/preferences">Preferências</Link>
              </DropdownMenuItem>
              {canManageMembers ? (
                <DropdownMenuItem asChild>
                  <Link href="/settings/members">Família</Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex min-h-svh flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{titleFromPath(pathname)}</p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-6 md:px-8">
          {children}
        </div>
      </SidebarInset>

      <JarvisDock ttsEnabled={ttsEnabled} />
    </SidebarProvider>
  );
}
