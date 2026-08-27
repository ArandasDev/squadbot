import { ExternalLink, Lightbulb, Link2, Scale, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api/client';
import { usernamesByUserId } from '@/lib/api/helpers';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { IdeaStatusSelect } from '@/components/idea-status-select';
import { PageHeader } from '@/components/page-header';
import { ITEM_TYPE_PLURAL, formatDate, isIdeaStatus } from '@/lib/format';
import type { ItemType } from '@/lib/api/types';

const ICONS: Record<Exclude<ItemType, 'task'>, LucideIcon> = {
  note: StickyNote,
  idea: Lightbulb,
  decision: Scale,
  link: Link2,
};

const DESCRICOES: Record<Exclude<ItemType, 'task'>, string> = {
  note: 'O conhecimento do squad, fora do scroll do chat.',
  idea: 'Do registro à implementação — ou à rejeição, com histórico.',
  decision: 'O que foi decidido e por quê. Memória histórica, não editável.',
  link: 'Os endereços que o squad sempre precisa reencontrar.',
};

const COMANDOS: Record<Exclude<ItemType, 'task'>, string> = {
  note: '/nota criar',
  idea: '/ideia criar',
  decision: '/decisao criar',
  link: '/link criar',
};

interface ItemsViewProps {
  guildId: string;
  type: Exclude<ItemType, 'task'>;
}

/**
 * Lista de notas, ideias, decisões ou links.
 *
 * Os quatro tipos vivem na mesma tabela `items` e diferem pouco na
 * apresentação, então compartilham esta view em vez de quatro páginas quase
 * idênticas.
 */
export async function ItemsView({ guildId, type }: ItemsViewProps) {
  const [itens, me, usernames] = await Promise.all([
    api.items(guildId, type),
    api.me(guildId),
    usernamesByUserId(guildId),
  ]);

  const Icon = ICONS[type];

  return (
    <>
      <PageHeader title={ITEM_TYPE_PLURAL[type]} description={DESCRICOES[type]} />

      {itens.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`Nenhum registro em ${ITEM_TYPE_PLURAL[type].toLowerCase()}`}
          description={`Crie o primeiro no Discord com ${COMANDOS[type]}.`}
        />
      ) : type === 'link' ? (
        <ul className="divide-y rounded-xl border bg-card">
          {itens.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
              <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                {item.content ? (
                  <a
                    href={item.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium hover:underline"
                  >
                    <span className="truncate">{item.title}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  <span className="font-medium">{item.title}</span>
                )}
                <p className="truncate text-xs text-muted-foreground">{item.content}</p>
              </div>
              {item.project ? (
                <Badge variant="secondary" className="shrink-0">
                  {item.project.name}
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {itens.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                  {type === 'idea' && isIdeaStatus(item.status) ? (
                    <IdeaStatusSelect guildId={guildId} ideaId={item.id} status={item.status} />
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-3">
                {item.content ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.content}
                  </p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">Sem conteúdo</p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                  <span className="font-mono">#{item.id}</span>
                  {item.project ? <span>{item.project.name}</span> : null}
                  <span>@{usernames[item.createdBy.id] ?? 'alguém'}</span>
                  <span>{formatDate(item.createdAt, me.user.timezone)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
