'use client';

import { useTransition } from 'react';
import { Check, CircleDashed, Loader2, PlayCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  cancelTaskAction,
  completeTaskAction,
  setTaskStatusAction,
} from '@/app/g/[guildId]/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PRIORITY_DOT,
  PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  formatDate,
  isOverdue,
} from '@/lib/format';
import type { ItemDTO, Priority, TaskStatus } from '@/lib/api/types';

interface TaskListProps {
  guildId: string;
  tasks: ItemDTO[];
  timezone: string;
  /** Ids do Discord por id interno, para exibir o responsável. */
  usernames?: Record<number, string>;
  showProject?: boolean;
}

const CLOSED: TaskStatus[] = ['done', 'cancelled'];

export function TaskList({
  guildId,
  tasks,
  timezone,
  usernames = {},
  showProject = true,
}: TaskListProps) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {tasks.map((task) => {
        const priority = (task.priority ?? 'medium') as Priority;
        const status = task.status as TaskStatus;
        const closed = CLOSED.includes(status);
        const late = !closed && isOverdue(task.dueAt);

        return (
          /*
           * No mobile a linha vira duas: texto em cima, status e ações embaixo.
           * Espremer tudo numa linha só deixava os botões com alvo de toque
           * pequeno demais e o título cortado cedo.
           */
          <li key={task.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span
                className={cn(
                  'mt-1.5 size-2.5 shrink-0 rounded-full sm:mt-0',
                  PRIORITY_DOT[priority],
                )}
                title={`Prioridade: ${PRIORITY_LABEL[priority]}`}
                aria-label={`Prioridade ${PRIORITY_LABEL[priority]}`}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-medium sm:truncate',
                    closed && 'text-muted-foreground line-through',
                  )}
                >
                  {task.title}
                </p>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">#{task.id}</span>

                  {showProject && task.project ? <span>{task.project.name}</span> : null}

                  {task.assignedTo ? (
                    <span>@{usernames[task.assignedTo.id] ?? 'responsável'}</span>
                  ) : (
                    <span className="italic">sem responsável</span>
                  )}

                  {task.dueAt ? (
                    <span className={cn(late && 'font-medium text-destructive')}>
                      {late ? 'venceu em ' : 'prazo '}
                      {formatDate(task.dueAt, timezone)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 pl-[22px] sm:shrink-0 sm:pl-0">
              <Badge
                variant={status === 'in_progress' ? 'default' : 'secondary'}
                className="mr-auto shrink-0 sm:mr-0"
              >
                {TASK_STATUS_LABEL[status] ?? status}
              </Badge>

              {!closed ? (
                <>
                  {status === 'pending' ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9 sm:size-8"
                      disabled={pending}
                      onClick={() => run(() => setTaskStatusAction(guildId, task.id, 'in_progress'))}
                      title="Marcar como em andamento"
                    >
                      <PlayCircle className="size-4" aria-hidden />
                      <span className="sr-only">Iniciar</span>
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9 sm:size-8"
                      disabled={pending}
                      onClick={() => run(() => setTaskStatusAction(guildId, task.id, 'pending'))}
                      title="Voltar para pendente"
                    >
                      <CircleDashed className="size-4" aria-hidden />
                      <span className="sr-only">Voltar para pendente</span>
                    </Button>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 sm:size-8"
                    disabled={pending}
                    onClick={() => run(() => completeTaskAction(guildId, task.id))}
                    title="Concluir"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                    <span className="sr-only">Concluir</span>
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 sm:size-8"
                    disabled={pending}
                    onClick={() => run(() => cancelTaskAction(guildId, task.id))}
                    title="Cancelar"
                  >
                    <X className="size-4" aria-hidden />
                    <span className="sr-only">Cancelar</span>
                  </Button>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
