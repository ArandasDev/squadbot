import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ServerCrash } from 'lucide-react';
import { auth } from '@/auth';
import { api, ApiRequestError, ApiUnreachableError, NotAuthenticatedError } from '@/lib/api/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserMenu } from '@/components/user-menu';
import type { GuildDTO } from '@/lib/api/types';

export const metadata = { title: 'Servidores' };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default async function ServidoresPage() {
  const session = await auth();
  if (!session?.user?.discordId) redirect('/entrar');

  let guilds: GuildDTO[] = [];
  let falha: { titulo: string; descricao: string; detalhe: string } | null = null;

  try {
    guilds = await api.guilds();
  } catch (error) {
    if (error instanceof NotAuthenticatedError) redirect('/entrar');

    // Distinguir "não cheguei no bot" de "o bot me recusou" é o que transforma
    // esta tela de um beco sem saída em um diagnóstico.
    if (error instanceof ApiUnreachableError) {
      falha = {
        titulo: 'Não cheguei até o bot',
        descricao:
          'A requisição nem chegou a ser respondida. Confira SQUADBOT_API_URL (host e porta) e se o bot está escutando em IPv6 (API_HOST=::), que é o exigido pela rede privada do Railway.',
        detalhe: `${error.url} — ${error.reason}`,
      };
    } else if (error instanceof ApiRequestError) {
      falha = {
        titulo: 'O bot recusou a requisição',
        descricao:
          error.status === 401
            ? 'Token de serviço inválido: SQUADBOT_API_TOKEN aqui precisa ser idêntico a API_TOKEN no bot.'
            : error.message,
        detalhe: `HTTP ${error.status} · ${error.code}`,
      };
    } else {
      falha = {
        titulo: 'Não deu para falar com o bot',
        descricao: 'Verifique se o SquadBot está no ar e se as variáveis apontam para ele.',
        detalhe: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Com um servidor só, a escolha é ruído: vai direto para o dashboard.
  if (guilds.length === 1 && guilds[0]) redirect(`/g/${guilds[0].id}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seus servidores</h1>
          <p className="text-sm text-muted-foreground">
            Escolha o squad que você quer acompanhar.
          </p>
        </div>
        <UserMenu
          name={session.user.name ?? 'Você'}
          image={session.user.image ?? null}
        />
      </header>

      {falha ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ServerCrash className="size-4 text-destructive" aria-hidden />
              {falha.titulo}
            </CardTitle>
            <CardDescription>{falha.descricao}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all text-muted-foreground">
              {falha.detalhe}
            </p>
          </CardContent>
        </Card>
      ) : guilds.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhum servidor em comum</CardTitle>
            <CardDescription>
              Você precisa estar em um servidor onde o SquadBot também esteja. Peça o convite do bot
              a um administrador do squad.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {guilds.map((guild) => (
            <li key={guild.id}>
              <Link
                href={`/g/${guild.id}`}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <Avatar className="size-11">
                  {guild.iconUrl ? <AvatarImage src={guild.iconUrl} alt="" /> : null}
                  <AvatarFallback>{initials(guild.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{guild.name}</span>
                  <span className="block text-xs text-muted-foreground">Abrir dashboard</span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
