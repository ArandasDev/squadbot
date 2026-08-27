'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Fronteira de erro do dashboard. O detalhe técnico fica no console/log do
 * servidor; o usuário recebe uma mensagem que não vaza infraestrutura.
 */
export default function GuildError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <TriangleAlert className="size-8 text-destructive" aria-hidden />
      <p className="font-medium">Não foi possível carregar esta página.</p>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Pode ser uma instabilidade momentânea na conexão com o bot. Tente novamente ou avise um
        administrador.
      </p>
      <Button onClick={reset} variant="outline" className="mt-2">
        Tentar novamente
      </Button>
    </div>
  );
}
