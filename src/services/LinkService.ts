import { BaseItemService } from './BaseItemService.js';
import type { Repositories } from '../database/repositories/index.js';
import type { ItemRow, UserRow } from '../types/index.js';
import { ValidationError } from '../utils/errors.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Valida a URL antes de guardar. Alem de evitar lixo no banco, restringir o
 * protocolo a http/https impede que um `javascript:` ou `data:` seja publicado
 * como link clicavel dentro do Discord.
 */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ValidationError('Informe a URL do link.');
  if (trimmed.length > 2000) throw new ValidationError('A URL deve ter no maximo 2000 caracteres.');

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError(
      `URL invalida: \`${trimmed}\`. Use o endereco completo, por exemplo \`https://example.com/docs\`.`,
    );
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ValidationError('Apenas links `http://` ou `https://` sao aceitos.');
  }
  return parsed.toString();
}

export interface CreateLinkInput {
  serverId: string;
  actor: UserRow;
  name: string;
  url: string;
  projectId?: number | null;
}

export class LinkService extends BaseItemService {
  constructor(repos: Repositories) {
    super(repos, 'link', 'active', 'o link');
  }

  /** A URL fica em `content`; o nome amigavel em `title`. */
  createLink(input: CreateLinkInput): ItemRow {
    return this.create({
      serverId: input.serverId,
      actor: input.actor,
      title: input.name,
      content: normalizeUrl(input.url),
      projectId: input.projectId ?? null,
    });
  }

  protected override normalizeContent(content: string | null): string | null {
    if (content === null) return null;
    return normalizeUrl(content);
  }
}
