import { BellRing } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { ReminderDTO } from '@/lib/api/types';

export const metadata = { title: 'Lembretes' };

function Lista({
  reminders,
  timezone,
  vazio,
}: {
  reminders: ReminderDTO[];
  timezone: string;
  vazio: string;
}) {
  if (reminders.length === 0) {
    return <EmptyState icon={BellRing} title="Nenhum lembrete agendado" description={vazio} />;
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {reminders.map((reminder) => {
        const paraOutro = reminder.createdBy.id !== reminder.recipient.id;

        return (
          <li key={reminder.id} className="flex flex-wrap items-start gap-3 p-3">
            <Badge variant="outline" className="shrink-0 font-normal tabular-nums">
              {formatRelative(reminder.remindAt, timezone)}
            </Badge>

            <div className="min-w-0 flex-1">
              <p className="text-sm">{reminder.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-mono">#{reminder.id}</span>
                {' · '}
                para @{reminder.recipient.username}
                {paraOutro ? ` · criado por @${reminder.createdBy.username}` : ''}
                {' · '}
                {formatDateTime(reminder.remindAt, timezone)}
              </p>
            </div>

            {reminder.itemTitle ? (
              <Badge variant="secondary" className="shrink-0 max-w-[200px] truncate font-normal">
                {reminder.itemTitle}
              </Badge>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default async function LembretesPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const [meus, doSquad, me] = await Promise.all([
    api.reminders(guildId, 'me'),
    api.reminders(guildId, 'server'),
    api.me(guildId),
  ]);

  const timezone = me.user.timezone;

  return (
    <>
      <PageHeader
        title="Lembretes"
        description="Agendados e ainda não enviados. A entrega acontece por DM no Discord."
      />

      <Tabs defaultValue="meus">
        <TabsList>
          <TabsTrigger value="meus">Para mim ({meus.length})</TabsTrigger>
          <TabsTrigger value="squad">Do squad ({doSquad.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="meus" className="mt-4">
          <Lista
            reminders={meus}
            timezone={timezone}
            vazio="Crie um com /lembrete criar no Discord — sem a opção `para`, ele vem para você."
          />
        </TabsContent>

        <TabsContent value="squad" className="mt-4">
          <Lista
            reminders={doSquad}
            timezone={timezone}
            vazio="Ninguém do squad tem lembretes pendentes."
          />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Para criar ou cancelar, use <code className="font-mono">/lembrete</code> no Discord — é lá
        que o seletor de data entende “amanhã 09:00”.
      </p>
    </>
  );
}
