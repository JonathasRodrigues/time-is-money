'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { InviteMemberForm } from '@/components/invite-member-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function InviteMemberSheet(): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <UserPlus className="size-3.5" />
          Convidar
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Convidar pessoa</SheetTitle>
          <SheetDescription>
            Envia e-mail quando o Resend estiver configurado. Sem isso, use o link gerado.
          </SheetDescription>
        </SheetHeader>
        <InviteMemberForm />
      </SheetContent>
    </Sheet>
  );
}
