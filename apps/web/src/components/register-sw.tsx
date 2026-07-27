'use client';

import { useEffect } from 'react';

/** Registers a minimal SW that only precaches the app shell — never financial data. */
export function RegisterServiceWorker(): null {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const enabled =
      process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_PWA === '1';
    if (!enabled) return;

    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
