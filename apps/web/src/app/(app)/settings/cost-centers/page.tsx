import { redirect } from 'next/navigation';

export default function LegacyCostCentersRedirect(): never {
  redirect('/cadastros/cost-centers');
}
