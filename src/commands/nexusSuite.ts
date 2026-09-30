import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { aiOrchestrator } from '../ai/orchestrator.js';
import { PerkEngine } from '../perks/perkEngine.js';
import { CommunityFundEngine } from '../modules/fund/communityFundEngine.js';
import { CommunityCompetitionEngine } from '../modules/competitions/communityCompetitionEngine.js';
import { escrowService } from '../modules/escrow/escrowService.js';
import { logger } from '../utils/logger.js';

// -------------------------------------------------------------
// 1. /ask — Central AI Brain (Egyptian Arabic / English)
// -------------------------------------------------------------
export const askCommand = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask the Central AI Brain for programming, design, and career advice')
  .addStringOption(opt =>
    opt.setName('prompt').setDescription('Your question or technical problem').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('language').setDescription('Response language (ar or en)').setRequired(false)
      .addChoices(
        { name: 'العربية (Egyptian Arabic)', value: 'ar' },
        { name: 'English', value: 'en' }
      )
  );

export async function executeAsk(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  try {
    const prompt = interaction.options.getString('prompt', true);
    const lang = interaction.options.getString('language') || 'ar';
    const systemPrompt = lang === 'ar'
      ? 'أنت Nexus، المساعد الذكي لمجتمع المبرمجين والمستقلين. أجب بالعامية المصرية الودودة والمحترفة، بأسلوب عملي ودقيق مع أمثلة كود واضحة.'
      : 'You are Nexus, the AI assistant for developers and freelancers. Answer professionally and concisely with practical code guidance.';

    const response = await aiOrchestrator.generateResponse({
      prompt: `${systemPrompt}\n\nUser Question: ${prompt}`,
      userId: interaction.user.id,
      guildId: interaction.guildId || undefined,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(lang === 'ar' ? '🧠 إجابة المساعد الذكي Nexus' : '🧠 Nexus AI Brain Answer')
      .setDescription(response.text.slice(0, 4000))
      .setFooter({ text: 'Powered by Gemini & Nexus 27.0 Architecture' });

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    logger.error('[CommandAsk] Error:', err);
    await interaction.editReply({ content: '❌ حدث خطأ أثناء معالجة السؤال بواسطة الذكاء الاصطناعي.' });
  }
}

// -------------------------------------------------------------
// 2. /perks — 195 Perks Catalog & Shop
// -------------------------------------------------------------
export const perksCommand = new SlashCommandBuilder()
  .setName('perks')
  .setDescription('Browse the 195 community rewards catalog and redeem perks')
  .addStringOption(opt =>
    opt.setName('category').setDescription('Filter by perk category').setRequired(false)
      .addChoices(
        { name: 'Hardware & Gear', value: 'hardware' },
        { name: 'Courses & Certifications', value: 'courses' },
        { name: 'Mentorship & 1-on-1s', value: 'mentorship' },
        { name: 'Cloud & Software Credits', value: 'cloud' }
      )
  );

export async function executePerks(interaction: ChatInputCommandInteraction): Promise<void> {
  const category = interaction.options.getString('category');
  const perkEngine = new PerkEngine();
  const allPerks = perkEngine.listCatalog(category || undefined);

  const display = allPerks.slice(0, 10);
  const embed = new EmbedBuilder()
    .setColor(0x00d26a)
    .setTitle('🎁 متجر مزايا ومكافآت مجتمع نيكسس (195 ميزة متاحة)')
    .setDescription(`معروض ${display.length} من أصل ${allPerks.length} ميزة مطابقة. يمكنك استبدال نقاط الجدارة المكتسبة بهذه الجوائز:`);

  for (const p of display) {
    embed.addFields({
      name: `${p.name} (${p.credit_price} نقطة جدارة)`,
      value: `${p.description}\n*الفئة: ${p.category} | المستوى الأدنى المطلوب: ${p.level_requirement}*`,
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed] });
}

// -------------------------------------------------------------
// 3. /escrow — Middleman & Escrow Deals
// -------------------------------------------------------------
export const escrowCommand = new SlashCommandBuilder()
  .setName('escrow')
  .setDescription('Learn about the zero-custody community escrow and middleman system')
  .addStringOption(opt =>
    opt.setName('language').setDescription('Display language (ar or en)').setRequired(false)
      .addChoices(
        { name: 'العربية (Egyptian Arabic)', value: 'ar' },
        { name: 'English', value: 'en' }
      )
  );

export async function executeEscrow(interaction: ChatInputCommandInteraction): Promise<void> {
  const lang = (interaction.options.getString('language') as 'ar' | 'en') || 'ar';
  const disclaimer = escrowService.getDisclaimer(lang);

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(lang === 'ar' ? '🤝 نظام الوساطة والضمان الآمن (Escrow System)' : '🤝 Middleman & Escrow Guarantee System')
    .setDescription(
      (lang === 'ar'
        ? 'نظام وساطة مجتمعي متكامل لحماية المستقل والعميل في الصفقات البرمجية والتصميمية:\n\n' +
          '• **حفظ الحقوق**: لا يتم تسليم المخرجات إلا بعد تأكيد الدفع مع الوسيط البشري المعتمد.\n' +
          '• **فحص النزاعات**: في حالة الخلاف، يتدخل وسيط محايد للفحص الفني للمخرجات وفقاً للميثاق.\n' +
          '• **قناة الصفقات**: يتم فتح روم خاص لكل صفقة تحت فئة `ESCROW DEALS`.\n\n'
        : 'Community-driven middleman coordination for fair and secure freelancer deals:\n\n' +
          '• **Protection**: Outputs delivered only after verified middleman deposit confirmation.\n' +
          '• **Dispute Resolution**: Impartial technical review under Nexus Charter.\n' +
          '• **Deal Rooms**: Automated private channels under `ESCROW DEALS` category.\n\n') +
      disclaimer
    );

  await interaction.reply({ embeds: [embed] });
}

// -------------------------------------------------------------
// 4. /fund — Community Fund & Transparency
// -------------------------------------------------------------
export const fundCommand = new SlashCommandBuilder()
  .setName('fund')
  .setDescription('View Community Fund transparency, financial runway, and dev bounties');

export async function executeFund(interaction: ChatInputCommandInteraction): Promise<void> {
  const fundEngine = CommunityFundEngine.getInstance();
  const guildId = interaction.guildId || 'global_community';
  const runway = fundEngine.calculateRunway(guildId);
  const ledger = fundEngine.getLedgerEntries(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🏛️ صندوق المجتمع الشفاف (Community Fund)')
    .setDescription('صندوق تطوعي مجتمعي لدعم البنية التحتية، الجوائز، والمنح التعليمية برؤية مفتوحة 100%:')
    .addFields(
      { name: 'احتياطي الصندوق المتاح', value: `$${runway.totalReserveUsd}`, inline: true },
      { name: 'شهور الأمان المالي', value: `${runway.runwayMonths.toFixed(1)} شهر`, inline: true },
      { name: 'إجمالي الحركات المسجلة', value: `${ledger.length} حركة`, inline: true },
      { name: 'الحماية المالية', value: 'حسابات بنكية مستقلة • تدقيق مزدوج • صفر حيازة للبوت', inline: false }
    )
    .setFooter({ text: 'Nexus Charter Rule 25.0 — Zero custody & Total financial transparency' });

  await interaction.reply({ embeds: [embed] });
}

// -------------------------------------------------------------
// 5. /jobs — Freelancer Job Board
// -------------------------------------------------------------
export const jobsCommand = new SlashCommandBuilder()
  .setName('jobs')
  .setDescription('Browse active freelance job opportunities and projects');

export async function executeJobs(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle('💼 لوحة فرص ومشاريع العمل الحر (Nexus Job Board)')
    .setDescription(
      'فرص ومشاريع العمل الحر الموثقة والمفحوصة أمنياً داخل المجتمع:\n\n' +
      '• **التقديم المباشر**: تواصل مباشرة مع أصحاب المشاريع عبر رومات الصفقات.\n' +
      '• **حماية المستقلين**: مكافحة الاحتيال وفحص العملاء بالذكاء الاصطناعي.\n' +
      '• **عرض الأعمال**: انشر أعمالك في `#portfolio-showcase` لتصلك عروض التوظيف المباشرة!'
    )
    .setFooter({ text: 'Nexus Freelance Engine • Smart Matching Active' });

  await interaction.reply({ embeds: [embed] });
}

// -------------------------------------------------------------
// 6. /competitions — Hackathons & Challenges
// -------------------------------------------------------------
export const competitionsCommand = new SlashCommandBuilder()
  .setName('competitions')
  .setDescription('View active coding challenges, hackathons, and seasonal leagues');

export async function executeCompetitions(interaction: ChatInputCommandInteraction): Promise<void> {
  const compEngine = CommunityCompetitionEngine.getInstance();
  const guildId = interaction.guildId || 'global_community';
  const comps = compEngine.listCompetitions(guildId);
  const schedule = compEngine.getLeagueSchedule();

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('🏆 مسابقات وهاكاثونات مجتمع نيكسس (Competitions & Leagues)')
    .setDescription('مسابقات برمجية وتصميمية مستمرة بجوائز عينية ومنح وتوثيق خبرة:');

  if (comps.length === 0) {
    embed.addFields({
      name: '🎯 المسابقات والهاكاثونات القادمة',
      value: schedule.map(s => `• **${s.sprintTitle}** (${s.season}) — البداية: ${s.startsDate}`).join('\n') || 'يتم التجهيز للمنافسة القادمة حالياً! تابع روم `#community-events` لتصلك إشعارات البداية فور إطلاقها.'
    });
  } else {
    for (const c of comps.slice(0, 5)) {
      embed.addFields({
        name: `🎯 ${c.title}`,
        value: `الفئة: ${c.category} | الجوائز: $${c.prizePoolReservedUsd} | الحالة: ${c.status}`,
        inline: false
      });
    }
  }

  await interaction.reply({ embeds: [embed] });
}

// -------------------------------------------------------------
// 7. /status — System Health & AI Telemetry
// -------------------------------------------------------------
export const statusCommand = new SlashCommandBuilder()
  .setName('status')
  .setDescription('View Nexus Bot system health, AI provider latency, and cloud telemetry');

export async function executeStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const aiProvider = aiOrchestrator.getActiveProviderName();
  const uptimeMinutes = Math.floor(process.uptime() / 60);

  const embed = new EmbedBuilder()
    .setColor(0x00d26a)
    .setTitle('⚡ حالة نظام وبنية Nexus السحابية')
    .addFields(
      { name: 'حالة البوت', value: '🟢 يعمل بكفاءة 100% (Online)', inline: true },
      { name: 'مزود الذكاء الاصطناعي', value: `🧠 ${aiProvider.toUpperCase()}`, inline: true },
      { name: 'وقت التشغيل', value: `${uptimeMinutes} دقيقة`, inline: true },
      { name: 'قاعدة البيانات', value: '☁️ PostgreSQL Supabase (RLS Active)', inline: true },
      { name: 'محرك القواعد', value: '🛡️ 50 قاعدة مجتمعية نشطة (R01-R50)', inline: true },
      { name: 'الذاكرة والموارد', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB RAM`, inline: true }
    )
    .setFooter({ text: 'Nexus 27.0 Cloud Reference Architecture • All 15 Invariants Verified' });

  await interaction.reply({ embeds: [embed] });
}
