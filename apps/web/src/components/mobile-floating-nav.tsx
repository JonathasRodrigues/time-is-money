'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { ChevronRight, Menu, SlidersHorizontal, Users, X } from 'lucide-react';
import {
  buildSystemNav,
  cadastrosNav,
  isActivePath,
  mobileDockNav,
  paymentsNavHref,
  primaryNav,
  type AppNavItem,
  type PaymentsFlow,
} from '@/components/app-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { useScopePreference } from '@/components/scope-preference';
import { pathUsesCenter, pathUsesPeriod } from '@/lib/scope-preference';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type MobileFloatingNavProps = {
  canManageMembers?: boolean;
  userEmail: string;
  userLabel: string;
  initials: string;
  useClerkAccount?: boolean;
};

function resolveNavHref(item: AppNavItem, navHref: (path: string) => string): string {
  const scoped =
    pathUsesPeriod(item.href) || pathUsesCenter(item.href) ? navHref(item.href) : item.href;
  return item.paymentsFlow != null ? paymentsNavHref(scoped, item.paymentsFlow) : scoped;
}

function DockLink({
  item,
  href,
  active,
  onNavigate,
}: {
  item: AppNavItem;
  href: string;
  active: boolean;
  onNavigate?: () => void;
}): React.ReactElement {
  const Icon = item.icon;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span className="truncate leading-none">{item.label}</span>
    </Link>
  );
}

function SheetNavLink({
  item,
  href,
  active,
  onNavigate,
}: {
  item: AppNavItem;
  href: string;
  active: boolean;
  onNavigate?: () => void;
}): React.ReactElement {
  const Icon = item.icon;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/80 active:bg-muted',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
      <ChevronRight
        className={cn('size-4 shrink-0', active ? 'text-primary/70' : 'text-muted-foreground/50')}
        aria-hidden
      />
    </Link>
  );
}

function SheetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="space-y-1">
      <p className="px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export function MobileFloatingNav({
  canManageMembers = false,
  userEmail,
  userLabel,
  initials,
  useClerkAccount = false,
}: MobileFloatingNavProps): React.ReactElement {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navHref } = useScopePreference();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const currentPaymentsFlow: PaymentsFlow =
    searchParams.get('flow') === 'receive' ? 'receive' : 'pay';
  const systemNav = buildSystemNav(canManageMembers);

  useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  const itemActive = (item: AppNavItem): boolean =>
    isActivePath(pathname, item.href, {
      paymentsFlow: item.paymentsFlow,
      currentPaymentsFlow,
    });

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden">
      {open ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="pointer-events-auto fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] animate-in fade-in-0 dark:bg-black/60"
          onClick={close}
        />
      ) : null}

      <div
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        aria-hidden={!open}
        className={cn(
          'absolute inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] z-50 px-3 transition-[opacity,transform] duration-200 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none invisible translate-y-2 opacity-0',
        )}
      >
        <div className="flex max-h-[min(70dvh,32rem)] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_16px_40px_-12px_rgb(0_0_0/0.35)] ring-1 ring-black/5 dark:ring-white/10">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">Menu</p>
              <p className="truncate text-xs text-muted-foreground">Navegação e conta</p>
            </div>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={close}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3">
            <SheetSection title="Principal">
              {primaryNav.map((item) => (
                <SheetNavLink
                  key={`${item.href}:${item.paymentsFlow ?? 'default'}`}
                  item={item}
                  href={resolveNavHref(item, navHref)}
                  active={itemActive(item)}
                  onNavigate={close}
                />
              ))}
            </SheetSection>

            <SheetSection title="Cadastros">
              {cadastrosNav.map((item) => (
                <SheetNavLink
                  key={item.href}
                  item={item}
                  href={item.href}
                  active={isActivePath(pathname, item.href)}
                  onNavigate={close}
                />
              ))}
            </SheetSection>

            <SheetSection title="Sistema">
              {systemNav.map((item) => (
                <SheetNavLink
                  key={item.href}
                  item={item}
                  href={item.href}
                  active={isActivePath(pathname, item.href)}
                  onNavigate={close}
                />
              ))}
            </SheetSection>
          </div>

          <div className="space-y-2 border-t px-3 py-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-xs font-medium text-muted-foreground">Aparência</p>
              <ThemeToggle />
            </div>

            <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-2.5 py-2">
              {useClerkAccount ? (
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'size-8',
                      userButtonPopoverCard: 'z-[100]',
                    },
                  }}
                >
                  <UserButton.MenuItems>
                    <UserButton.Link
                      label="Preferências"
                      labelIcon={<SlidersHorizontal className="size-4" />}
                      href="/settings/preferences"
                    />
                    {canManageMembers ? (
                      <UserButton.Link
                        label="Família"
                        labelIcon={<Users className="size-4" />}
                        href="/settings/members"
                      />
                    ) : null}
                  </UserButton.MenuItems>
                </UserButton>
              ) : (
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{userLabel}</p>
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto relative z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-1"
      >
        <div className="mx-auto flex max-w-md items-end gap-0.5 rounded-2xl border border-border bg-popover/95 px-1.5 py-1.5 text-popover-foreground shadow-[0_8px_24px_-8px_rgb(0_0_0/0.28)] ring-1 ring-black/5 backdrop-blur-md dark:ring-white/10">
          {mobileDockNav.slice(0, 2).map((item) => (
            <DockLink
              key={`${item.href}:${item.paymentsFlow ?? 'default'}`}
              item={item}
              href={resolveNavHref(item, navHref)}
              active={!open && itemActive(item)}
              onNavigate={close}
            />
          ))}

          <div className="flex flex-1 items-center justify-center pb-0.5">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setOpen((value) => !value)}
              className={cn(
                'relative -mt-3 flex size-12 items-center justify-center rounded-full text-primary-foreground shadow-md transition-transform duration-200',
                'bg-primary shadow-primary/25 hover:bg-primary/90 active:scale-95',
                open && 'scale-95 bg-foreground shadow-foreground/15',
              )}
            >
              {open ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>
          </div>

          {mobileDockNav.slice(2).map((item) => (
            <DockLink
              key={`${item.href}:${item.paymentsFlow ?? 'default'}`}
              item={item}
              href={resolveNavHref(item, navHref)}
              active={!open && itemActive(item)}
              onNavigate={close}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
