import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { AutocompleteInvocation, SlashCommand } from '../shared.js';
import { COLORS, successEmbed } from '../../utils/formatting.js';
import { formatDateTime } from '../../utils/dates.js';
import { ValidationError } from '../../utils/errors.js';
import { assertIsAdmin } from '../../utils/permissions.js';

const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configuracoes do SquadBot')
  .addSubcommand((sub) =>
    sub
      .setName('timezone')
      .setDescription('Define o fuso horario usado para interpretar e exibir datas')
      .addStringOption((option) =>
        option
          .setName('valor')
          .setDescription('Identificador IANA, ex.: America/Sao_Paulo')
          .setRequired(true)
          .setAutocomplete(true)
          .setMaxLength(64),
      )
      .addStringOption((option) =>
        option
          .setName('escopo')
          .setDescription('Para voce (padrao) ou para todo o servidor (admin)')
          .addChoices(
            { name: 'Somente para mim', value: 'user' },
            { name: 'Padrao do servidor (admin)', value: 'server' },
          ),
      ),
  )
  .addSubcommand((sub) => sub.setName('ver').setDescription('Mostra a configuracao atual'));

/** Lista de fusos suportada pelo runtime — nao precisa de dependencia externa. */
function listTimeZones(): string[] {
  const supported = Intl.supportedValuesOf?.('timeZone');
  return supported && supported.length > 0 ? [...supported] : ['America/Sao_Paulo', 'UTC'];
}

export const configCommand: SlashCommand = {
  data,
  ephemeral: true,
  async execute({ interaction, context, serverId, actor, isAdmin }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'ver') {
      const serverTimezone = context.services.users.serverTimezone(serverId);
      const now = new Date();
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.primary)
            .setTitle('⚙️ Configuracao')
            .addFields(
              {
                name: 'Seu fuso horario',
                value: `\`${actor.timezone}\`\nAgora: ${formatDateTime(now, actor.timezone)}`,
              },
              {
                name: 'Padrao do servidor',
                value: `\`${serverTimezone}\`\nAgora: ${formatDateTime(now, serverTimezone)}`,
              },
            )
            .setFooter({ text: 'Datas sao guardadas em UTC e exibidas no seu fuso.' }),
        ],
      });
      return;
    }

    if (subcommand === 'timezone') {
      const value = interaction.options.getString('valor', true);
      const scope = interaction.options.getString('escopo') ?? 'user';

      if (scope === 'server') {
        assertIsAdmin(isAdmin, 'alterar o fuso horario padrao do servidor');
        const timezone = context.services.users.setServerTimezone(serverId, value);
        await interaction.editReply({
          embeds: [
            successEmbed(
              'Fuso do servidor atualizado',
              `Novos membros passam a usar \`${timezone}\` por padrao.\nAgora sao **${formatDateTime(new Date(), timezone)}**.`,
            ),
          ],
        });
        return;
      }

      const updated = context.services.users.setUserTimezone(actor.id, value);
      await interaction.editReply({
        embeds: [
          successEmbed(
            'Fuso horario atualizado',
            `Suas datas passam a ser interpretadas e exibidas em \`${updated.timezone}\`.\nAgora sao **${formatDateTime(new Date(), updated.timezone)}**.`,
          ),
        ],
      });
      return;
    }

    throw new ValidationError(`Subcomando desconhecido: ${subcommand}`);
  },
  async autocomplete(invocation: AutocompleteInvocation) {
    const term = invocation.interaction.options.getFocused().toString().toLowerCase();
    const matches = listTimeZones()
      .filter((zone) => zone.toLowerCase().includes(term))
      .slice(0, 25)
      .map((zone) => ({ name: zone, value: zone }));
    await invocation.interaction.respond(matches);
  },
};

export default configCommand;
