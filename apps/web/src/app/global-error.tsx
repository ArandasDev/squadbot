'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Fronteira de erro da raiz. Substitui o layout inteiro, por isso precisa
 * renderizar o proprio `<html>` e `<body>`.
 *
 * Deliberadamente sem providers, sem componentes do design system e sem
 * dependencia de contexto: se o erro veio justamente de um provider, a tela de
 * erro nao pode depender dele para aparecer. Só Tailwind e HTML.
 *
 * Ter este arquivo tambem evita que o Next precise gerar e prerenderizar a
 * pagina interna `/_global-error`.
 */
export default function GlobalError({
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
    <html lang="pt-BR">
      <body className="bg-background text-foreground antialiased">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-mono text-sm text-muted-foreground">Erro inesperado</p>
          <h1 className="text-2xl font-semibold tracking-tight">Algo quebrou por aqui</h1>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            O detalhe técnico foi registrado no servidor. Tente de novo — se persistir, avise um
            administrador do squad.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">digest: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
