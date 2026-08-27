import Link from 'next/link';
import { Archive, FolderKanban } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Projetos' };

export default async function ProjetosPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const projetos = await api.projects(guildId);

  const ativos = projetos.filter((project) => project.status === 'active');
  const arquivados = projetos.filter((project) => project.status === 'archived');

  return (
    <>
      <PageHeader
        title="Projetos"
        description={`${ativos.length} ativo(s)${arquivados.length > 0 ? ` · ${arquivados.length} arquivado(s)` : ''}`}
      />

      {projetos.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto ainda"
          description="Crie o primeiro no Discord com /projeto criar."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projetos.map((project) => {
            const abertas = project.taskCounts.pending + project.taskCounts.in_progress;

            return (
              <Link
                key={project.id}
                href={`/g/${guildId}/projetos/${project.id}`}
                className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="truncate text-base">{project.name}</CardTitle>
                      {project.status === 'archived' ? (
                        <Badge variant="outline" className="shrink-0 gap-1 font-normal">
                          <Archive className="size-3" aria-hidden />
                          Arquivado
                        </Badge>
                      ) : null}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {project.description ?? 'Sem descrição'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        <span className="font-semibold tabular-nums">{abertas}</span>{' '}
                        <span className="text-muted-foreground">em aberto</span>
                      </span>
                      <span>
                        <span className="font-semibold tabular-nums">
                          {project.taskCounts.done}
                        </span>{' '}
                        <span className="text-muted-foreground">concluídas</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
