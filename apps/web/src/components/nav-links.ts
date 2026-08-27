import {
  BellRing,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  Link2,
  Scale,
  Search,
  StickyNote,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavLink {
  /** Sufixo da rota, relativo a `/g/[guildId]`. */
  href: string;
  label: string;
  icon: LucideIcon;
  /** Uma linha explicando a seção — usada na gaveta do mobile. */
  hint: string;
}

/**
 * Fonte única das seções do dashboard. A coluna do desktop e a gaveta do
 * mobile leem daqui, então não há como uma ganhar um item e a outra não.
 */
export const NAV_LINKS: readonly NavLink[] = [
  { href: '', label: 'Resumo', icon: LayoutDashboard, hint: 'Como está cada projeto' },
  { href: '/minhas', label: 'Minhas', icon: UserRound, hint: 'O que está com você' },
  { href: '/tarefas', label: 'Tarefas', icon: CheckSquare, hint: 'Tudo, com filtros' },
  { href: '/projetos', label: 'Projetos', icon: FolderKanban, hint: 'Progresso e membros' },
  { href: '/notas', label: 'Notas', icon: StickyNote, hint: 'O conhecimento do squad' },
  { href: '/ideias', label: 'Ideias', icon: Lightbulb, hint: 'Do registro à implementação' },
  { href: '/decisoes', label: 'Decisões', icon: Scale, hint: 'O que foi decidido, e por quê' },
  { href: '/links', label: 'Links', icon: Link2, hint: 'Endereços importantes' },
  { href: '/lembretes', label: 'Lembretes', icon: BellRing, hint: 'Agendados por DM' },
  { href: '/buscar', label: 'Buscar', icon: Search, hint: 'Procura em tudo' },
];

/** Uma seção está ativa quando é a rota atual — "Resumo" só no caminho exato. */
export function isNavLinkActive(link: NavLink, pathname: string, base: string): boolean {
  return link.href === '' ? pathname === base : pathname.startsWith(`${base}${link.href}`);
}
