'use client';

import { useEffect } from 'react';

/** Registers a minimal SW that only precaches the app shell — never financial data. */
export function RegisterServiceWorker(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
