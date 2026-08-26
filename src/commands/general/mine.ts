import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../shared.js';
import { COLORS, escapeMarkdown, truncate } from '../../utils/formatting.js';
import { discordTimestamp } from '../../utils/dates.js';
import type { ItemWithProject } from '../../database/repositories/index.js';
import type { Priority } from '../../types/index.js';

const MAX_PER_GROUP = 8;

const data = new SlashCommandBuilder()
  .setName('minhas')
  .setDescription('Sua visao pessoal: tarefas, lembretes e ideias recentes');

function renderTasks(tasks: ItemWithProject[]): string {
  return tasks
    .slice(0, MAX_PER_GROUP)
    .map((task) => {
      const project = task.project_name ? ` · \`${escapeMarkdown(task.project_name)}\`` : '';
      const due = task.due_at ? ` · ⏰ ${discordTimestamp(new Date(task.due_at), 'd')}` : '';
      return `• \`#${task.id}\` ${escapeMarkdown(truncate(task.title, 60))}${project}${due}`;
    })
    .join('\n');
}

export const mineCommand: SlashCommand = {
  data,
  ephemeral: true,
  async execute({ interaction, context, serverId, actor }) {
    const tasks = context.services.tasks.mine(serverId, actor.id, 100);

    const inProgress = tasks.filter((task) => task.status === 'in_progress');
    const pending = tasks.filter((task) => task.status !== 'in_progress');
    const byPriority = (priority: Priority): ItemWithProject[] =>
      pending.filter((task) => (task.priority ?? 'medium') === priority);

    const urgent = byPriority('urgent');
    const high = byPriority('high');
    const normal = [...byPriority('medium'), ...byPriority('low')];

    const reminders = context.services.reminders.listUpcomingForUser(serverId, actor.id, 5);
    const ideas = context.services.ideas.latestOpen(serverId, 3);

    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('📋 Suas responsabilidades')
      .setFooter({ text: `${tasks.length} tarefa(s) em aberto · fuso ${actor.timezone}` });

    if (tasks.length === 0) {
      embed.setDescription('Voce nao tem tarefas em aberto. 🎉');
    } else {
      if (urgent.length > 0) {
        embed.addFields({ name: `🔴 Urgentes (${urgent.length})`, value: renderTasks(urgent) });
      }
      if (high.length > 0) {
        embed.addFields({ name: `🟠 Alta prioridade (${high.length})`, value: renderTasks(high) });
      }
      if (inProgress.length > 0) {
        embed.addFields({
          name: `🟡 Em andamento (${inProgress.length})`,
          value: renderTasks(inProgress),
        });
      }
      if (normal.length > 0) {
        embed.addFields({ name: `🟢 Demais tarefas (${normal.length})`, value: renderTasks(normal) });
      }
    }

    embed.addFields({
      name: '⏰ Proximos lembretes',
      value:
        reminders.length > 0
          ? reminders
              .map(
                (reminder) =>
                  `• ${discordTimestamp(new Date(reminder.remind_at), 'f')} — ${escapeMarkdown(truncate(reminder.message, 60))}`,
              )
              .join('\n')
          : '_Nenhum lembrete agendado_',
    });

    embed.addFields({
      name: '💡 Ultimas ideias do squad',
      value:
        ideas.length > 0
          ? ideas
              .map((idea) => `• \`#${idea.id}\` ${escapeMarkdown(truncate(idea.title, 60))}`)
              .join('\n')
          : '_Nenhuma ideia registrada_',
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default mineCommand;
