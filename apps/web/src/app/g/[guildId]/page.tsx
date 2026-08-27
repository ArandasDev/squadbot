import Link from 'next/link';
import { BellRing, FolderKanban, Lightbulb, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { formatRelative } from '@/lib/format';

export const metadata = { title: 'Resumo' };

interface StatProps {
  label: string;
  value: number;
  tone?: 'pending' | 'progress' | 'done';
}

function Stat({ label, value, tone = 'pending' }: StatProps) {
  const dot =
    tone === 'done'
      ? 'bg-priority-low'
      : tone === 'progress'
        ? 'bg-priority-medium'
        : 'bg-priority-urgent';

  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default async function ResumoPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const [summary, me] = await Promise.all([api.summary(guildId), api.me(guildId)]);

  const blocos = [
    ...summary.projects,
    ...(summary.unassigned ? [summary.unassigned] : []),
  ];

  const totalAberto = blocos.reduce(
    (total, bloco) => total + bloco.taskCounts.pending + bloco.taskCounts.in_progress,
    0,
  );
  const totalConcluido = blocos.reduce((total, bloco) => total + bloco.taskCounts.done, 0);

  return (
    <>
      <PageHeader
        title="Resumo do squad"
        description="Como está cada projeto agora, e o que vem a seguir."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="size-4" aria-hidden />
              Tarefas em aberto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{totalAberto}</p>
            <p className="text-xs text-muted-foreground">{totalConcluido} já concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BellRing className="size-4" aria-hidden />
              Lembretes agendados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{summary.pendingReminders}</p>
            <p className="text-xs text-muted-foreground">entregues por DM no Discord</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Lightbulb className="size-4" aria-hidden />
              Ideias novas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{summary.newIdeas}</p>
            <p className="text-xs text-muted-foreground">aguardando avaliação</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Projetos ativos</h2>

        {blocos.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="Nenhum projeto ativo"
            description="Crie o primeiro no Discord com /projeto criar — ele aparece aqui em seguida."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {blocos.map((bloco) => {
              const nome = bloco.project?.name ?? 'Sem projeto';
              const conteudo = (
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="truncate text-base">{nome}</CardTitle>
                    {bloco.project?.description ? (
                      <CardDescription className="line-clamp-2">
                        {bloco.project.description}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Stat label="Pendentes" value={bloco.taskCounts.pending} />
                    <Stat label="Em andamento" value={bloco.taskCounts.in_progress} tone="progress" />
                    <Stat label="Concluídas" value={bloco.taskCounts.done} tone="done" />
                  </CardContent>
                </Card>
              );

              return bloco.project ? (
                <Link
                  key={bloco.project.id}
                  href={`/g/${guildId}/projetos/${bloco.project.id}`}
                  className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {conteudo}
                </Link>
              ) : (
                <div key="sem-projeto">{conteudo}</div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Próximos lembretes do squad</h2>

        {summary.upcomingReminders.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="Nenhum lembrete agendado"
            description="Use /lembrete criar no Discord — dá para agendar para você ou para outra pessoa do squad."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {summary.upcomingReminders.map((reminder) => (
              <li key={reminder.id} className="flex flex-wrap items-center gap-3 p-3">
                <Badge variant="outline" className="shrink-0 font-normal tabular-nums">
                  {formatRelative(reminder.remindAt, me.user.timezone)}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm">{reminder.message}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  para @{reminder.recipient.username}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
