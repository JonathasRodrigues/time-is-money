'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useNavigating } from '@/components/navigating';
import { cn } from '@/lib/utils';

function normalizeRouteKey(pathname: string, search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Barra fina no header + sinaliza pending no NavigatingProvider.
 * Em navegação soft (Link), o conteúdo anterior permanece até a nova rota ficar pronta.
 */
export function NavigationProgress(): React.ReactElement {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPending, beginLinkNavigation } = useNavigating();
  const routeKey = normalizeRouteKey(pathname, searchParams.toString());
  const wasPending = useRef(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (isPending) {
      wasPending.current = true;
      setCompleting(false);
      return undefined;
    }
    if (wasPending.current) {
      wasPending.current = false;
      setCompleting(true);
      const timer = window.setTimeout(() => setCompleting(false), 200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isPending]);

  useEffect(() => {
    function onClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a');
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const nextKey = normalizeRouteKey(url.pathname, url.search);
      if (nextKey === routeKey) return;

      beginLinkNavigation();
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [routeKey, beginLinkNavigation]);

  const active = isPending || completing;

  return (
    <div
      role="progressbar"
      aria-hidden={!active}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-30 h-0.5 overflow-hidden transition-opacity duration-200',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div
        className={cn(
          'h-full bg-primary',
          isPending && 'w-1/3 animate-navigation-progress',
          completing && !isPending && 'w-full transition-all duration-200 ease-out',
          !active && 'w-0',
        )}
      />
    </div>
  );
}
