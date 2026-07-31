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
          'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1 text-[9px] font-medium transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-full transition-colors',
            active ? 'bg-primary/12 text-primary' : 'text-current',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="truncate leading-none">{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl px-1.5 py-2 text-center transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted active:bg-muted',
      )}
    >
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-xl transition-colors',
          active
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
            : 'bg-muted text-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="line-clamp-2 text-[10px] font-medium leading-tight">{item.label}</span>
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
          className="pointer-events-auto fixed inset-0 z-40 bg-black/50 backdrop-blur-[3px] transition-opacity animate-in fade-in-0 dark:bg-black/65"
          onClick={close}
        />
      ) : null}

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] z-50 px-3 transition-all duration-300',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
        )}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        aria-hidden={!open}
      >
        <div
          className={cn(
            'pointer-events-auto max-h-[min(58dvh,24rem)] overflow-y-auto rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-[0_20px_50px_-12px_rgb(0_0_0/0.35)] ring-1 ring-black/5 dark:shadow-[0_20px_50px_-12px_rgb(0_0_0/0.7)] dark:ring-white/10',
            open && 'animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
          )}
        >
          <p className="mb-2 px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Principal
          </p>
          <div className="grid grid-cols-4 gap-0.5">
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

          <p className="mt-3 mb-2 px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Cadastros
          </p>
          <div className="grid grid-cols-3 gap-0.5">
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

          <p className="mt-3 mb-2 px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Sistema
          </p>
          <div className="grid grid-cols-3 gap-0.5">
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

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-2.5 py-2">
              <p className="text-xs font-medium">Aparência</p>
              <ThemeToggle />
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background p-2">
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
                <p className="truncate text-xs font-medium">{userLabel}</p>
                <p className="truncate text-[10px] text-muted-foreground">{userEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto relative z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-1.5"
      >
        <div className="mx-auto flex max-w-sm items-end gap-0.5 rounded-2xl border border-border bg-popover px-1 py-1 text-popover-foreground shadow-[0_10px_28px_-10px_rgb(0_0_0/0.3)] ring-1 ring-black/5 dark:ring-white/10">
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
                'relative -mt-3 flex size-11 items-center justify-center rounded-full text-primary-foreground shadow-md transition-all duration-300',
                'bg-primary shadow-primary/30 hover:bg-primary/90 active:scale-95',
                open && 'rotate-90 bg-foreground shadow-foreground/20',
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
