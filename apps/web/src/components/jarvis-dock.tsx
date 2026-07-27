'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { JarvisChat } from '@/components/jarvis-chat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function JarvisDock({ ttsEnabled = false }: { ttsEnabled?: boolean }): React.ReactElement {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('jarvis') === '1') {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <button
        type="button"
        aria-label={open ? 'Fechar Jarvis' : 'Abrir Jarvis'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'pointer-events-auto absolute bottom-4 right-4 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition duration-200 hover:scale-[1.03] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:bottom-6 md:right-6',
          open && 'pointer-events-none invisible scale-90 opacity-0',
        )}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>

      <div
        className={cn(
          'pointer-events-auto absolute flex flex-col overflow-hidden border bg-card shadow-xl transition duration-200 ease-out',
          'inset-0',
          'md:inset-auto md:bottom-6 md:right-6 md:h-[min(640px,calc(100svh-3rem))] md:w-[400px] md:rounded-2xl',
          open
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0 md:translate-y-4',
        )}
        aria-hidden={!open}
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground">
            J
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Jarvis</p>
            <p className="text-xs text-muted-foreground">Chat · texto ou voz</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={() => setOpen(false)}
            aria-label="Fechar Jarvis"
          >
            <X className="size-4" />
          </Button>
        </header>

        {open ? <JarvisChat ttsEnabled={ttsEnabled} autoFocus className="min-h-0 flex-1" /> : null}
      </div>
    </div>
  );
}
