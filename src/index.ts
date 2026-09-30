import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';
import { dbService } from './database/connection.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { aiOrchestrator } from './ai/orchestrator.js';
import { PerkEngine } from './perks/perkEngine.js';
import { startDashboardServer } from './dashboard/server.js';
import { telegramBotService } from './telegram/bot.js';
import { data as setupCommand, execute as executeSetup } from './commands/setup.js';
import { rulesCommandData, executeRules } from './commands/rules.js';
import { data as mypointsCommand, execute as executeMypoints } from './commands/mypoints.js';
import { data as appealCommand, execute as executeAppeal } from './commands/appeal.js';
import {
  askCommand, executeAsk,
  perksCommand, executePerks,
  escrowCommand, executeEscrow,
  fundCommand, executeFund,
  jobsCommand, executeJobs,
  competitionsCommand, executeCompetitions,
  statusCommand, executeStatus,
  dailyCommand, executeDaily,
  profileCommand, executeProfile,
  portfolioCommand, executePortfolio,
  questsCommand, executeQuests,
  leaderboardCommand, executeLeaderboard,
  ticketCommand, executeTicket,
} from './commands/nexusSuite.js';
import { rulesEngine } from './modules/rules/rulesEngine.js';
import { memberRepo } from './database/repositories/memberRepo.js';
import { dailyTaskManager } from './modules/tasks/dailyTaskManager.js';
import { portfolioGalleryService } from './modules/freelancer/portfolio/portfolioGallery.js';

async function bootstrap() {
  console.log(`
  =======================================================
   🤖 SENIOR PROGG - AI-DRIVEN DISCORD COMMUNITY MANAGER
   Freelance Ecosystem • Telegram Companion • Web Dashboard
   Bilingual: Egyptian Arabic (المصري) & English
  =======================================================
  `);

  logger.info('[Bootstrap] Starting Senior Progg runtime initialization...');

  // 1. Database Initialization
  try {
    dbService.exec('SELECT 1');
    logger.info('[Bootstrap] SQLite Database connection verified and schema migrated.');
  } catch (error) {
    logger.error('[Bootstrap] Failed to initialize SQLite database:', error);
    process.exit(1);
  }

  // 2. Seed 195 Perks Catalog
  try {
    const perkEngine = new PerkEngine();
    perkEngine.seedCatalogToDatabase();
    logger.info('[Bootstrap] Perk Shop Catalog initialized and verified.');
  } catch (error) {
    logger.warn('[Bootstrap] Error seeding perks catalog:', error);
  }

  // 3. AI Brain Orchestrator Verification
  const activeAI = aiOrchestrator.getActiveProviderName();
  logger.info(`[Bootstrap] Central AI Brain ready. Active Provider: ${activeAI}`);

  // 4. Start Owner Web Dashboard
  const dashboardPort = parseInt(process.env.PORT || '3000', 10);
  const { server: dashboardServer } = startDashboardServer(dashboardPort);

  // 5. Initialize Telegram Companion Bot
  if (env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_BOT_TOKEN.startsWith('mock_')) {
    logger.info('[Bootstrap] Telegram Companion Bot active and listening for events.');
  } else {
    logger.info('[Bootstrap] Telegram companion operating in mock/idle mode.');
  }

  // 6. Initialize Discord Bot Client (if configured)
  let discordClient: Client | null = null;
  if (env.DISCORD_TOKEN && !env.DISCORD_TOKEN.startsWith('mock_')) {
    const setupHandlers = (client: Client) => {
      const allCommands = [
        setupCommand.toJSON(),
        rulesCommandData.toJSON(),
        mypointsCommand.toJSON(),
        appealCommand.toJSON(),
        askCommand.toJSON(),
        perksCommand.toJSON(),
        dailyCommand.toJSON(),
        profileCommand.toJSON(),
        portfolioCommand.toJSON(),
        questsCommand.toJSON(),
        leaderboardCommand.toJSON(),
        ticketCommand.toJSON(),
        escrowCommand.toJSON(),
        fundCommand.toJSON(),
        jobsCommand.toJSON(),
        competitionsCommand.toJSON(),
        statusCommand.toJSON(),
      ];

      client.once('ready', async (c) => {
        logger.info(`[Bootstrap] Discord Client logged in as ${c.user.tag} (${c.user.id})`);

        // Register slash commands globally AND per-guild for instant zero-delay availability
        try {
          const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
          logger.info(`[Bootstrap] Registering all ${allCommands.length} application slash commands globally...`);
          await rest.put(
            Routes.applicationCommands(c.user.id),
            { body: allCommands }
          );

          for (const [guildId, guild] of c.guilds.cache) {
            try {
              await rest.put(
                Routes.applicationGuildCommands(c.user.id, guildId),
                { body: allCommands }
              );
              logger.info(`[Bootstrap] Instant slash commands registered for guild: ${guild.name} (${guildId})`);
            } catch (guildErr) {
              logger.warn(`Could not register commands for guild ${guildId}:`, guildErr);
            }
          }
          logger.info('[Bootstrap] All 17 slash commands registered successfully.');
        } catch (regError) {
          logger.warn('[Bootstrap] Could not register slash commands globally:', regError);
        }
      });

      // Handle interactions (Slash Commands, Buttons, Modals)
      client.on('interactionCreate', async (interaction) => {
        // A. Handle Slash Commands
        if (interaction.isChatInputCommand()) {
          try {
            switch (interaction.commandName) {
              case 'setup':
                await executeSetup(interaction);
                break;
              case 'rules':
                await executeRules(interaction);
                break;
              case 'mypoints':
                await executeMypoints(interaction);
                break;
              case 'appeal':
                await executeAppeal(interaction);
                break;
              case 'ask':
                await executeAsk(interaction);
                break;
              case 'perks':
                await executePerks(interaction);
                break;
              case 'daily':
                await executeDaily(interaction);
                break;
              case 'profile':
                await executeProfile(interaction);
                break;
              case 'portfolio':
                await executePortfolio(interaction);
                break;
              case 'quests':
                await executeQuests(interaction);
                break;
              case 'leaderboard':
                await executeLeaderboard(interaction);
                break;
              case 'ticket':
                await executeTicket(interaction);
                break;
              case 'escrow':
                await executeEscrow(interaction);
                break;
              case 'fund':
                await executeFund(interaction);
                break;
              case 'jobs':
                await executeJobs(interaction);
                break;
              case 'competitions':
                await executeCompetitions(interaction);
                break;
              case 'status':
                await executeStatus(interaction);
                break;
              default:
                await interaction.reply({ content: 'Command received.', ephemeral: true });
            }
          } catch (cmdErr: any) {
            logger.error(`[Interaction] Error executing /${interaction.commandName}:`, cmdErr);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر.', ephemeral: true });
            }
          }
          return;
        }

        // B. Handle Interactive Buttons
        if (interaction.isButton()) {
          try {
            const { customId } = interaction;

            // 1. Verification Button
            if (customId === 'btn_verify') {
              const guild = interaction.guild;
              let roleAssigned = false;

              if (guild) {
                const verifiedRole = guild.roles.cache.find(r => r.name.includes('Verified Freelancer'));
                if (verifiedRole) {
                  const member = guild.members.cache.get(interaction.user.id) || await guild.members.fetch(interaction.user.id).catch(() => null);
                  if (member && !member.roles.cache.has(verifiedRole.id)) {
                    await member.roles.add(verifiedRole.id).catch(() => null);
                    roleAssigned = true;
                  }
                }
              }

              const profile = memberRepo.getOrCreate(interaction.user.id, interaction.guildId || 'global', interaction.user.username);

              await interaction.reply({
                content:
                  `🎉 **أهلاً بك يا ${interaction.user.username} في مجتمع Nexus!** 🎉\n\n` +
                  `✅ **تم توثيق وتفعيل حسابك بنجاح!**\n` +
                  (roleAssigned ? `• تم منحك رتبة: **Verified Freelancer** 🛡️\n` : `• رتبتك الحالية نشطة وموثقة 🛡️\n`) +
                  `• رصيدك الترحيبي: **${profile.credits_balance} نقطة جدارة** 💰\n\n` +
                  `**كيف تبدأ رحلتك الآن؟**\n` +
                  `1. استلم تحديك البرمجي اليومي لكسب الـ XP: \`/daily\`\n` +
                  `2. اعرض مشاريعك في المعرض لجلب العملاء: \`/portfolio add\`\n` +
                  `3. اسأل المساعد الذكي عن أي كود أو معمارية: \`/ask\`\n` +
                  `4. استعرض مكافآت المتجر (195 ميزة): \`/perks\``,
                ephemeral: true
              });
              return;
            }

            // 2. Rules Button
            if (customId === 'btn_rules') {
              await executeRules(interaction as any);
              return;
            }

            // 3. Perks Button
            if (customId === 'btn_perks') {
              await executePerks(interaction as any);
              return;
            }

            // 4. Daily Task Button
            if (customId === 'btn_daily') {
              await executeDaily(interaction as any);
              return;
            }

            // 5. Quests Button
            if (customId === 'btn_quests') {
              await executeQuests(interaction as any);
              return;
            }

            // 6. Ask AI Button (Pops modal)
            if (customId === 'btn_ask') {
              const modal = new ModalBuilder()
                .setCustomId('modal_ask_ai')
                .setTitle('🧠 استشارة المساعد الذكي Nexus');

              const promptInput = new TextInputBuilder()
                .setCustomId('input_ai_prompt')
                .setLabel('ما هو سؤالك أو مشكلتك البرمجية؟')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('مثال: كيف أمنع الـ Race Conditions في معالجة المدفوعات؟')
                .setRequired(true);

              modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput));
              await interaction.showModal(modal);
              return;
            }

            // 7. Open Escrow Deal Button (Pops modal)
            if (customId === 'btn_open_escrow') {
              const modal = new ModalBuilder()
                .setCustomId('modal_create_escrow')
                .setTitle('🤝 فتح صفقة وساطة آمنة');

              const titleInput = new TextInputBuilder()
                .setCustomId('escrow_title')
                .setLabel('عنوان الصفقة أو المشروع')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: تصميم وبرمجة لوحة تحكم Next.js')
                .setRequired(true);

              const counterpartyInput = new TextInputBuilder()
                .setCustomId('escrow_counterparty')
                .setLabel('اسم أو آيدي الطرف الآخر (العميل/المستقل)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: @username أو 123456789')
                .setRequired(true);

              const amountInput = new TextInputBuilder()
                .setCustomId('escrow_amount')
                .setLabel('قيمة الصفقة بالدولار (USD)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 250')
                .setRequired(true);

              const scopeInput = new TextInputBuilder()
                .setCustomId('escrow_scope')
                .setLabel('المخرجات المتفق عليها وشروط التسليم')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('المخرجات: سورس كود + توثيق API + تجارب أداء')
                .setRequired(true);

              modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(counterpartyInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(scopeInput)
              );

              await interaction.showModal(modal);
              return;
            }

            // 8. Submit Daily Task Button (Pops modal)
            if (customId.startsWith('btn_submit_daily_')) {
              const taskId = customId.replace('btn_submit_daily_', '');
              const modal = new ModalBuilder()
                .setCustomId(`modal_submit_daily_${taskId}`)
                .setTitle('📝 تسليم الحل البرمجي للمهمة اليومية');

              const solutionInput = new TextInputBuilder()
                .setCustomId('daily_solution_code')
                .setLabel('كود الحل أو رابط GitHub / CodeSandbox')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('الصق كود الحل هنا أو رابط المستودع مع شرح مبسط...')
                .setRequired(true);

              modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(solutionInput));
              await interaction.showModal(modal);
              return;
            }

            // 9. Upvote Portfolio Project Button
            if (customId.startsWith('btn_upvote_')) {
              const itemId = customId.replace('btn_upvote_', '');
              const res = portfolioGalleryService.upvoteItem(itemId, interaction.user.id);
              if (res.success) {
                await interaction.reply({
                  content: `⭐ تم تسجيل إعجابك بالمشروع بنجاح! عدد الإعجابات الآن: ${res.newUpvotes}`,
                  ephemeral: true
                });
              } else {
                await interaction.reply({
                  content: 'ℹ️ لقد قمت بالإعجاب بهذا المشروع مسبقاً أو أنه مشروعك الخاص!',
                  ephemeral: true
                });
              }
              return;
            }
          } catch (btnErr: any) {
            logger.error('[Interaction] Button error:', btnErr);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ حدث خطأ أثناء معالجة الزر.', ephemeral: true });
            }
          }
          return;
        }

        // C. Handle Modals
        if (interaction.isModalSubmit()) {
          try {
            const { customId } = interaction;

            // 1. Escrow Deal Submission
            if (customId === 'modal_create_escrow') {
              const title = interaction.fields.getTextInputValue('escrow_title');
              const counterparty = interaction.fields.getTextInputValue('escrow_counterparty');
              const amount = interaction.fields.getTextInputValue('escrow_amount');
              const scope = interaction.fields.getTextInputValue('escrow_scope');

              const guild = interaction.guild;
              let dealChannel: any = null;

              if (guild) {
                const dealsCategory = guild.channels.cache.find(c => c.name.includes('ESCROW DEALS') && c.type === 4);
                const safeName = `صفقة-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 30);

                dealChannel = await guild.channels.create({
                  name: safeName,
                  type: 0,
                  parent: dealsCategory ? dealsCategory.id : undefined,
                  reason: 'New Escrow Deal Room'
                }).catch(() => null);

                if (dealChannel && typeof dealChannel.send === 'function') {
                  const dealEmbed = new EmbedBuilder()
                    .setColor(0xf39c12)
                    .setTitle(`🤝 تفاصيل الصفقة المعتمدة: ${title}`)
                    .setDescription(
                      `تم فتح روم الصفقة بنجاح تحت رقابة وإشراف وسطاء المجتمع المعتمدين.\n\n` +
                      `• **المبادر**: ${interaction.user}\n` +
                      `• **الطرف الآخر**: \`${counterparty}\`\n` +
                      `• **قيمة الصفقة**: **$${amount} USD**\n` +
                      `• **المواصفات والشروط**:\n${scope}\n\n` +
                      `⚠️ **تنبيه الأمان**: لا تقم بتسليم الكود أو أي مخرجات إلا بعد تأكيد وسيط معتمد باستلام الدفعة في هذا الروم!`
                    )
                    .setFooter({ text: 'Nexus Zero-Custody Escrow Protocol' });

                  await dealChannel.send({
                    content: `📢 تنبيه: تم بدء صفقة جديدة بواسطة ${interaction.user} مع ${counterparty}`,
                    embeds: [dealEmbed]
                  });
                }
              }

              await interaction.reply({
                content:
                  `✅ **تم تسجيل الصفقة بنجاح يا بطل!**\n` +
                  (dealChannel ? `🔗 يمكنك متابعة الصفقة في الروم المخصص: ${dealChannel}\n` : '') +
                  `المبلغ المقيد: **$${amount} USD**. وسيقوم وسيط معتمد بالتواصل داخل الروم لتأكيد الإيداع.`,
                ephemeral: true
              });
              return;
            }

            // 2. Submit Daily Task
            if (customId.startsWith('modal_submit_daily_')) {
              const taskId = customId.replace('modal_submit_daily_', '');
              const code = interaction.fields.getTextInputValue('daily_solution_code');

              const result = dailyTaskManager.submitTask(
                interaction.user.id,
                interaction.guildId || 'global',
                taskId,
                code
              );

              if (result.success) {
                await interaction.reply({
                  content:
                    `🎉 **أحسنت صنعاً! تم قبول الحل بنجاح!** 🎉\n` +
                    `• التقييم: **${result.score}/100**\n` +
                    `• المكافأة: **+${result.creditsAwarded} نقطة جدارة** 💰 | **+${result.xpAwarded} XP** ⭐\n` +
                    `• سلسلة النشاط (Streak): **${result.newStreak} يوم متواصل 🔥**\n` +
                    `• الملاحظات: ${result.feedback}`,
                  ephemeral: true
                });
              } else {
                await interaction.reply({
                  content: `⚠️ الحل المقدم غير مكتمل: ${result.feedback}\nحاول مرة أخرى مع كتابة كود مفصل أو رابط مشروع حقيقي.`,
                  ephemeral: true
                });
              }
              return;
            }

            // 3. Ask AI Prompt
            if (customId === 'modal_ask_ai') {
              const prompt = interaction.fields.getTextInputValue('input_ai_prompt');
              await interaction.deferReply({ ephemeral: true });

              const resp = await aiOrchestrator.generateResponse({
                prompt: `أنت Nexus، المساعد الذكي لمجتمع المبرمجين والمستقلين. أجب بالعامية المصرية الودودة والمحترفة مع أمثلة كود واضحة:\n\nالسؤال: ${prompt}`,
                userId: interaction.user.id,
                guildId: interaction.guildId || undefined,
              });

              const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('🧠 إجابة المساعد الذكي Nexus')
                .setDescription(resp.text.slice(0, 4000));

              await interaction.editReply({ embeds: [embed] });
              return;
            }
          } catch (modalErr: any) {
            logger.error('[Interaction] Modal error:', modalErr);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ حدث خطأ أثناء معالجة البيانات.', ephemeral: true });
            }
          }
          return;
        }
      });

      // Handle message events: Rules Engine & AI Chatbot
      client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        // 1. Evaluate through Rules Engine (R01-R50)
        try {
          const evalResult = rulesEngine.evaluateMessage({
            guildId: message.guildId || 'global',
            userId: message.author.id,
            content: message.content
          });

          if (evalResult.isViolation) {
            await message.reply({
              content: `⚠️ تنبيه أمني: ${evalResult.noticeAr || evalResult.reasonAr || 'الرسالة تخالف قواعد المجتمع'}`
            });
            return;
          }
        } catch (ruleErr) {
          logger.debug('[RulesEngine] Message eval check:', ruleErr);
        }

        // 2. Respond to direct mentions (@Nexus System) or questions in help channel
        const isMentioned = client.user && message.mentions.has(client.user);
        const isHelpChannel = 'name' in message.channel && (message.channel.name.includes('help') || message.channel.name.includes('مساعدة'));

        if (isMentioned || isHelpChannel) {
          try {
            if ('sendTyping' in message.channel) {
              await message.channel.sendTyping();
            }
            const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();
            if (!cleanContent) return;

            const aiResp = await aiOrchestrator.generateResponse({
              prompt: `أنت Nexus، المساعد الذكي لمجتمع المبرمجين والمستقلين. أجب بالعامية المصرية الودودة والعملية مع أمثلة كود واضحة:\n\nالسؤال: ${cleanContent}`,
              userId: message.author.id,
              guildId: message.guildId || undefined,
            });
            await message.reply({ content: aiResp.text.slice(0, 2000) });
          } catch (aiErr) {
            logger.error('[AIResponse] Error answering message:', aiErr);
          }
        }
      });

      // Handle new member join
      client.on('guildMemberAdd', async (member) => {
        try {
          const welcomeChannel = member.guild.channels.cache.find(c => c.name.includes('welcome'));
          if (welcomeChannel && 'send' in welcomeChannel) {
            await welcomeChannel.send({
              content: `👋 مرحباً بك يا ${member} في مجتمع **${member.guild.name}**! 🎉\n• اقرأ القواعد واضغط زر التوثيق في هذه القناة للبدء!\n• اطرح أسئلتك البرمجية عبر: \`/ask\`\n• استعرض فرص العمل عبر: \`/jobs\``
            });
          }
        } catch (joinErr) {
          logger.warn('[GuildMemberAdd] Welcome error:', joinErr);
        }
      });
    };

    try {
      discordClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Channel, Partials.Message, Partials.Reaction],
      });

      setupHandlers(discordClient);
      await discordClient.login(env.DISCORD_TOKEN);
    } catch (error: any) {
      if (error?.message && error.message.includes('disallowed intents')) {
        logger.warn('[Bootstrap] Privileged intents disallowed by Discord. Falling back to standard safe intents...');
        discordClient = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.DirectMessages,
          ],
          partials: [Partials.Channel, Partials.Message, Partials.Reaction],
        });
        setupHandlers(discordClient);
        await discordClient.login(env.DISCORD_TOKEN);
      } else {
        logger.warn('[Bootstrap] Discord login failed (check DISCORD_TOKEN):', error);
      }
    }
  } else {
    logger.info('[Bootstrap] DISCORD_TOKEN is set to mock/offline. Discord client running in local simulation mode.');
  }

  // 7. Graceful Shutdown Handlers
  const shutdown = async (signal: string) => {
    logger.info(`[Shutdown] Received ${signal}. Shutting down gracefully...`);
    try {
      if (discordClient) await discordClient.destroy();
      dashboardServer.close();
      logger.info('[Shutdown] All services stopped cleanly. Goodbye!');
      process.exit(0);
    } catch (err) {
      logger.error('[Shutdown] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  logger.info('[Bootstrap] Senior Progg ecosystem successfully initialized and running.');
}

// Start application if called directly
bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
