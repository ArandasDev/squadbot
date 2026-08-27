import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import {
  respondWithPages,
  resolveOptionalGuildUser,
  userOption,
  type AutocompleteInvocation,
  type CommandInvocation,
  type SlashCommand,
} from '../shared.js';
import { COLORS, escapeMarkdown, mentionUser, paginate, successEmbed } from '../../utils/formatting.js';
import { discordTimestamp, formatDateTime } from '../../utils/dates.js';
import { ValidationError } from '../../utils/errors.js';

const PAGE_SIZE = 8;

const data = new SlashCommandBuilder()
  .setName('lembrete')
  .setDescription('Cria lembretes para voce ou para o squad')
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('Cria um lembrete (para voce ou para outra pessoa)')
      .addStringOption((option) =>
        option
          .setName('quando')
          .setDescription('Ex.: amanha 09:00, hoje 18:00, segunda 14:00, 2026-08-28 09:00, 2h')
          .setRequired(true)
          .setMaxLength(50),
      )
      .addStringOption((option) =>
        option
          .setName('mensagem')
          .setDescription('O que lembrar')
          .setRequired(true)
          .setMaxLength(1000),
      )
      .addUserOption((option) =>
        userOption(option, 'para', 'Quem vai receber (padrao: voce mesmo)'),
      )
      .addIntegerOption((option) =>
        option
          .setName('tarefa')
          .setDescription('Vincular a uma tarefa')
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('listar')
      .setDescription('Lista os proximos lembretes')
      .addUserOption((option) =>
        userOption(option, 'de', 'Ver os lembretes de outra pessoa (padrao: voce)'),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('cancelar')
      .setDescription('Cancela um lembrete ainda nao enviado')
      .addIntegerOption((option) =>
        option.setName('lembrete').setDescription('Lembrete').setRequired(true).setAutocomplete(true),
      ),
  );

async function handleCreate(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor } = invocation;

  // Sem `para`, o destinatario é quem executou o comando.
  const recipient = (await resolveOptionalGuildUser(invocation, 'para')) ?? actor;
  const taskId = interaction.options.getInteger('tarefa');

  const { reminder, remindAt } = context.services.reminders.create({
    serverId,
    actor,
    recipient,
    whenInput: interaction.options.getString('quando', true),
    message: interaction.options.getString('mensagem', true),
    itemId: taskId,
  });

  const forSelf = recipient.id === actor.id;
  const lines = [
    `**${escapeMarkdown(reminder.message)}**`,
    '',
    `👤 Para: ${forSelf ? 'voce' : mentionUser(recipient.discord_id)}`,
    `⏰ Quando: ${discordTimestamp(remindAt, 'F')} (${discordTimestamp(remindAt, 'R')})`,
  ];

  // Quando os fusos diferem, deixamos explicito como a data foi interpretada.
  if (recipient.timezone !== actor.timezone) {
    lines.push(
      '',
      `_Interpretado no seu fuso (${actor.timezone}): ${formatDateTime(remindAt, actor.timezone)}_`,
      `_No fuso de ${escapeMarkdown(recipient.username)} (${recipient.timezone}): ${formatDateTime(remindAt, recipient.timezone)}_`,
    );
  }

  await interaction.editReply({
    embeds: [successEmbed('Lembrete agendado', lines.join('\n')).setFooter({ text: `#${reminder.id}` })],
  });
}

async function handleList(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor } = invocation;

  const target = (await resolveOptionalGuildUser(invocation, 'de')) ?? actor;
  const reminders = context.services.reminders.listUpcomingForUser(serverId, target.id, 100);

  if (reminders.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.neutral)
          .setTitle('⏰ Proximos lembretes')
          .setDescription(
            target.id === actor.id
              ? 'Voce nao tem lembretes agendados. Crie um com `/lembrete criar`.'
              : `**${escapeMarkdown(target.username)}** nao tem lembretes agendados.`,
          ),
      ],
    });
    return;
  }

  const pages = paginate(reminders, PAGE_SIZE).map((chunk, pageIndex, all) =>
    new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle(
        target.id === actor.id
          ? '⏰ Seus proximos lembretes'
          : `⏰ Lembretes de ${target.username}`,
      )
      .setDescription(
        chunk
          .map((reminder) => {
            const author =
              reminder.created_by === reminder.recipient_id
                ? ''
                : ` · criado por ${mentionUser(reminder.creator_discord_id)}`;
            return `• \`#${reminder.id}\` ${discordTimestamp(new Date(reminder.remind_at), 'f')} — ${escapeMarkdown(reminder.message)}${author}`;
          })
          .join('\n'),
      )
      .setFooter({ text: `Pagina ${pageIndex + 1}/${all.length} · ${reminders.length} lembrete(s)` }),
  );

  await respondWithPages(interaction, pages);
}

async function handleCancel(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor, isAdmin } = invocation;
  const reminder = context.services.reminders.cancel(
    serverId,
    interaction.options.getInteger('lembrete', true),
    actor,
    isAdmin,
  );

  await interaction.editReply({
    embeds: [
      successEmbed('Lembrete cancelado', `🗑️ \`#${reminder.id}\` ${escapeMarkdown(reminder.message)}`),
    ],
  });
}

export const reminderCommand: SlashCommand = {
  data,
  async execute(invocation) {
    const subcommand = invocation.interaction.options.getSubcommand();

    switch (subcommand) {
      case 'criar':
        return handleCreate(invocation);
      case 'listar':
        return handleList(invocation);
      case 'cancelar':
        return handleCancel(invocation);
      default:
        throw new ValidationError(`Subcomando desconhecido: ${subcommand}`);
    }
  },
  async autocomplete(invocation: AutocompleteInvocation) {
    const { interaction, context, serverId } = invocation;
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'tarefa') {
      const choices = context.services.tasks.autocomplete(serverId, focused.value.toString());
      await interaction.respond(choices.slice(0, 25));
      return;
    }

    if (focused.name === 'lembrete') {
      const actor = context.services.users.findByDiscordId(serverId, interaction.user.id);
      if (!actor) {
        await interaction.respond([]);
        return;
      }
      const choices = context.services.reminders.autocompleteCancellable(
        serverId,
        actor.id,
        focused.value.toString(),
      );
      await interaction.respond(choices.slice(0, 25));
      return;
    }

    await interaction.respond([]);
  },
};

export default reminderCommand;
