'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS, isNavLinkActive } from '@/components/nav-links';
import { cn } from '@/lib/utils';

/**
 * Coluna de navegação do desktop. No mobile quem assume é a `MobileNav`,
 * em gaveta — as duas leem a mesma lista de seções.
 */
export function GuildNav({ guildId }: { guildId: string }) {
  const pathname = usePathname();
  const base = `/g/${guildId}`;

  return (
    <nav aria-label="Seções do squad" className="flex flex-col gap-0.5">
      {NAV_LINKS.map((link) => {
        const active = isNavLinkActive(link, pathname, base);
        const Icon = link.icon;

        return (
          <Link
            key={link.label}
            href={`${base}${link.href}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon
              className={cn('size-4 shrink-0', active && 'text-primary')}
              aria-hidden
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
