import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../shared.js';
import { COLORS } from '../../utils/formatting.js';

const data = new SlashCommandBuilder()
  .setName('ajuda')
  .setDescription('Mostra os comandos do SquadBot');

export const helpCommand: SlashCommand = {
  data,
  ephemeral: true,
  async execute({ interaction }) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('🤖 SquadBot')
      .setDescription(
        'A memoria compartilhada do squad. Tudo que voce registra aqui fica organizado e pesquisavel dentro do Discord.',
      )
      .addFields(
        {
          name: '📂 Projetos',
          value:
            '`/projeto criar` · `listar` · `info` · `adicionar` · `remover` · `arquivar` · `reativar`',
        },
        {
          name: '📋 Tarefas',
          value:
            '`/tarefa criar` · `listar` · `minhas` · `concluir` · `cancelar` · `editar` · `excluir`',
        },
        { name: '📝 Notas', value: '`/nota criar` · `listar` · `visualizar` · `excluir`' },
        {
          name: '💡 Ideias',
          value: '`/ideia criar` · `listar` · `visualizar` · `implementar` · `rejeitar` · `status`',
        },
        { name: '⚖️ Decisoes', value: '`/decisao criar` · `listar` · `visualizar`' },
        { name: '🔗 Links', value: '`/link criar` · `listar` · `excluir`' },
        {
          name: '⏰ Lembretes',
          value:
            '`/lembrete criar` · `listar` · `cancelar`\nVoce pode criar lembretes para outra pessoa: `/lembrete criar quando:amanha 09:00 mensagem:"Revisar o PR" para:@Maria`',
        },
        {
          name: '🔍 Visoes',
          value: '`/buscar` · `/minhas` · `/resumo` · `/config timezone` · `/config ver`',
        },
        {
          name: '📅 Formatos de data aceitos',
          value:
            '`amanha 09:00` · `hoje 18:00` · `segunda 14:00` · `2026-08-28 09:00` · `28/08 18:00` · `30m` · `2h` · `3d`',
        },
      )
      .setFooter({ text: 'Datas sao guardadas em UTC e exibidas no seu fuso horario.' });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default helpCommand;
