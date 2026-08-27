import { BellRing, CheckSquare, Lightbulb } from 'lucide-react';
import { api } from '@/lib/api/client';
import { usernamesByUserId } from '@/lib/api/helpers';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TaskList } from '@/components/task-list';
import { formatRelative } from '@/lib/format';
import type { ItemDTO } from '@/lib/api/types';

export const metadata = { title: 'Minhas' };

interface GrupoProps {
  titulo: string;
  tarefas: ItemDTO[];
  guildId: string;
  timezone: string;
  usernames: Record<number, string>;
}

function Grupo({ titulo, tarefas, guildId, timezone, usernames }: GrupoProps) {
  if (tarefas.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {titulo}
        <Badge variant="secondary" className="tabular-nums">
          {tarefas.length}
        </Badge>
      </h3>
      <TaskList guildId={guildId} tasks={tarefas} timezone={timezone} usernames={usernames} />
    </section>
  );
}

export default async function MinhasPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const [overview, me, usernames] = await Promise.all([
    api.overview(guildId),
    api.me(guildId),
    usernamesByUserId(guildId),
  ]);

  const { tasks } = overview;
  const timezone = me.user.timezone;

  return (
    <>
      <PageHeader
        title="Suas responsabilidades"
        description={`O que está atribuído a você neste servidor · fuso ${timezone}`}
      />

      {tasks.total === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nenhuma tarefa em aberto"
          description="Nada atribuído a você por aqui. Aproveite."
        />
      ) : (
        <div className="space-y-5">
          <Grupo
            titulo="Urgentes"
            tarefas={tasks.urgent}
            guildId={guildId}
            timezone={timezone}
            usernames={usernames}
          />
          <Grupo
            titulo="Alta prioridade"
            tarefas={tasks.high}
            guildId={guildId}
            timezone={timezone}
            usernames={usernames}
          />
          <Grupo
            titulo="Em andamento"
            tarefas={tasks.inProgress}
            guildId={guildId}
            timezone={timezone}
            usernames={usernames}
          />
          <Grupo
            titulo="Demais tarefas"
            tarefas={tasks.others}
            guildId={guildId}
            timezone={timezone}
            usernames={usernames}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="size-4" aria-hidden />
              Próximos lembretes
            </CardTitle>
            <CardDescription>Chegam por DM no horário agendado.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum lembrete agendado para você.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {overview.reminders.map((reminder) => (
                  <li key={reminder.id} className="flex items-start gap-3 text-sm">
                    <Badge variant="outline" className="shrink-0 font-normal tabular-nums">
                      {formatRelative(reminder.remindAt, timezone)}
                    </Badge>
                    <span className="min-w-0 flex-1">
                      {reminder.message}
                      {reminder.createdBy.id !== reminder.recipient.id ? (
                        <span className="block text-xs text-muted-foreground">
                          criado por @{reminder.createdBy.username}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4" aria-hidden />
              Últimas ideias do squad
            </CardTitle>
            <CardDescription>O que ainda está em aberto para avaliação.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.ideas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ideia registrada.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {overview.ideas.map((idea) => (
                  <li key={idea.id} className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-muted-foreground">#{idea.id}</span>
                    <span className="min-w-0 flex-1 truncate">{idea.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
