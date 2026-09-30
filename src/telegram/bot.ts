import { Bot } from 'grammy';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TelegramBot');

export class TelegramBotService {
  private bot: Bot | null = null;
  private isRunning: boolean = false;

  constructor() {
    if (env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_BOT_TOKEN.startsWith('mock_')) {
      try {
        this.bot = new Bot(env.TELEGRAM_BOT_TOKEN);
        this.registerHandlers();
        logger.info('Telegram companion bot initialized.');
      } catch (err) {
        logger.error('Failed to initialize grammY bot instance', err);
      }
    } else {
      logger.info('Telegram companion bot running in mock/offline mode.');
    }
  }

  private registerHandlers(): void {
    if (!this.bot) return;

    this.bot.command('start', (ctx) => {
      return ctx.reply(
        '👋 Welcome to the Senior Progg Discord Backup & Distribution Channel!\n' +
        'This channel serves as a secure off-platform archive for community-verified open source code, tips, and approved portfolio work.'
      );
    });

    this.bot.command('status', (ctx) => {
      return ctx.reply('🟢 Senior Progg Companion Bot is operational.');
    });
  }

  public async postArchiveMessage(text: string): Promise<boolean> {
    if (!this.bot || !env.TELEGRAM_BACKUP_CHANNEL_ID || env.TELEGRAM_BACKUP_CHANNEL_ID.startsWith('mock_')) {
      logger.debug(`[Mock Telegram Post] Channel: ${env.TELEGRAM_BACKUP_CHANNEL_ID} | Text: ${text.slice(0, 80)}...`);
      return true; // Succeeded in mock/test
    }

    try {
      await this.bot.api.sendMessage(env.TELEGRAM_BACKUP_CHANNEL_ID, text, { parse_mode: 'HTML' });
      return true;
    } catch (err) {
      logger.error('Failed to post message to Telegram backup channel', err);
      return false;
    }
  }

  public getRawBot(): Bot | null {
    return this.bot;
  }
}

export const telegramBotService = new TelegramBotService();
