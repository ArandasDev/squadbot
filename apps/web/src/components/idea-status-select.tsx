'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { setIdeaStatusAction } from '@/app/g/[guildId]/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IDEA_STATUS_LABEL } from '@/lib/format';
import type { IdeaStatus } from '@/lib/api/types';

interface IdeaStatusSelectProps {
  guildId: string;
  ideaId: number;
  status: IdeaStatus;
}

/** Move a ideia pelo ciclo de vida. A permissão é decidida pela API do bot. */
export function IdeaStatusSelect({ guildId, ideaId, status }: IdeaStatusSelectProps) {
  const [pending, startTransition] = useTransition();

  function change(novo: string) {
    if (novo === status) return;

    startTransition(async () => {
      const result = await setIdeaStatusAction(guildId, ideaId, novo);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <Select value={status} onValueChange={change} disabled={pending}>
      <SelectTrigger size="sm" className="w-[150px]" aria-label="Status da ideia">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(IDEA_STATUS_LABEL).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
