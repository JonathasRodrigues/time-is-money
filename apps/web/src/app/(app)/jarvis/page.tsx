import { redirect } from 'next/navigation';

/** Jarvis abre pelo botão no topbar — esta rota só abre o dock. */
export default function JarvisPage(): never {
  redirect('/dashboard?jarvis=1');
}
