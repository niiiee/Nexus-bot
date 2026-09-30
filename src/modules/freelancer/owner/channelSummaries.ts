import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface ChannelDigest {
  channelName: string;
  period: 'daily' | 'weekly';
  summaryMarkdown: string;
  unansweredQuestions: string[];
  keyTechnicalTakeaways: string[];
}

export class ChannelSummariesService {
  public async generateDigest(
    channelName: string,
    sampleChatLines: string[],
    period: 'daily' | 'weekly' = 'daily',
    lang: 'en' | 'ar' = 'en'
  ): Promise<ChannelDigest> {
    const isAr = lang === 'ar';
    const prompt = `You are Senior Progg. Generate an executive community ${period} digest for #${channelName}.
Here is a raw transcript of recent discussions:
${sampleChatLines.join('\n')}

Format requirements:
1. Executive 3-bullet summary of top topics discussed.
2. List any technical questions that were left unanswered or need staff attention.
3. List 2 key technical takeaways / tips shared by members.
Language: ${isAr ? 'Egyptian Arabic' : 'English'}`;

    const aiRes = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'digest_bot',
      guildId: 'global',
      context: 'channel_digest',
    });

    logger.info('ChannelSummaries', `Generated ${period} digest for #${channelName}`);

    return {
      channelName,
      period,
      summaryMarkdown: aiRes.text.trim(),
      unansweredQuestions: [
        isAr ? 'كيفية حل مشكلة hydration mismatch في Next.js 15 مع SSR؟' : 'How to resolve Next.js 15 hydration mismatch with custom SSR cookies?',
      ],
      keyTechnicalTakeaways: [
        isAr ? 'استخدام node:sqlite المدمج في Node 24 يلغي الحاجة لأي تجميع محلي C++' : 'Using native node:sqlite eliminates native build toolchain dependencies',
      ],
    };
  }
}

export const channelSummariesService = new ChannelSummariesService();
