import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../shared.js';
import { COLORS, escapeMarkdown, truncate } from '../../utils/formatting.js';
import { discordTimestamp } from '../../utils/dates.js';

const MAX_PROJECTS = 10;

const data = new SlashCommandBuilder()
  .setName('resumo')
  .setDescription('Visao geral do squad: projetos, tarefas, lembretes e ideias');

export const summaryCommand: SlashCommand = {
  data,
  async execute({ interaction, context, serverId }) {
    const projects = context.services.projects.list(serverId, 'active');

    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('📊 Squad')
      .setTimestamp(new Date());

    if (projects.length === 0) {
      embed.setDescription('Nenhum projeto ativo. Comece com `/projeto criar`.');
    }

    for (const project of projects.slice(0, MAX_PROJECTS)) {
      const counts = context.repos.items.countTasksByStatus(serverId, project.id);
      embed.addFields({
        name: `📂 ${truncate(project.name, 60)}`,
        value: [
          `🔴 Pendentes: **${counts.pending ?? 0}**`,
          `🟡 Em andamento: **${counts.in_progress ?? 0}**`,
          `🟢 Concluidas: **${counts.done ?? 0}**`,
        ].join('\n'),
        inline: true,
      });
    }

    // Tarefas sem projeto tambem contam para o squad.
    const orphanCounts = context.repos.items.countTasksByStatus(serverId, null);
    const orphanOpen = (orphanCounts.pending ?? 0) + (orphanCounts.in_progress ?? 0);
    if (orphanOpen > 0) {
      embed.addFields({
        name: '📄 Sem projeto',
        value: [
          `🔴 Pendentes: **${orphanCounts.pending ?? 0}**`,
          `🟡 Em andamento: **${orphanCounts.in_progress ?? 0}**`,
          `🟢 Concluidas: **${orphanCounts.done ?? 0}**`,
        ].join('\n'),
        inline: true,
      });
    }

    const upcoming = context.services.reminders.listUpcomingForServer(serverId, 3);
    const pendingReminders = context.services.reminders.countPending(serverId);
    const newIdeas = context.services.ideas.countNew(serverId);

    embed.addFields({
      name: `⏰ Proximos lembretes (${pendingReminders})`,
      value:
        upcoming.length > 0
          ? upcoming
              .map(
                (reminder) =>
                  `• ${discordTimestamp(new Date(reminder.remind_at), 'f')} — ${escapeMarkdown(truncate(reminder.message, 50))} (${escapeMarkdown(reminder.recipient_username)})`,
              )
              .join('\n')
          : '_Nenhum lembrete agendado_',
    });

    embed.addFields({
      name: '💡 Novas ideias',
      value: `**${newIdeas}** aguardando avaliacao`,
      inline: true,
    });

    if (projects.length > MAX_PROJECTS) {
      embed.setFooter({
        text: `Mostrando ${MAX_PROJECTS} de ${projects.length} projetos ativos · use /projeto listar`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default summaryCommand;
