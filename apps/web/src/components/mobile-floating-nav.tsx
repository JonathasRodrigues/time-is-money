'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Menu, SlidersHorizontal, Users, X } from 'lucide-react';
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

function NavIconLink({
  item,
  href,
  active,
  onNavigate,
  variant,
}: {
  item: AppNavItem;
  href: string;
  active: boolean;
  onNavigate?: () => void;
  variant: 'dock' | 'grid';
}): React.ReactElement {
  const Icon = item.icon;

  if (variant === 'dock') {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-medium transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-full transition-colors',
            active ? 'bg-primary/12 text-primary' : 'text-current',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/80 active:bg-muted',
      )}
    >
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl shadow-sm transition-colors',
          active
            ? 'bg-primary text-primary-foreground shadow-primary/25'
            : 'bg-card text-foreground ring-1 ring-border/60',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight">{item.label}</span>
    </Link>
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
          className="pointer-events-auto absolute inset-0 bg-background/55 backdrop-blur-[2px] transition-opacity animate-in fade-in-0"
          onClick={close}
        />
      ) : null}

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] px-4 transition-all duration-300',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        aria-hidden={!open}
      >
        <div
          className={cn(
            'pointer-events-auto max-h-[min(70dvh,32rem)] overflow-y-auto rounded-[1.75rem] border border-border/70 bg-card/95 p-4 shadow-[0_18px_50px_-18px_rgb(15_28_46/0.45)] backdrop-blur-xl',
            open && 'animate-in fade-in-0 slide-in-from-bottom-3 duration-300',
          )}
        >
          <p className="mb-3 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Principal
          </p>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {primaryNav.map((item) => (
              <NavIconLink
                key={`${item.href}:${item.paymentsFlow ?? 'default'}`}
                item={item}
                href={resolveNavHref(item, navHref)}
                active={itemActive(item)}
                onNavigate={close}
                variant="grid"
              />
            ))}
          </div>

          <p className="mt-4 mb-3 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Cadastros
          </p>
          <div className="grid grid-cols-3 gap-1">
            {cadastrosNav.map((item) => (
              <NavIconLink
                key={item.href}
                item={item}
                href={item.href}
                active={isActivePath(pathname, item.href)}
                onNavigate={close}
                variant="grid"
              />
            ))}
          </div>

          <p className="mt-4 mb-3 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Sistema
          </p>
          <div className="grid grid-cols-3 gap-1">
            {systemNav.map((item) => (
              <NavIconLink
                key={item.href}
                item={item}
                href={item.href}
                active={isActivePath(pathname, item.href)}
                onNavigate={close}
                variant="grid"
              />
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-3 py-2.5">
              <p className="text-sm font-medium">Aparência</p>
              <ThemeToggle />
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-2.5">
              {useClerkAccount ? (
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'size-9',
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
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
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
        className="pointer-events-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2"
      >
        <div className="mx-auto flex max-w-md items-end gap-1 rounded-[1.75rem] border border-border/60 bg-card/95 px-1.5 py-1.5 shadow-[0_12px_40px_-12px_rgb(15_28_46/0.4)] backdrop-blur-xl">
          {mobileDockNav.slice(0, 2).map((item) => (
            <NavIconLink
              key={`${item.href}:${item.paymentsFlow ?? 'default'}`}
              item={item}
              href={resolveNavHref(item, navHref)}
              active={!open && itemActive(item)}
              onNavigate={close}
              variant="dock"
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
                'relative -mt-5 flex size-14 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-all duration-300',
                'bg-primary shadow-primary/35 hover:bg-primary/90 active:scale-95',
                open && 'rotate-90 bg-foreground shadow-foreground/20',
              )}
            >
              {open ? (
                <X className="size-6" aria-hidden />
              ) : (
                <Menu className="size-6" aria-hidden />
              )}
            </button>
          </div>

          {mobileDockNav.slice(2).map((item) => (
            <NavIconLink
              key={`${item.href}:${item.paymentsFlow ?? 'default'}`}
              item={item}
              href={resolveNavHref(item, navHref)}
              active={!open && itemActive(item)}
              onNavigate={close}
              variant="dock"
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
