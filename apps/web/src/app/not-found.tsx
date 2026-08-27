import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        O endereço não existe, ou o registro foi removido do squad.
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/servidores">Voltar aos servidores</Link>
      </Button>
    </main>
  );
}
