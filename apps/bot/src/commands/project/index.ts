import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import {
  projectOption,
  respondProjectAutocomplete,
  respondWithPages,
  resolveGuildUser,
  userOption,
  type AutocompleteInvocation,
  type CommandInvocation,
  type SlashCommand,
} from '../shared.js';
import { COLORS, escapeMarkdown, mentionUser, paginate, successEmbed } from '../../utils/formatting.js';
import { formatDate } from '../../utils/dates.js';
import { ValidationError } from '../../utils/errors.js';
import type { ProjectStatus } from '../../types/index.js';

const PAGE_SIZE = 8;

const data = new SlashCommandBuilder()
  .setName('projeto')
  .setDescription('Gerencia os projetos do squad')
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('Cria um novo projeto')
      .addStringOption((option) =>
        option.setName('nome').setDescription('Nome do projeto').setRequired(true).setMaxLength(60),
      )
      .addStringOption((option) =>
        option
          .setName('descricao')
          .setDescription('Para que serve este projeto')
          .setRequired(false)
          .setMaxLength(1000),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('listar')
      .setDescription('Lista os projetos do servidor')
      .addStringOption((option) =>
        option
          .setName('status')
          .setDescription('Filtrar por status')
          .setRequired(false)
          .addChoices(
            { name: 'Ativos', value: 'active' },
            { name: 'Arquivados', value: 'archived' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('info')
      .setDescription('Mostra os detalhes de um projeto')
      .addStringOption((option) => projectOption(option, true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('adicionar')
      .setDescription('Adiciona um membro ao projeto')
      .addStringOption((option) => projectOption(option, true))
      .addUserOption((option) => userOption(option, 'membro', 'Quem sera adicionado', true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remover')
      .setDescription('Remove um membro do projeto')
      .addStringOption((option) => projectOption(option, true))
      .addUserOption((option) => userOption(option, 'membro', 'Quem sera removido', true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('arquivar')
      .setDescription('Arquiva um projeto (mantem o historico, some das listas ativas)')
      .addStringOption((option) => projectOption(option, true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reativar')
      .setDescription('Reativa um projeto arquivado')
      .addStringOption((option) => projectOption(option, true)),
  );

async function handleCreate(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor } = invocation;
  const name = interaction.options.getString('nome', true);
  const description = interaction.options.getString('descricao');

  const project = context.services.projects.create(serverId, name, description, actor);

  await interaction.editReply({
    embeds: [
      successEmbed(
        'Projeto criado',
        [
          `**${escapeMarkdown(project.name)}** \`#${project.id}\``,
          project.description ? `\n${escapeMarkdown(project.description)}` : '',
          `\nVoce ja faz parte dele. Use \`/tarefa criar projeto:${project.name}\` para comecar.`,
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    ],
  });
}

async function handleList(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId } = invocation;
  const status = interaction.options.getString('status') as ProjectStatus | null;
  const projects = context.services.projects.list(serverId, status ?? undefined);

  if (projects.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.neutral)
          .setTitle('📁 Projetos')
          .setDescription('Nenhum projeto ainda. Crie o primeiro com `/projeto criar`.'),
      ],
    });
    return;
  }

  const pages = paginate(projects, PAGE_SIZE).map((chunk, pageIndex, all) => {
    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('📁 Projetos')
      .setFooter({ text: `Pagina ${pageIndex + 1}/${all.length} · ${projects.length} projeto(s)` });

    for (const project of chunk) {
      const counts = context.repos.items.countTasksByStatus(serverId, project.id);
      const open = (counts.pending ?? 0) + (counts.in_progress ?? 0);
      const icon = project.status === 'archived' ? '📦' : '📂';
      embed.addFields({
        name: `${icon} ${project.name} · #${project.id}`,
        value: [
          project.description ? escapeMarkdown(project.description) : '_Sem descricao_',
          `Tarefas abertas: **${open}** · Concluidas: **${counts.done ?? 0}**`,
        ].join('\n'),
      });
    }

    return embed;
  });

  await respondWithPages(interaction, pages);
}

async function handleInfo(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor } = invocation;
  const project = context.services.projects.require(serverId, interaction.options.getString('projeto', true));
  const info = context.services.projects.info(serverId, project.id);
  const members = context.services.projects.members(project.id);

  const counts = info.taskCounts;
  const embed = new EmbedBuilder()
    .setColor(project.status === 'archived' ? COLORS.neutral : COLORS.primary)
    .setTitle(`${project.status === 'archived' ? '📦' : '📂'} ${project.name}`)
    .setDescription(project.description ? escapeMarkdown(project.description) : '_Sem descricao_')
    .addFields(
      {
        name: 'Tarefas',
        value: [
          `🔴 Pendentes: **${counts.pending ?? 0}**`,
          `🟡 Em andamento: **${counts.in_progress ?? 0}**`,
          `🟢 Concluidas: **${counts.done ?? 0}**`,
          `⚫ Canceladas: **${counts.cancelled ?? 0}**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: `Membros (${members.length})`,
        value:
          members.length > 0
            ? members.map((member) => mentionUser(member.discord_id)).join('\n')
            : '_Nenhum membro vinculado_',
        inline: true,
      },
      {
        name: 'Status',
        value: project.status === 'archived' ? '📦 Arquivado' : '✅ Ativo',
        inline: true,
      },
    )
    .setFooter({ text: `#${project.id} · criado em ${formatDate(new Date(project.created_at), actor.timezone)}` });

  await interaction.editReply({ embeds: [embed] });
}

async function handleAddMember(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor, isAdmin } = invocation;
  const project = context.services.projects.require(serverId, interaction.options.getString('projeto', true));
  const member = await resolveGuildUser(invocation, interaction.options.getUser('membro', true));

  context.services.projects.addMember(serverId, project.id, member, actor, isAdmin);

  await interaction.editReply({
    embeds: [
      successEmbed(
        'Membro adicionado',
        `${mentionUser(member.discord_id)} agora faz parte de **${escapeMarkdown(project.name)}**.`,
      ),
    ],
  });
}

async function handleRemoveMember(invocation: CommandInvocation): Promise<void> {
  const { interaction, context, serverId, actor, isAdmin } = invocation;
  const project = context.services.projects.require(serverId, interaction.options.getString('projeto', true));
  const member = await resolveGuildUser(invocation, interaction.options.getUser('membro', true));

  context.services.projects.removeMember(serverId, project.id, member, actor, isAdmin);

  await interaction.editReply({
    embeds: [
      successEmbed(
        'Membro removido',
        `${mentionUser(member.discord_id)} saiu de **${escapeMarkdown(project.name)}**.`,
      ),
    ],
  });
}

async function handleSetStatus(invocation: CommandInvocation, status: ProjectStatus): Promise<void> {
  const { interaction, context, serverId, actor, isAdmin } = invocation;
  const project = context.services.projects.require(serverId, interaction.options.getString('projeto', true));
  const updated = context.services.projects.setStatus(serverId, project.id, status, actor, isAdmin);

  await interaction.editReply({
    embeds: [
      successEmbed(
        status === 'archived' ? 'Projeto arquivado' : 'Projeto reativado',
        status === 'archived'
          ? `**${escapeMarkdown(updated.name)}** foi arquivado. O historico continua acessivel na busca.`
          : `**${escapeMarkdown(updated.name)}** esta ativo novamente.`,
      ),
    ],
  });
}

export const projectCommand: SlashCommand = {
  data,
  async execute(invocation) {
    const subcommand = invocation.interaction.options.getSubcommand();

    switch (subcommand) {
      case 'criar':
        return handleCreate(invocation);
      case 'listar':
        return handleList(invocation);
      case 'info':
        return handleInfo(invocation);
      case 'adicionar':
        return handleAddMember(invocation);
      case 'remover':
        return handleRemoveMember(invocation);
      case 'arquivar':
        return handleSetStatus(invocation, 'archived');
      case 'reativar':
        return handleSetStatus(invocation, 'active');
      default:
        throw new ValidationError(`Subcomando desconhecido: ${subcommand}`);
    }
  },
  async autocomplete(invocation: AutocompleteInvocation) {
    const subcommand = invocation.interaction.options.getSubcommand();
    // Em "reativar" so faz sentido sugerir projetos arquivados/todos.
    await respondProjectAutocomplete(invocation, subcommand !== 'reativar' && subcommand !== 'info');
  },
};

export default projectCommand;
