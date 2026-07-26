import { redirect } from 'next/navigation';

export default function LegacyCategoriesRedirect(): never {
  redirect('/cadastros/categories');
}
