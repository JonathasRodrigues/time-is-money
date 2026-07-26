import { redirect } from 'next/navigation';

/** Preferências ficam em Configurações; cadastros foram para /cadastros. */
export default function SettingsPage(): never {
  redirect('/settings/preferences');
}
