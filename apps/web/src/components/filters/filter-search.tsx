'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function FilterSearch({
  value,
  onSubmit,
  placeholder = 'Buscar…',
  ariaLabel = 'Buscar',
}: {
  value: string;
  onSubmit: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}): React.ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <form
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft.trim());
      }}
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft.trim() !== value) onSubmit(draft.trim());
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-8 w-full bg-background pl-8 text-sm"
      />
    </form>
  );
}
