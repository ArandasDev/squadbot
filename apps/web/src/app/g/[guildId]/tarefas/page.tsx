import { Suspense } from 'react';
import { CheckSquare } from 'lucide-react';
import { api } from '@/lib/api/client';
import { usernamesByUserId } from '@/lib/api/helpers';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TaskFilters } from '@/components/task-filters';
import { TaskList } from '@/components/task-list';
import { Skeleton } from '@/components/ui/skeleton';
import { isTaskStatus } from '@/lib/format';

export const metadata = { title: 'Tarefas' };

type Filtros = {
  projectId?: string;
  assignedTo?: string;
  status?: string;
};

export default async function TarefasPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<Filtros>;
}) {
  const { guildId } = await params;
  const filtros = await searchParams;

  const status = filtros.status && isTaskStatus(filtros.status) ? filtros.status : undefined;

  const [tarefas, projetos, membros, usernames, me] = await Promise.all([
    api.tasks(guildId, {
      ...(filtros.projectId ? { projectId: filtros.projectId } : {}),
      ...(filtros.assignedTo ? { assignedTo: filtros.assignedTo } : {}),
      ...(status ? { status } : {}),
      // Ao filtrar por um status fechado, o filtro padrão de "só abertas" atrapalha.
      includeClosed: status === 'done' || status === 'cancelled',
    }),
    api.projects(guildId),
    api.members(guildId),
    usernamesByUserId(guildId),
    api.me(guildId),
  ]);

  return (
    <>
      <PageHeader
        title="Tarefas"
        description={`${tarefas.length} tarefa(s) com os filtros atuais`}
      />

      <Suspense fallback={<Skeleton className="h-9 w-full max-w-xl" />}>
        <TaskFilters projects={projetos} members={membros} />
      </Suspense>

      {tarefas.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros, ou crie uma no Discord com /tarefa criar."
        />
      ) : (
        <TaskList
          guildId={guildId}
          tasks={tarefas}
          timezone={me.user.timezone}
          usernames={usernames}
        />
      )}
    </>
  );
}
