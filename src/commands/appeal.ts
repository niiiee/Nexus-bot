import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { rulesEngine } from '../modules/rules/rulesEngine.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('appeal')
  .setDescription('Submit an appeal for a moderation case to an independent reviewer')
  .addStringOption((opt) =>
    opt.setName('case_id').setDescription('The case ID to appeal (e.g. case_1234abcd)').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('statement')
      .setDescription('Explain why you believe the action was in error or provide context')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('language')
      .setDescription('Preferred display language')
      .setRequired(false)
      .addChoices({ name: 'العربية (Egyptian Arabic)', value: 'ar' }, { name: 'English', value: 'en' })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const caseId = interaction.options.getString('case_id', true).trim();
    const statement = interaction.options.getString('statement', true).trim();
    const lang = (interaction.options.getString('language') as 'ar' | 'en') || 'ar';
    const guildId = interaction.guildId || 'global';
    const appellantId = interaction.user.id;

    const result = rulesEngine.openAppeal({
      caseId,
      guildId,
      appellantId,
      statement
    });

    if (result.status === 'error') {
      await interaction.reply({
        content: `❌ ${result.message}`,
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(lang === 'ar' ? '⚖️ تم تسجيل طلب الاستئناف بنجاح' : '⚖️ Appeal Registered Successfully')
      .setDescription(
        lang === 'ar'
          ? `تم إحالة استئنافك إلى مشرف مستقل محايد لمراجعة تفاصيل الحالة والرسالة وسياقها.`
          : `Your appeal has been submitted and assigned to an independent moderator for impartial context review.`
      )
      .addFields(
        { name: lang === 'ar' ? 'معرف الاستئناف' : 'Appeal ID', value: `\`${result.appealId}\``, inline: true },
        { name: lang === 'ar' ? 'معرف الحالة' : 'Case ID', value: `\`${caseId}\``, inline: true },
        { name: lang === 'ar' ? 'توضيح العضو' : 'Appellant Statement', value: `"${statement}"`, inline: false }
      )
      .setFooter({
        text:
          lang === 'ar'
            ? 'مبدأ العدالة: لا يحق لنفس المشرف الذي اتخذ الإجراء الأصلي البت في الاستئناف.'
            : 'Charter Guarantee: The moderator who took the original action cannot rule on the appeal.'
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    logger.error('Error executing /appeal command', { error: String(err) });
    await interaction.reply({ content: '❌ Failed to process appeal.', ephemeral: true });
  }
}
