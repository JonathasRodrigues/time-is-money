'use client';

import { createContext, useContext } from 'react';

const ActionFormPendingContext = createContext(false);

export function ActionFormPendingProvider({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ActionFormPendingContext.Provider value={pending}>
      {children}
    </ActionFormPendingContext.Provider>
  );
}

export function useActionFormPending(): boolean {
  return useContext(ActionFormPendingContext);
}
