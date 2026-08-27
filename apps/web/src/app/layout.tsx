import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

/**
 * Nada neste app e estatico: toda pagina depende de quem esta logado e do
 * servidor selecionado. Declarar aqui vale para todas as rotas aninhadas e
 * impede que o build tente prerenderizar paginas que chamam auth() — sem
 * request, sem cookie e sem as variaveis de ambiente de runtime.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'SquadBot',
    template: '%s · SquadBot',
  },
  description: 'A memória compartilhada do seu squad: tarefas, notas, ideias, decisões e lembretes.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
