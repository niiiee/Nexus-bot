import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
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
  statusCommand, executeStatus
} from './commands/nexusSuite.js';
import { rulesEngine } from './modules/rules/rulesEngine.js';

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
        escrowCommand.toJSON(),
        fundCommand.toJSON(),
        jobsCommand.toJSON(),
        competitionsCommand.toJSON(),
        statusCommand.toJSON(),
      ];

      client.once('ready', async (c) => {
        logger.info(`[Bootstrap] Discord Client logged in as ${c.user.tag} (${c.user.id})`);

        // Register slash commands globally AND per-guild for instant availability
        try {
          const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
          logger.info('[Bootstrap] Registering all 11 application slash commands globally...');
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
          logger.info('[Bootstrap] All slash commands registered successfully.');
        } catch (regError) {
          logger.warn('[Bootstrap] Could not register slash commands globally:', regError);
        }
      });

      // Handle slash commands
      client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

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
              content: `👋 مرحباً بك يا ${member} في مجتمع **${member.guild.name}**! 🎉\n• اقرأ القواعد عبر: \`/rules\`\n• اطرح أسئلتك البرمجية عبر: \`/ask\`\n• استعرض فرص العمل عبر: \`/jobs\``
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
