import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { rulesEngine } from '../modules/rules/rulesEngine.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('mypoints')
  .setDescription('View your active moderation points, violation history, and decay schedule')
  .addStringOption((opt) =>
    opt
      .setName('language')
      .setDescription('Preferred display language')
      .setRequired(false)
      .addChoices({ name: 'العربية (Egyptian Arabic)', value: 'ar' }, { name: 'English', value: 'en' })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const guildId = interaction.guildId || 'global';
    const userId = interaction.user.id;
    const lang = (interaction.options.getString('language') as 'ar' | 'en') || 'ar';

    const pointsSummary = rulesEngine.getActivePoints(guildId, userId);

    const embed = new EmbedBuilder()
      .setColor(pointsSummary.totalActivePoints > 0 ? 0xf57c00 : 0x00d26a)
      .setTitle(
        lang === 'ar'
          ? `📊 سجل النقاط التأديبية وفترة التعافي - ${interaction.user.username}`
          : `📊 Moderation Points & Decay Record - ${interaction.user.username}`
      )
      .setDescription(
        lang === 'ar'
          ? `إجمالي النقاط النشطة حالياً: **${pointsSummary.totalActivePoints} نقطة**`
          : `Total currently active points: **${pointsSummary.totalActivePoints} pts**`
      );

    if (pointsSummary.activeViolations.length === 0) {
      embed.addFields({
        name: lang === 'ar' ? 'سجل نظيف' : 'Clean Record',
        value:
          lang === 'ar'
            ? 'سجلك نظيف تماماً ولا توجد أي نقاط تأديبية نشطة. شكراً لالتزامك بروح مجتمع نيكسس!'
            : 'Your record is completely clear with 0 active points. Thank you for keeping Nexus respectful and collaborative!'
      });
    } else {
      for (const v of pointsSummary.activeViolations) {
        const rule = rulesEngine.getRule(v.ruleId);
        const ruleName = rule ? (lang === 'ar' ? rule.name_ar : rule.name_en) : v.ruleId;
        const decayDate = new Date(v.expiresAt).toLocaleDateString();

        embed.addFields({
          name: `[${v.ruleId}] ${ruleName} (+${v.points} pts)`,
          value:
            lang === 'ar'
              ? `• السبب: ${v.reason}\n• معرف الحالة: \`${v.caseId}\`\n• تاريخ سقوط النقاط: ${decayDate}\n• للاستئناف: \`/appeal ${v.caseId}\``
              : `• Reason: ${v.reason}\n• Case ID: \`${v.caseId}\`\n• Decay Date: ${decayDate}\n• To appeal: \`/appeal ${v.caseId}\``
        });
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    logger.error('Error executing /mypoints command', { error: String(err) });
    await interaction.reply({ content: '❌ Failed to fetch your points history.', ephemeral: true });
  }
}
