import { redirect } from 'next/navigation';

/** Hub desnecessário — o menu já aponta para cada cadastro. */
export default function CadastrosPage(): never {
  redirect('/cadastros/categories');
}
