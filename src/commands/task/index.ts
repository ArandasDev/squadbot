import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import {
  projectOption,
  respondProjectAutocomplete,
  respondWithPages,
  resolveOptionalGuildUser,
  resolveProjectOption,
  userOption,
  type AutocompleteInvocation,
  type CommandInvocation,
  type SlashCommand,
} from '../shared.js';
import {
  COLORS,
  PRIORITY_EMOJI,
  PRIORITY_LABEL,
  TASK_STATUS_EMOJI,
  TASK_STATUS_LABEL,
  escapeMarkdown,
  mentionUser,
  paginate,
  successEmbed,
  truncate,
} from '../../utils/formatting.js';
import { discordTimestamp, parseUserDueDate } from '../../utils/dates.js';
import { ValidationError } from '../../utils/errors.js';
import { isPriority, isTaskStatus, type EditTaskInput } from '../../services/TaskService.js';
import type { ItemWithProject } from '../../database/repositories/index.js';
import type { Priority, TaskStatus } from '../../types/index.js';

const PAGE_SIZE = 10;

const PRIORITY_CHOICES = [
  { name: '🔴 Urgente', value: 'urgent' },
  { name: '🟠 Alta', value: 'high' },
  { name: '🟡 Media', value: 'medium' },
  { name: '🟢 Baixa', value: 'low' },
] as const;

const STATUS_CHOICES = [
  { name: '🔴 Pendente', value: 'pending' },
  { name: '🟡 Em andamento', value: 'in_progress' },
  { name: '🟢 Concluida', value: 'done' },
  { name: '⚫ Cancelada', value: 'cancelled' },
] as const;

const data = new SlashCommandBuilder()
  .setName('tarefa')
  .setDescription('Cria e acompanha as tarefas do squad')
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('Cria uma nova tarefa')
      .addStringOption((option) =>
        option.setName('titulo').setDescription('O que precisa ser feito').setRequired(true).setMaxLength(200),
      )
      .addStringOption((option) => projectOption(option))
      .addUserOption((option) => userOption(option, 'responsavel', 'Quem vai executar'))
      .addStringOption((option) =>
        option
          .setName('prioridade')
          .setDescription('Prioridade da tarefa (padrao: media)')
          .addChoices(...PRIORITY_CHOICES),
      )
      .addStringOption((option) =>
        option
          .setName('prazo')
          .setDescription('Ex.: 2026-08-28, 28/08 18:00, amanha 09:00, 3d')
          .setMaxLength(50),
      )
      .addStringOption((option) =>
        option.setName('descricao').setDescription('Detalhes da tarefa').setMaxLength(2000),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('listar')
      .setDescription('Lista as tarefas do servidor')
      .addStringOption((option) => projectOption(option))
      .addUserOption((option) => userOption(option, 'responsavel', 'Filtrar por responsavel'))
      .addStringOption((option) =>
        option.setName('status').setDescription('Filtrar por status').addChoices(...STATUS_CHOICES),
      ),
  )
  .addSubcommand((sub) => sub.setName('minhas').setDescription('Lista as tarefas atribuidas a voce'))
  .addSubcommand((sub) =>
    sub
      .setName('concluir')
      .setDescription('Marca uma tarefa como concluida')
      .addIntegerOption((option) =>
        option.setName('tarefa').setDescription('Tarefa').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('cancelar')
      .setDescription('Cancela uma tarefa')
      .addIntegerOption((option) =>
        option.setName('tarefa').setDescription('Tarefa').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('excluir')
      .setDescription('Exclui uma tarefa permanentemente')
      .addIntegerOption((option) =>
        option.setName('tarefa').setDescription('Tarefa').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('editar')
      .setDescription('Edita uma tarefa existente')
      .addIntegerOption((option) =>
        option.setName('tarefa').setDescription('Tarefa').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((option) => option.setName('titulo').setDescription('Novo titulo').setMaxLength(200))
      .addStringOption((option) =>
        option.setName('descricao').setDescription('Nova descricao').setMaxLength(2000),
      )
      .addStringOption((option) =>
        option.setName('prioridade').setDescription('Nova prioridade').addChoices(...PRIORITY_CHOICES),
      )
      .addStringOption((option) =>
        option.setName('status').setDescription('Novo status').addChoices(...STATUS_CHOICES),
      )
      .addStringOption((option) =>
        option
          .setName('prazo')
          .setDescription('Novo prazo (use "-" para remover)')
          .setMaxLength(50),
      )
      .addUserOption((option) => userOption(option, 'responsavel', 'Novo responsavel'))
      .addStringOption((option) => projectOption(option)),
  );

function taskLine(task: ItemWithProject): string {
  const priority = PRIORITY_EMOJI[(task.priority ?? 'medium') as Priority];
  const status = task.status === 'in_progress' ? ' 🟡' : '';
  const project = task.project_name ? ` · \`${escapeMarkdown(task.project_name)}\`` : '';
  const assignee = task.assignee_discord_id ? ` · ${mentionUser(task.assignee_discord_id)}` : '';
  const due = task.due_at ? ` · ⏰ ${discordTimestamp(new Date(task.due_at), 'd')}` : '';
  return `${priority}${status} \`#${task.id}\` ${escapeMarkdown(truncate(task.title, 70))}${project}${assignee}${due}`;
}

function taskListPages(tasks: ItemWithProject[], title: string, emptyMessage: string): EmbedBuilder[] {
  if (tasks.length === 0) {
    return [new EmbedBuilder().setColor(COLORS.neutral).setTitle(title).setDescription(emptyMessage)];
  }

  return paginate(tasks, PAGE_SIZE).map((chunk, pageIndex, all) =>
    new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle(title)
      .setDescription(chunk.map((task) => taskLine(task)).join('\n'))
      .setFooter({ text: `Pagina ${pageIndex + 1}/${all.length} · ${tasks.length} tarefa(s)` }),
  );
}

function parseDeadline(invocation: CommandInvocation, raw: string): Date {
  const parsed = parseUserDueDate(raw, invocation.actor.timezone);
  if (!parsed) {
    throw new ValidationError(
      [
        `Nao entendi o prazo \`${raw}\`.`,
        '',
        'Formatos aceitos: `2026-08-28`, `28/08`, `28/08 18:00`, `amanha 09:00`, `sexta`, `3d`.',
      ].join('\n'),
    );
  }
  return parsed;
}

async function handleCreate(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor } = invocation;

  const priorityRaw = interaction.options.getString('prioridade');
  if (priorityRaw && !isPriority(priorityRaw)) throw new ValidationError('Prioridade invalida.');

  const deadlineRaw = interaction.options.getString('prazo');
  const assignee = await resolveOptionalGuildUser(invocation, 'responsavel');

  const task = context.services.tasks.create({
    serverId,
    actor,
    title: interaction.options.getString('titulo', true),
    projectId: resolveProjectOption(invocation) ?? null,
    description: interaction.options.getString('descricao'),
    assignedTo: assignee,
    priority: (priorityRaw as Priority | null) ?? 'medium',
    dueAt: deadlineRaw ? parseDeadline(invocation, deadlineRaw) : null,
  });

  const detail = context.services.tasks.detail(serverId, task.id);
  const lines = [
    `**${escapeMarkdown(task.title)}** \`#${task.id}\``,
    `${PRIORITY_EMOJI[(task.priority ?? 'medium') as Priority]} Prioridade: **${PRIORITY_LABEL[(task.priority ?? 'medium') as Priority]}**`,
  ];
  if (detail.project_name) lines.push(`📂 Projeto: **${escapeMarkdown(detail.project_name)}**`);
  if (detail.assignee_discord_id) lines.push(`👤 Responsavel: ${mentionUser(detail.assignee_discord_id)}`);
  if (task.due_at) lines.push(`⏰ Prazo: ${discordTimestamp(new Date(task.due_at), 'f')}`);

  await interaction.editReply({ embeds: [successEmbed('Tarefa criada', lines.join('\n'))] });
}

async function handleList(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId } = invocation;

  const statusRaw = interaction.options.getString('status');
  if (statusRaw && !isTaskStatus(statusRaw)) throw new ValidationError('Status invalido.');

  const assignee = await resolveOptionalGuildUser(invocation, 'responsavel');
  const projectId = resolveProjectOption(invocation);

  const tasks = context.services.tasks.list({
    serverId,
    ...(projectId !== undefined ? { projectId } : {}),
    ...(assignee ? { assignedTo: assignee.id } : {}),
    ...(statusRaw ? { status: statusRaw as TaskStatus } : {}),
  });

  await respondWithPages(
    interaction,
    taskListPages(tasks, '📋 Tarefas', 'Nenhuma tarefa encontrada com esses filtros.'),
  );
}

async function handleMine(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor } = invocation;
  const tasks = context.services.tasks.mine(serverId, actor.id);

  await respondWithPages(
    interaction,
    taskListPages(tasks, '📋 Suas tarefas', 'Voce nao tem tarefas em aberto. Aproveite. 🎉'),
  );
}

async function handleTransition(
  invocation: CommandInvocation,
  action: 'concluir' | 'cancelar' | 'excluir',
): Promise<void> {
  const { interaction, context, serverId, actor, isAdmin } = invocation;
  const taskId = interaction.options.getInteger('tarefa', true);

  if (action === 'concluir') {
    const task = context.services.tasks.complete(serverId, taskId, actor, isAdmin);
    await interaction.editReply({
      embeds: [successEmbed('Tarefa concluida', `🟢 \`#${task.id}\` ${escapeMarkdown(task.title)}`)],
    });
    return;
  }

  if (action === 'cancelar') {
    const task = context.services.tasks.cancel(serverId, taskId, actor, isAdmin);
    await interaction.editReply({
      embeds: [successEmbed('Tarefa cancelada', `⚫ \`#${task.id}\` ${escapeMarkdown(task.title)}`)],
    });
    return;
  }

  const task = context.services.tasks.remove(serverId, taskId, actor, isAdmin);
  await interaction.editReply({
    embeds: [successEmbed('Tarefa excluida', `🗑️ \`#${task.id}\` ${escapeMarkdown(task.title)}`)],
  });
}

async function handleEdit(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor, isAdmin } = invocation;
  const taskId = interaction.options.getInteger('tarefa', true);

  const patch: EditTaskInput = {};

  const title = interaction.options.getString('titulo');
  if (title !== null) patch.title = title;

  const description = interaction.options.getString('descricao');
  if (description !== null) patch.description = description;

  const priorityRaw = interaction.options.getString('prioridade');
  if (priorityRaw !== null) {
    if (!isPriority(priorityRaw)) throw new ValidationError('Prioridade invalida.');
    patch.priority = priorityRaw;
  }

  const statusRaw = interaction.options.getString('status');
  if (statusRaw !== null) {
    if (!isTaskStatus(statusRaw)) throw new ValidationError('Status invalido.');
    patch.status = statusRaw;
  }

  const deadlineRaw = interaction.options.getString('prazo');
  if (deadlineRaw !== null) {
    if (deadlineRaw.trim() === '-' || deadlineRaw.trim().toLowerCase() === 'remover') {
      patch.clearDueAt = true;
    } else {
      patch.dueAt = parseDeadline(invocation, deadlineRaw);
    }
  }

  const assignee = await resolveOptionalGuildUser(invocation, 'responsavel');
  if (assignee) patch.assignedTo = assignee;

  const projectId = resolveProjectOption(invocation);
  if (projectId !== undefined) patch.projectId = projectId;

  const updated = context.services.tasks.edit(serverId, taskId, patch, actor, isAdmin);
  const detail = context.services.tasks.detail(serverId, updated.id);

  const lines = [
    `**${escapeMarkdown(updated.title)}** \`#${updated.id}\``,
    `${TASK_STATUS_EMOJI[updated.status as TaskStatus]} Status: **${TASK_STATUS_LABEL[updated.status as TaskStatus]}**`,
    `${PRIORITY_EMOJI[(updated.priority ?? 'medium') as Priority]} Prioridade: **${PRIORITY_LABEL[(updated.priority ?? 'medium') as Priority]}**`,
  ];
  if (detail.project_name) lines.push(`📂 Projeto: **${escapeMarkdown(detail.project_name)}**`);
  if (detail.assignee_discord_id) lines.push(`👤 Responsavel: ${mentionUser(detail.assignee_discord_id)}`);
  lines.push(
    updated.due_at ? `⏰ Prazo: ${discordTimestamp(new Date(updated.due_at), 'f')}` : '⏰ Prazo: _sem prazo_',
  );

  await interaction.editReply({ embeds: [successEmbed('Tarefa atualizada', lines.join('\n'))] });
}

export const taskCommand: SlashCommand = {
  data,
  async execute(invocation) {
    const subcommand = invocation.interaction.options.getSubcommand();

    switch (subcommand) {
      case 'criar':
        return handleCreate(invocation);
      case 'listar':
        return handleList(invocation);
      case 'minhas':
        return handleMine(invocation);
      case 'concluir':
        return handleTransition(invocation, 'concluir');
      case 'cancelar':
        return handleTransition(invocation, 'cancelar');
      case 'excluir':
        return handleTransition(invocation, 'excluir');
      case 'editar':
        return handleEdit(invocation);
      default:
        throw new ValidationError(`Subcomando desconhecido: ${subcommand}`);
    }
  },
  async autocomplete(invocation: AutocompleteInvocation) {
    const focused = invocation.interaction.options.getFocused(true);

    if (focused.name === 'projeto') {
      await respondProjectAutocomplete(invocation);
      return;
    }

    if (focused.name === 'tarefa') {
      const choices = invocation.context.services.tasks.autocomplete(
        invocation.serverId,
        focused.value.toString(),
      );
      await invocation.interaction.respond(choices.slice(0, 25));
      return;
    }

    await invocation.interaction.respond([]);
  },
};

export default taskCommand;
