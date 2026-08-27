import { ItemsView } from '@/components/items-view';

export const metadata = { title: 'Notas' };

export default async function Page({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <ItemsView guildId={guildId} type="note" />;
}
