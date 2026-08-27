'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '', label: 'Resumo', icon: LayoutDashboard },
  { href: '/minhas', label: 'Minhas', icon: UserRound },
  { href: '/tarefas', label: 'Tarefas', icon: CheckSquare },
  { href: '/projetos', label: 'Projetos', icon: FolderKanban },
  { href: '/notas', label: 'Notas', icon: StickyNote },
  { href: '/ideias', label: 'Ideias', icon: Lightbulb },
  { href: '/decisoes', label: 'Decisões', icon: Scale },
  { href: '/links', label: 'Links', icon: Link2 },
  { href: '/lembretes', label: 'Lembretes', icon: BellRing },
  { href: '/buscar', label: 'Buscar', icon: Search },
] as const;

export function GuildNav({ guildId }: { guildId: string }) {
  const pathname = usePathname();
  const base = `/g/${guildId}`;

  return (
    <nav aria-label="Seções do squad" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const target = `${base}${href}`;
        const active = href === '' ? pathname === base : pathname.startsWith(target);

        return (
          <Link
            key={label}
            href={target}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
