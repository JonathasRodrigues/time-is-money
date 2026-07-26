'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster(): React.ReactElement {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'font-sans',
        },
      }}
    />
  );
}
