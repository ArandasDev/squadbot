'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ITEM_TYPE_PLURAL } from '@/lib/format';

const TODOS = 'todos';

/** Busca por URL: o resultado é linkável e sobrevive ao refresh. */
export function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const termo = String(formData.get('q') ?? '').trim();
    const tipo = String(formData.get('tipo') ?? TODOS);

    const params = new URLSearchParams();
    if (termo) params.set('q', termo);
    if (tipo !== TODOS) params.set('tipo', tipo);

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:min-w-[240px] sm:flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          name="q"
          type="search"
          defaultValue={searchParams.get('q') ?? ''}
          placeholder="Buscar em tarefas, notas, ideias, decisões e links…"
          aria-label="Termo de busca"
          minLength={2}
          className="pl-9"
        />
      </div>

      <Select name="tipo" defaultValue={searchParams.get('tipo') ?? TODOS}>
        <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filtrar por tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os tipos</SelectItem>
          {Object.entries(ITEM_TYPE_PLURAL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Buscar
      </Button>
    </form>
  );
}
