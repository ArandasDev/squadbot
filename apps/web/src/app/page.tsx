import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/** Porta de entrada: manda para o login ou para a escolha de servidor. */
export default async function HomePage() {
  const session = await auth();
  redirect(session?.user?.discordId ? '/servidores' : '/entrar');
}
