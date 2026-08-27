'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeftRight, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NAV_LINKS, isNavLinkActive } from '@/components/nav-links';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  guildId: string;
  guildName: string;
  guildIconUrl: string | null;
  isAdmin: boolean;
}

/**
 * Navegação do mobile em gaveta.
 *
 * São dez seções: numa faixa horizontal elas ficam cortadas e escondidas atrás
 * de um gesto que ninguém descobre. Numa lista vertical cabem todas de uma vez,
 * com alvo de toque confortável e espaço para uma linha de contexto em cada.
 */
export function MobileNav({ guildId, guildName, guildIconUrl, isAdmin }: MobileNavProps) {
  const pathname = usePathname();
  const base = `/g/${guildId}`;
  const [open, setOpen] = useState(false);

  // Fechar no clique, e nao num efeito que observa a rota: o efeito dispararia
  // um render em cascata e o lint reclama com razao.
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 md:hidden" aria-label="Abrir menu">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[17rem] gap-0 p-0">
        <SheetHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              {guildIconUrl ? <AvatarImage src={guildIconUrl} alt="" /> : null}
              <AvatarFallback>{guildName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <SheetTitle className="truncate text-base leading-tight">{guildName}</SheetTitle>
              <p className="text-xs text-muted-foreground">
                SquadBot{isAdmin ? ' · admin' : ''}
              </p>
            </div>
          </div>
        </SheetHeader>

        <nav aria-label="Seções do squad" className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {NAV_LINKS.map((link) => {
              const active = isNavLinkActive(link, pathname, base);
              const Icon = link.icon;

              return (
                <li key={link.label}>
                  <Link
                    href={`${base}${link.href}`}
                    onClick={close}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-foreground hover:bg-sidebar-accent/60',
                    )}
                  >
                    <Icon
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        active ? 'text-primary' : 'text-muted-foreground',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight">{link.label}</span>
                      <span className="block text-xs text-muted-foreground">{link.hint}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t p-2">
          <Link
            href="/servidores"
            onClick={close}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60"
          >
            <ArrowLeftRight className="size-4 shrink-0" aria-hidden />
            Trocar de servidor
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
