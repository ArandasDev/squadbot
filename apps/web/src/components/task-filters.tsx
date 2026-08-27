'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { FilterX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TASK_STATUS_LABEL } from '@/lib/format';
import type { ProjectWithCountsDTO, UserDTO } from '@/lib/api/types';

const TODOS = 'todos';

interface TaskFiltersProps {
  projects: ProjectWithCountsDTO[];
  members: UserDTO[];
}

/**
 * Filtros na URL: a página continua sendo Server Component e o estado é
 * compartilhável por link — atualizar a aba mantém o recorte.
 */
export function TaskFilters({ projects, members }: TaskFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = (key: string) => searchParams.get(key) ?? TODOS;
  const hasFilters = ['projectId', 'assignedTo', 'status', 'includeClosed'].some((key) =>
    searchParams.has(key),
  );

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === TODOS) params.delete(key);
    else params.set(key, value);

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={current('projectId')} onValueChange={(value) => update('projectId', value)}>
        <SelectTrigger className="w-[190px]" aria-label="Filtrar por projeto">
          <SelectValue placeholder="Projeto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os projetos</SelectItem>
          <SelectItem value="none">Sem projeto</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={String(project.id)}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={current('assignedTo')} onValueChange={(value) => update('assignedTo', value)}>
        <SelectTrigger className="w-[190px]" aria-label="Filtrar por responsável">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Qualquer responsável</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={String(member.id)}>
              {member.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={current('status')} onValueChange={(value) => update('status', value)}>
        <SelectTrigger className="w-[170px]" aria-label="Filtrar por status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Em aberto</SelectItem>
          {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.push('?', { scroll: false }))}
        >
          <FilterX className="size-4" aria-hidden />
          Limpar
        </Button>
      ) : null}

      {pending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Carregando" />
      ) : null}
    </div>
  );
}
