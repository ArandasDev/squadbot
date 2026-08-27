import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckSquare } from 'lucide-react';
import { api, ApiRequestError } from '@/lib/api/client';
import { usernamesByUserId } from '@/lib/api/helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TaskList } from '@/components/task-list';
import type { ProjectDetailDTO } from '@/lib/api/types';

export default async function ProjetoPage({
  params,
}: {
  params: Promise<{ guildId: string; projectId: string }>;
}) {
  const { guildId, projectId } = await params;
  const id = Number.parseInt(projectId, 10);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let projeto: ProjectDetailDTO;
  try {
    projeto = await api.project(guildId, id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const [tarefas, usernames, me] = await Promise.all([
    api.tasks(guildId, { projectId: String(id) }),
    usernamesByUserId(guildId),
    api.me(guildId),
  ]);

  const { taskCounts } = projeto;
  const total =
    taskCounts.pending + taskCounts.in_progress + taskCounts.done + taskCounts.cancelled;
  const progresso = total > 0 ? Math.round((taskCounts.done / total) * 100) : 0;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/g/${guildId}/projetos`}>
          <ArrowLeft className="size-4" aria-hidden />
          Projetos
        </Link>
      </Button>

      <PageHeader
        title={projeto.name}
        description={projeto.description ?? 'Sem descrição'}
        action={
          projeto.status === 'archived' ? <Badge variant="outline">Arquivado</Badge> : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Progresso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold tabular-nums">{progresso}%</p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progresso}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do projeto"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${progresso}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {taskCounts.done} de {total} tarefa(s) concluída(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Situação das tarefas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Pendentes</span>
              <span className="font-semibold tabular-nums">{taskCounts.pending}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Em andamento</span>
              <span className="font-semibold tabular-nums">{taskCounts.in_progress}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Canceladas</span>
              <span className="font-semibold tabular-nums">{taskCounts.cancelled}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Membros ({projeto.members.length})</CardDescription>
          </CardHeader>
          <CardContent>
            {projeto.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum membro vinculado.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {projeto.members.map((member) => (
                  <li key={member.id}>
                    <Badge variant="secondary" className="font-normal">
                      @{member.username}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Tarefas em aberto</h2>

        {tarefas.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Nenhuma tarefa em aberto"
            description={`Crie uma no Discord com /tarefa criar projeto:${projeto.name}`}
          />
        ) : (
          <TaskList
            guildId={guildId}
            tasks={tarefas}
            timezone={me.user.timezone}
            usernames={usernames}
            showProject={false}
          />
        )}
      </section>
    </>
  );
}
