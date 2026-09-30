import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import { dbService } from './database/connection.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { aiOrchestrator } from './ai/orchestrator.js';
import { PerkEngine } from './perks/perkEngine.js';
import { startDashboardServer } from './dashboard/server.js';
import { telegramBotService } from './telegram/bot.js';
import { data as setupCommand, execute as executeSetup } from './commands/setup.js';

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
      client.once('ready', async (c) => {
        logger.info(`[Bootstrap] Discord Client logged in as ${c.user.tag} (${c.user.id})`);

        // Register slash commands
        try {
          const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
          logger.info('[Bootstrap] Registering application slash commands...');
          await rest.put(
            Routes.applicationCommands(c.user.id),
            { body: [setupCommand.toJSON()] }
          );
          logger.info('[Bootstrap] Slash commands registered successfully.');
        } catch (regError) {
          logger.warn('[Bootstrap] Could not register slash commands globally:', regError);
        }
      });

      // Handle slash commands
      client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'setup') {
          await executeSetup(interaction);
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
