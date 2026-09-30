import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { setupWizardService } from '../discord/setupWizard.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Automated setup wizard for Senior Progg bot channels, roles, and dashboard')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option
      .setName('language')
      .setDescription('Preferred setup summary language (ar or en)')
      .setRequired(false)
      .addChoices(
        { name: 'العربية (Egyptian Arabic)', value: 'ar' },
        { name: 'English', value: 'en' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be run inside a Discord server.', ephemeral: true });
    return;
  }

  // Double check admin privileges
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ Forbidden: Administrator permissions are required to execute server setup.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const lang = (interaction.options.getString('language') as 'ar' | 'en') || 'ar';
    const result = await setupWizardService.provisionGuild(
      interaction.guild as any,
      interaction.user.id,
      lang
    );

    const replyText = lang === 'ar' ? result.summaryAr : result.summaryEn;
    await interaction.editReply({ content: replyText });
  } catch (error) {
    logger.error('[CommandSetup] Error executing /setup command:', error);
    await interaction.editReply({
      content: '❌ Failed to execute setup wizard. Please verify bot role permissions.',
    });
  }
}
