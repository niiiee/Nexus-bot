import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { rulesEngine } from '../modules/rules/rulesEngine.js';
import { logger } from '../utils/logger.js';

export const rulesCommandData = new SlashCommandBuilder()
  .setName('rules')
  .setDescription('View the 50 bilingual community rules of Nexus')
  .addStringOption((opt) =>
    opt
      .setName('category')
      .setDescription('Filter rules by category')
      .setRequired(false)
      .addChoices(
        { name: 'Safety & Platform Security', value: 'Safety' },
        { name: 'Professional Ethics & Competence', value: 'Ethics' },
        { name: 'Marketplace Integrity & Care', value: 'Marketplace' },
        { name: 'Resource Access & Fair-Use', value: 'Resource' },
        { name: 'Community Culture & Collaboration', value: 'Culture' }
      )
  )
  .addStringOption((opt) =>
    opt.setName('query').setDescription('Search rules by keyword').setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName('language')
      .setDescription('Language for display')
      .setRequired(false)
      .addChoices({ name: 'العربية (Egyptian Arabic)', value: 'ar' }, { name: 'English', value: 'en' })
  );

export async function executeRules(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const category = interaction.options.getString('category') || undefined;
    const query = interaction.options.getString('query') || undefined;
    const lang = (interaction.options.getString('language') as 'ar' | 'en') || 'ar';

    const rules = rulesEngine.listRules({ category, query });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(lang === 'ar' ? '📜 ميثاق وقواعد مجتمع نيكسس (50 بند ثنائي اللغة)' : '📜 Nexus Community Rules (50 Bilingual Articles)')
      .setDescription(
        lang === 'ar'
          ? `عرض ${rules.length} قاعدة مطابقة للبحث. لاستعراض تفاصيل أي بند استخدم \`/rule <id>\` (مثلاً: \`/rule R01\`).`
          : `Showing ${rules.length} matching rules. To view details of any rule, use \`/rule <id>\` (e.g. \`/rule R01\`).`
      );

    const displayRules = rules.slice(0, 15); // Show first 15 in embed
    for (const r of displayRules) {
      const title = lang === 'ar' ? `[${r.id}] ${r.name_ar}` : `[${r.id}] ${r.name_en}`;
      const desc =
        lang === 'ar'
          ? `${r.description_ar}\n*الخطورة: ${r.severity} | النمط: ${r.mode} | النقاط: ${r.points}*`
          : `${r.description_en}\n*Severity: ${r.severity} | Mode: ${r.mode} | Points: ${r.points}*`;
      embed.addFields({ name: title, value: desc, inline: false });
    }

    if (rules.length > 15) {
      embed.setFooter({
        text:
          lang === 'ar'
            ? `... وهناك ${rules.length - 15} بند إضافي. استخدم تصنيف أو كلمة بحث للتضييق.`
            : `... and ${rules.length - 15} more rules. Filter by category or search query to narrow.`
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    logger.error('Error executing /rules command', { error: String(err) });
    await interaction.reply({ content: '❌ Error loading rules. Please try again.', ephemeral: true });
  }
}

export const singleRuleCommandData = new SlashCommandBuilder()
  .setName('rule')
  .setDescription('View specific community rule by ID (e.g. R01 to R50)')
  .addStringOption((opt) =>
    opt.setName('id').setDescription('Rule ID (e.g. R01, R24)').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('language')
      .setDescription('Preferred display language')
      .setRequired(false)
      .addChoices({ name: 'العربية (Egyptian Arabic)', value: 'ar' }, { name: 'English', value: 'en' })
  );

export async function executeSingleRule(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const id = interaction.options.getString('id', true).trim().toUpperCase();
    const lang = (interaction.options.getString('language') as 'ar' | 'en') || 'ar';
    const rule = rulesEngine.getRule(id);

    if (!rule) {
      await interaction.reply({
        content:
          lang === 'ar'
            ? `❌ لم يتم العثور على قاعدة برمز \`${id}\`. القواعد المتاحة من R01 إلى R50.`
            : `❌ Rule with ID \`${id}\` not found. Available rules range from R01 to R50.`,
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(rule.severity === 'Care' ? 0x00d26a : rule.severity === 'S4' ? 0xed4245 : 0xfee75c)
      .setTitle(`[${rule.id}] ${rule.name_en} / ${rule.name_ar}`)
      .addFields(
        { name: 'Category / التصنيف', value: rule.category, inline: true },
        { name: 'Severity / مستوى الخطورة', value: rule.severity, inline: true },
        { name: 'Mode / نمط التدخل', value: rule.mode, inline: true },
        { name: 'Points / النقاط التأديبية', value: `${rule.points} pts`, inline: true },
        { name: 'Decay Period / فترة التعافي', value: `${rule.decay_days} days`, inline: true },
        { name: 'Auto Action Ceiling / سقف التدخل الآلي', value: rule.auto_max_action, inline: true },
        { name: 'English Description', value: rule.description_en, inline: false },
        { name: 'الوصف باللهجة المصرية', value: rule.description_ar, inline: false }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    logger.error('Error executing /rule command', { error: String(err) });
    await interaction.reply({ content: '❌ Error displaying rule.', ephemeral: true });
  }
}
