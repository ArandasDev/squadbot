import type { Repositories } from '../database/repositories/index.js';
import type { ProjectRow, ProjectStatus, UserRow } from '../types/index.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { assertCanManageProject, assertIsAdmin } from '../utils/permissions.js';

const NAME_MAX = 60;
const DESCRIPTION_MAX = 1000;

export interface ProjectSummary {
  project: ProjectRow;
  memberCount: number;
  taskCounts: Record<string, number>;
}

export class ProjectService {
  constructor(private readonly repos: Repositories) {}

  create(serverId: string, name: string, description: string | null, actor: UserRow): ProjectRow {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      throw new ValidationError('O nome do projeto precisa ter pelo menos 2 caracteres.');
    }
    if (cleanName.length > NAME_MAX) {
      throw new ValidationError(`O nome do projeto deve ter no maximo ${NAME_MAX} caracteres.`);
    }
    if (description && description.length > DESCRIPTION_MAX) {
      throw new ValidationError(`A descricao deve ter no maximo ${DESCRIPTION_MAX} caracteres.`);
    }
    if (this.repos.projects.findByName(serverId, cleanName)) {
      throw new ValidationError(`Ja existe um projeto chamado **${cleanName}** neste servidor.`);
    }

    // Criar o projeto e vincular o criador como membro é uma operacao unica.
    const project = this.repos.projects.create({
      serverId,
      name: cleanName,
      description: description?.trim() || null,
      createdBy: actor.id,
    });
    this.repos.projects.addMember(project.id, actor.id);
    return project;
  }

  list(serverId: string, status?: ProjectStatus): ProjectRow[] {
    return this.repos.projects.listByServer(serverId, status);
  }

  /** Busca por id numerico (vindo do autocomplete) ou por nome exato. */
  resolve(serverId: string, value: string): ProjectRow | undefined {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const byId = this.repos.projects.findByIdInServer(Number.parseInt(trimmed, 10), serverId);
      if (byId) return byId;
    }
    return this.repos.projects.findByName(serverId, trimmed);
  }

  /** Igual a `resolve`, mas lanca um erro amigavel quando nao encontra. */
  require(serverId: string, value: string): ProjectRow {
    const project = this.resolve(serverId, value);
    if (!project) {
      throw new NotFoundError(
        `Projeto **${value}** nao encontrado neste servidor. Use \`/projeto listar\` para ver os disponiveis.`,
      );
    }
    return project;
  }

  requireById(serverId: string, id: number): ProjectRow {
    const project = this.repos.projects.findByIdInServer(id, serverId);
    if (!project) throw new NotFoundError('Projeto nao encontrado neste servidor.');
    return project;
  }

  info(serverId: string, projectId: number): ProjectSummary {
    const project = this.requireById(serverId, projectId);
    return {
      project,
      memberCount: this.repos.projects.countMembers(project.id),
      taskCounts: this.repos.items.countTasksByStatus(serverId, project.id),
    };
  }

  members(projectId: number): UserRow[] {
    return this.repos.projects.listMembers(projectId);
  }

  addMember(serverId: string, projectId: number, member: UserRow, actor: UserRow, isAdmin: boolean): ProjectRow {
    const project = this.requireById(serverId, projectId);
    assertCanManageProject(project, actor, isAdmin);
    if (this.repos.projects.isMember(project.id, member.id)) {
      throw new ValidationError(`**${member.username}** ja faz parte do projeto **${project.name}**.`);
    }
    this.repos.projects.addMember(project.id, member.id);
    return project;
  }

  removeMember(
    serverId: string,
    projectId: number,
    member: UserRow,
    actor: UserRow,
    isAdmin: boolean,
  ): ProjectRow {
    const project = this.requireById(serverId, projectId);
    assertCanManageProject(project, actor, isAdmin);
    const removed = this.repos.projects.removeMember(project.id, member.id);
    if (!removed) {
      throw new ValidationError(`**${member.username}** nao faz parte do projeto **${project.name}**.`);
    }
    return project;
  }

  setStatus(
    serverId: string,
    projectId: number,
    status: ProjectStatus,
    actor: UserRow,
    isAdmin: boolean,
  ): ProjectRow {
    const project = this.requireById(serverId, projectId);
    assertCanManageProject(project, actor, isAdmin);
    if (project.status === status) {
      throw new ValidationError(
        status === 'archived'
          ? `O projeto **${project.name}** ja esta arquivado.`
          : `O projeto **${project.name}** ja esta ativo.`,
      );
    }
    return this.repos.projects.updateStatus(project.id, status) as ProjectRow;
  }

  /** Exclusao de projeto é restrita a administradores. */
  requireAdminForDeletion(isAdmin: boolean): void {
    assertIsAdmin(isAdmin, 'excluir projetos');
  }

  /** Sugestoes de autocomplete no formato `{ name, value }` do Discord. */
  autocomplete(serverId: string, term: string, onlyActive = false): { name: string; value: string }[] {
    const results = this.repos.projects.searchByName(serverId, term, 25);
    return results
      .filter((project) => !onlyActive || project.status === 'active')
      .map((project) => ({
        name: project.status === 'archived' ? `${project.name} (arquivado)` : project.name,
        value: String(project.id),
      }));
  }
}
