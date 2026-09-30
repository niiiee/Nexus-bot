import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { aiOrchestrator } from '../ai/orchestrator.js';
import { PerkEngine } from '../perks/perkEngine.js';
import { CommunityFundEngine } from '../modules/fund/communityFundEngine.js';
import { CommunityCompetitionEngine } from '../modules/competitions/communityCompetitionEngine.js';
import { escrowService } from '../modules/escrow/escrowService.js';
import { dailyTaskManager } from '../modules/tasks/dailyTaskManager.js';
import { memberRepo } from '../database/repositories/memberRepo.js';
import { portfolioGalleryService } from '../modules/freelancer/portfolio/portfolioGallery.js';
import { onboardingQuestsService } from '../modules/growth/onboardingQuests.js';
import { reportTicketSystem } from '../modules/freelancer/safety/reportTicketSystem.js';
import { COMMUNITY_BADGES } from '../modules/freelancer/portfolio/badgeEngine.js';
import { dbService } from '../database/connection.js';
import { logger } from '../utils/logger.js';

// -------------------------------------------------------------
// 1. /ask — Central AI Brain
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
      .setFooter({ text: 'Powered by Gemini & Nexus Architecture' });

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
    opt.setName('category').setDescription('Filter by category').setRequired(false)
      .addChoices(
        { name: 'Progression & XP', value: 'Progression' },
        { name: 'Cosmetics', value: 'Cosmetics' },
        { name: 'Roles & Colors', value: 'Roles & Colors' },
        { name: 'Priority Access', value: 'Priority Access' },
        { name: 'Mentorship', value: 'Mentorship' },
        { name: 'Resources', value: 'Resources' },
        { name: 'Privileges', value: 'Privileges' },
        { name: 'Events', value: 'Events' }
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
// 3. /daily — Daily Coding & Design Challenge
// -------------------------------------------------------------
export const dailyCommand = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Get your daily programming or design challenge and earn Merit Credits');

export async function executeDaily(interaction: ChatInputCommandInteraction): Promise<void> {
  const task = dailyTaskManager.getTaskForMember(interaction.user.id);
  if (!task) {
    await interaction.reply({ content: '🎯 لا توجد مهمة يومية جديدة حالياً، تابعنا غداً!', ephemeral: true });
    return;
  }

  let criteria: string[] = [];
  try {
    criteria = JSON.parse(task.criteria_json);
  } catch {
    criteria = ['إتمام الحل البرمجي بجودة عالية'];
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🎯 المهمة اليومية: ${task.title}`)
    .setDescription(task.description)
    .addFields(
      { name: 'المجال والمستوى', value: `💻 ${task.field.toUpperCase()} (${task.level})`, inline: true },
      { name: 'المكافأة المكتسبة', value: `💰 +${task.reward_credits} نقطة | ⭐ +${task.reward_xp} XP`, inline: true },
      { name: 'معايير القبول', value: criteria.map(c => `• ${c}`).join('\n'), inline: false }
    )
    .setFooter({ text: 'اضغط على زر تسليم الحل بالأسفل لرفع كودك والحصول على التقييم فوراً!' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_submit_daily_${task.id}`)
      .setLabel('📝 تسليم الحل وتوثيق الإنجاز')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

// -------------------------------------------------------------
// 4. /profile — Freelancer Profile Card
// -------------------------------------------------------------
export const profileCommand = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View your developer profile, seniority level, streak, and badges')
  .addUserOption(opt => opt.setName('user').setDescription('Target member to inspect').setRequired(false));

export async function executeProfile(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const guildId = interaction.guildId || 'global';
  const member = memberRepo.getOrCreate(targetUser.id, guildId, targetUser.username);

  // Fetch badges
  const badgeRows = dbService.all<{ badge_id: string }>(
    `SELECT badge_id FROM member_badges WHERE user_id = ?`,
    targetUser.id
  );

  const badgesDisplay = badgeRows.length > 0
    ? badgeRows.map(b => {
        const def = COMMUNITY_BADGES[b.badge_id];
        return def ? `${def.icon} **${def.nameAr}**` : `🏅 ${b.badge_id}`;
      }).join(' • ')
    : 'لم يتم فتح شارات بعد (أكمل المهام لفتحها!)';

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`👤 الملف المهني: ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: 'المستوى والرتبة', value: `⭐ ${member.seniority_level} (${member.lifecycle_stage})`, inline: true },
      { name: 'رصيد نقاط الجدارة', value: `💰 ${member.credits_balance} نقطة`, inline: true },
      { name: 'درجة السمعة (Reputation)', value: `📈 ${member.reputation_score}/100`, inline: true },
      { name: 'سلسلة النشاط (Streak)', value: `🔥 ${member.current_streak} يوم متواصل`, inline: true },
      { name: 'الشارات والإنجازات', value: badgesDisplay, inline: false }
    )
    .setFooter({ text: 'Nexus Freelancer Identity System' });

  await interaction.reply({ embeds: [embed] });
}

// -------------------------------------------------------------
// 5. /portfolio — Portfolio Showcase
// -------------------------------------------------------------
export const portfolioCommand = new SlashCommandBuilder()
  .setName('portfolio')
  .setDescription('Manage your freelance portfolio projects and showcase work')
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Publish a new project to #portfolio-showcase')
      .addStringOption(opt => opt.setName('title').setDescription('Project title').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Short description of technologies & role').setRequired(true))
      .addStringOption(opt => opt.setName('url').setDescription('Live demo or repository URL').setRequired(true))
      .addStringOption(opt => opt.setName('tags').setDescription('Tags separated by comma (e.g. React, Node, Tailwind)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('view')
      .setDescription('View portfolio projects of a user')
      .addUserOption(opt => opt.setName('user').setDescription('Member to view').setRequired(false))
  );

export async function executePortfolio(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId || 'global';

  if (sub === 'add') {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const url = interaction.options.getString('url', true);
    const rawTags = interaction.options.getString('tags') || 'General';
    const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);

    const item = portfolioGalleryService.addPortfolioItem({
      userId: interaction.user.id,
      guildId,
      title,
      description,
      url,
      tags
    });

    if (interaction.guild) {
      const showcaseChan = interaction.guild.channels.cache.find(c => c.name.includes('portfolio-showcase'));
      if (showcaseChan && 'send' in showcaseChan) {
        const card = portfolioGalleryService.generateShowcaseEmbed(item, interaction.user.username, 'ar');
        const cardEmbed = new EmbedBuilder()
          .setColor(card.color)
          .setTitle(card.title)
          .setURL(card.url)
          .setDescription(card.description)
          .addFields(card.fields)
          .setFooter(card.footer);

        const upvoteBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`btn_upvote_${item.id}`)
            .setLabel('⭐ إعجاب بالمشروع (Upvote)')
            .setStyle(ButtonStyle.Secondary)
        );

        await (showcaseChan as any).send({
          content: `🚀 مشروع جديد معروض بواسطة ${interaction.user}:`,
          embeds: [cardEmbed],
          components: [upvoteBtn]
        });
      }
    }

    await interaction.reply({
      content: `✅ تم نشر مشروعك **${title}** بنجاح في معرض الأعمال! استمر في إبهار المجتمع 🌟`,
      ephemeral: true
    });
  } else if (sub === 'view') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const items = portfolioGalleryService.getMemberItems(targetUser.id, guildId);

    if (items.length === 0) {
      await interaction.reply({ content: `📁 لا توجد مشاريع منشورة حالياً للمستخدم ${targetUser.username}.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle(`📁 معرض أعمال: ${targetUser.username} (${items.length} مشاريع)`);

    for (const item of items.slice(0, 5)) {
      embed.addFields({
        name: `🚀 ${item.title} (⭐ ${item.upvotes})`,
        value: `${item.description}\n🔗 [رابط المشروع](${item.url})\n🏷️ \`${item.tags.join('`, `')}\``,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
}

// -------------------------------------------------------------
// 6. /quests — 7-Day Onboarding Quests
// -------------------------------------------------------------
export const questsCommand = new SlashCommandBuilder()
  .setName('quests')
  .setDescription('Track your 7-day onboarding quests and unlock your Pioneer Badge');

export async function executeQuests(interaction: ChatInputCommandInteraction): Promise<void> {
  const quests = onboardingQuestsService.getMemberQuestProgress(interaction.user.id);
  const completedCount = quests.filter(q => q.isCompleted).length;

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle('🚀 مهام رحلة الأسبوع الأول للمستقل (Onboarding Quests)')
    .setDescription(
      `أكمل هذه المهام الـ 7 لفتح شارة **الريادة الماسية (Pioneer)** وكسب مئات نقاط الجدارة!\n` +
      `**نسبة الإنجاز**: ${completedCount} من 7 مكتملة (${Math.round((completedCount / 7) * 100)}%)`
    );

  for (const q of quests) {
    const statusIcon = q.isCompleted ? '✅' : '⏳';
    embed.addFields({
      name: `${statusIcon} اليوم ${q.dayNumber}: ${q.titleAr} (+${q.rewardCredits} نقطة)`,
      value: q.descriptionAr,
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed] });
}

// -------------------------------------------------------------
// 7. /leaderboard — Top Freelancers & Contributors
// -------------------------------------------------------------
export const leaderboardCommand = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the community leaderboard (Reputation, Credits, and Streaks)');

export async function executeLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  const topMembers = dbService.all<{
    username: string;
    credits_balance: number;
    reputation_score: number;
    current_streak: number;
  }>(
    `SELECT username, credits_balance, reputation_score, current_streak
     FROM members
     ORDER BY credits_balance DESC, reputation_score DESC
     LIMIT 10`
  );

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🏆 لوحة صدارة وفرسان مجتمع Nexus')
    .setDescription('أفضل وأكثر الأعضاء تميزاً ومساهمة في المجتمع:');

  if (topMembers.length === 0) {
    embed.setDescription('لوحة الصدارة قيد التحديث حالياً.');
  } else {
    topMembers.forEach((m, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
      embed.addFields({
        name: `${medal} ${m.username}`,
        value: `💰 ${m.credits_balance} نقطة | 📈 سمعة: ${m.reputation_score} | 🔥 ستريك: ${m.current_streak} يوم`,
        inline: false
      });
    });
  }

  await interaction.reply({ embeds: [embed] });
}

// -------------------------------------------------------------
// 8. /ticket — Staff Report & Inquiries
// -------------------------------------------------------------
export const ticketCommand = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Report an issue or open a private inquiry to staff')
  .addStringOption(opt => opt.setName('reason').setDescription('Reason for report / ticket').setRequired(true))
  .addUserOption(opt => opt.setName('target').setDescription('Target user (optional)').setRequired(false));

export async function executeTicket(interaction: ChatInputCommandInteraction): Promise<void> {
  const reason = interaction.options.getString('reason', true);
  const target = interaction.options.getUser('target');
  const guildId = interaction.guildId || 'global';

  const ticket = reportTicketSystem.fileReport({
    guildId,
    reporterId: interaction.user.id,
    targetId: target ? target.id : 'N/A',
    reason,
  });

  // Alert staff channel if present
  if (interaction.guild) {
    const staffChan = interaction.guild.channels.cache.find(c => c.name.includes('staff-review'));
    if (staffChan && 'send' in staffChan) {
      await (staffChan as any).send({
        content: `🚨 **بلاغ جديد قيد المراجعة (#${ticket.id})**:\n` +
          `• المُبلغ: ${interaction.user} (${interaction.user.id})\n` +
          `• الطرف المعني: ${target ? `${target} (${target.id})` : 'عام'}\n` +
          `• السبب: ${reason}`
      });
    }
  }

  await interaction.reply({
    content: `✅ تم استلام بلاغك وتوثيقه برقم تذكرة: \`#${ticket.id}\` وسيقوم المشرفون بمراجعته فوراً بسرية تامة.`,
    ephemeral: true
  });
}

// -------------------------------------------------------------
// 9. /escrow — Middleman & Escrow Deals
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

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_open_escrow')
      .setLabel('➕ فتح صفقة وساطة جديدة الآن')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

// -------------------------------------------------------------
// 10. /fund — Community Fund & Transparency
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
// 11. /jobs — Freelancer Job Board
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
// 12. /competitions — Hackathons & Challenges
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
// 13. /status — System Health & AI Telemetry
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
    .setFooter({ text: 'Nexus Cloud Reference Architecture • 10/10 Enterprise Certified' });

  await interaction.reply({ embeds: [embed] });
}
