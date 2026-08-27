import { Suspense } from 'react';
import Link from 'next/link';
import { CheckSquare, ExternalLink, Lightbulb, Link2, Scale, Search, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, ApiRequestError } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { SearchForm } from '@/components/search-form';
import { Skeleton } from '@/components/ui/skeleton';
import { ITEM_TYPE_LABEL } from '@/lib/format';
import type { ItemDTO, ItemType, SearchResultDTO } from '@/lib/api/types';

export const metadata = { title: 'Buscar' };

const ICONS: Record<ItemType, LucideIcon> = {
  task: CheckSquare,
  note: StickyNote,
  idea: Lightbulb,
  decision: Scale,
  link: Link2,
};

/** Rota da listagem correspondente ao tipo, para o resultado levar a algum lugar. */
const ROTAS: Record<ItemType, string> = {
  task: 'tarefas',
  note: 'notas',
  idea: 'ideias',
  decision: 'decisoes',
  link: 'links',
};

function isItemType(value: string): value is ItemType {
  return ['task', 'note', 'idea', 'decision', 'link'].includes(value);
}

function Resultado({ item, guildId }: { item: ItemDTO; guildId: string }) {
  const Icon = ICONS[item.type];
  const ehLink = item.type === 'link' && item.content;

  return (
    <li className="flex items-start gap-3 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {ehLink ? (
            <a
              href={item.content ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium hover:underline"
            >
              {item.title}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : (
            <Link
              href={`/g/${guildId}/${ROTAS[item.type]}`}
              className="font-medium hover:underline"
            >
              {item.title}
            </Link>
          )}

          <Badge variant="secondary" className="font-normal">
            {ITEM_TYPE_LABEL[item.type]}
          </Badge>

          {item.project ? (
            <Badge variant="outline" className="font-normal">
              {item.project.name}
            </Badge>
          ) : null}
        </div>

        {item.content && !ehLink ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
        ) : null}
      </div>

      <span className="shrink-0 font-mono text-xs text-muted-foreground">#{item.id}</span>
    </li>
  );
}

export default async function BuscarPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const { guildId } = await params;
  const { q, tipo } = await searchParams;

  const termo = q?.trim() ?? '';
  const filtroTipo = tipo && isItemType(tipo) ? tipo : undefined;

  let resultado: SearchResultDTO | null = null;
  let erro: string | null = null;

  if (termo.length >= 2) {
    try {
      resultado = await api.search(guildId, termo, filtroTipo);
    } catch (error) {
      erro =
        error instanceof ApiRequestError ? error.message : 'Não foi possível realizar a busca.';
    }
  }

  return (
    <>
      <PageHeader
        title="Buscar"
        description="Procura em títulos e conteúdos, apenas dentro deste servidor."
      />

      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        <SearchForm />
      </Suspense>

      {erro ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </p>
      ) : termo.length < 2 ? (
        <EmptyState
          icon={Search}
          title="Digite ao menos 2 caracteres"
          description="A busca cobre tarefas, notas, ideias, decisões e links deste squad."
        />
      ) : resultado && resultado.total === 0 ? (
        <EmptyState
          icon={Search}
          title={`Nada encontrado para “${resultado.term}”`}
          description="Tente outro termo, ou remova o filtro de tipo."
        />
      ) : resultado ? (
        <>
          <p className="text-sm text-muted-foreground">
            {resultado.total} resultado(s) para <strong>“{resultado.term}”</strong>
          </p>
          <ul className="divide-y rounded-xl border bg-card">
            {resultado.results.map((item) => (
              <Resultado key={`${item.type}-${item.id}`} item={item} guildId={guildId} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
