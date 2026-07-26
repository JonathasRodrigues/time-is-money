import { redirect } from 'next/navigation';

export default function LegacyAccountsRedirect(): never {
  redirect('/cadastros/accounts');
}
