import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { auth } from '@/auth';
import { api, ApiRequestError, NotAuthenticatedError } from '@/lib/api/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GuildNav } from '@/components/guild-nav';
import { UserMenu } from '@/components/user-menu';
import type { MeDTO } from '@/lib/api/types';

/**
 * Casca de todas as paginas de um servidor.
 *
 * Cada requisicao revalida a associacao do usuario a guild contra a API do bot:
 * sair do servidor no Discord tira o acesso ao dashboard na navegacao seguinte,
 * sem precisar deslogar.
 */
export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.discordId) redirect('/entrar');

  const { guildId } = await params;

  let me: MeDTO;
  try {
    me = await api.me(guildId);
  } catch (error) {
    if (error instanceof NotAuthenticatedError) redirect('/entrar');
    // Nao é membro, guild inexistente ou bot fora do servidor: volta para a lista.
    if (error instanceof ApiRequestError && [403, 404].includes(error.status)) {
      redirect('/servidores');
    }
    throw error;
  }

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Avatar className="size-8">
            {me.guild.iconUrl ? <AvatarImage src={me.guild.iconUrl} alt="" /> : null}
            <AvatarFallback>{me.guild.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{me.guild.name}</p>
            <p className="text-xs text-muted-foreground">SquadBot</p>
          </div>

          {me.isAdmin ? (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Admin
            </Badge>
          ) : null}

          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/servidores">
              <ArrowLeftRight className="size-4" aria-hidden />
              Trocar
            </Link>
          </Button>

          <UserMenu
            name={session.user.name ?? me.user.username}
            image={session.user.image ?? null}
            timezone={me.user.timezone}
          />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-52 md:shrink-0">
          <div className="md:sticky md:top-20">
            <GuildNav guildId={guildId} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 pb-12">{children}</main>
      </div>
    </div>
  );
}
