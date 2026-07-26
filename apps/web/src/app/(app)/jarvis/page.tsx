import { redirect } from 'next/navigation';

/** Jarvis agora é o chat flutuante global — esta rota só abre o dock. */
export default function JarvisPage(): never {
  redirect('/dashboard?jarvis=1');
}
