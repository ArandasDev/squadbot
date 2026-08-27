import { redirect } from 'next/navigation';
import { CalendarClock, CheckSquare, Lightbulb, Scale, StickyNote } from 'lucide-react';
import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Entrar' };

const DESTAQUES = [
  { icon: CheckSquare, label: 'Tarefas com responsável, prioridade e prazo' },
  { icon: StickyNote, label: 'Notas e decisões que sobrevivem ao scroll do chat' },
  { icon: Lightbulb, label: 'Ideias acompanhadas do registro à implementação' },
  { icon: CalendarClock, label: 'Lembretes entregues por DM, para você ou para o squad' },
  { icon: Scale, label: 'Busca única sobre tudo que o squad já guardou' },
];

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.discordId) redirect('/servidores');

  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="grid w-full max-w-4xl gap-8 md:grid-cols-2 md:items-center">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            SquadBot
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            A memória compartilhada do seu squad.
          </h1>
          <p className="text-muted-foreground text-pretty">
            O que o time registra no Discord aparece aqui organizado — sem planilha paralela, sem
            app de notas, sem procurar mensagem antiga.
          </p>

          <ul className="space-y-3 pt-2">
            {DESTAQUES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="text-muted-foreground">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Use a mesma conta do Discord que você usa no servidor do squad. Só quem é membro
              consegue ver os dados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                Não foi possível concluir o login. Tente novamente.
              </p>
            ) : null}

            <form
              action={async () => {
                'use server';
                await signIn('discord', { redirectTo: '/servidores' });
              }}
            >
              <Button type="submit" className="w-full" size="lg">
                Entrar com Discord
              </Button>
            </form>

            <p className="text-xs text-muted-foreground">
              Pedimos apenas o escopo <code className="font-mono">identify</code>. A permissão de
              ver cada servidor é conferida diretamente com o bot.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
