import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface WorkshopSummary {
  id: string;
  guildId: string;
  channelId: string;
  topic: string;
  hostId: string;
  attendeesCount: number;
  keyTakeaways: string[];
  actionItems: string[];
  indexedToRAG: boolean;
  formattedNotes: string;
}

export class VoiceTranscriberService {
  /**
   * Generates the mandatory bilingual consent announcement.
   */
  public getConsentAnnouncement(locale: 'ar' | 'en' = 'ar'): string {
    if (locale === 'ar') {
      return (
        `🔴 **تنبيه الشفافية والموافقة (Voice Session Transcription)** 🎙️\n` +
        `هذه الجلسة الصوتية يتم تلخيصها تلقائياً عبر الذكاء الاصطناعي لاستخراج الملاحظات والـ Action Items وحفظها في بنك المعرفة (Knowledge Base).\n` +
        `⚠️ استمرارك في الروم الصوتي يعني موافقتك الصريحة على التلخيص وحفظ النقاط التقنية المفيدة للجميع.`
      );
    }
    return (
      `🔴 **Voice Session Transcription & Consent Notice** 🎙️\n` +
      `This voice session is being summarized by Senior Progg AI to capture technical takeaways, code snippets, and action items for the community knowledge base.\n` +
      `⚠️ Continued attendance in this voice room constitutes your explicit consent to session transcription.`
    );
  }

  /**
   * Summarizes raw transcript text into structured takeaways and action items.
   */
  public summarizeSession(params: {
    guildId: string;
    channelId: string;
    hostId: string;
    topic: string;
    transcriptText: string;
    attendeesCount: number;
    locale: 'ar' | 'en';
  }): WorkshopSummary {
    const id = cryptoRandomUUID();

    // Extract bullet points or synthesize structure
    const lines = params.transcriptText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5);

    const keyTakeaways: string[] = [];
    const actionItems: string[] = [];

    for (const line of lines) {
      if (line.toLowerCase().includes('todo') || line.toLowerCase().includes('action') || line.includes('مهمة') || line.includes('خطوة')) {
        actionItems.push(line.replace(/^(todo|action|مهمة|خطوة):\s*/i, ''));
      } else {
        keyTakeaways.push(line);
      }
    }

    if (keyTakeaways.length === 0) {
      keyTakeaways.push(
        params.locale === 'ar'
          ? 'تم استعراض أفضل الممارسات في كتابة الكود النظيف وهندسة البرمجيات.'
          : 'Reviewed software clean architecture and engineering best practices.'
      );
    }

    if (actionItems.length === 0) {
      actionItems.push(
        params.locale === 'ar'
          ? 'تطبيق النمط المعماري في المشروع الفردي القادم.'
          : 'Apply recommended architectural pattern in upcoming personal project.'
      );
    }

    const isAr = params.locale === 'ar';
    const formattedNotes = [
      isAr ? `📝 **ملخص ورشة العمل: ${params.topic}**` : `📝 **Workshop Summary: ${params.topic}**`,
      isAr ? `🎙️ المحاضر: <@${params.hostId}> | الحضور: ${params.attendeesCount} عضو\n` : `🎙️ Host: <@${params.hostId}> | Attendees: ${params.attendeesCount} members\n`,
      isAr ? `💡 **أبرز النقاط المستفادة:**` : `💡 **Key Takeaways:**`,
      ...keyTakeaways.slice(0, 5).map(t => `• ${t}`),
      isAr ? `\n📌 **الخطوات القادمة (Action Items):**` : `\n📌 **Action Items:**`,
      ...actionItems.slice(0, 5).map(a => `✅ ${a}`),
      isAr ? `\n🧠 تم حفظ هذا الملخص تلقائياً في بنك المعرفة للرجوع إليه لاحقاً.` : `\n🧠 Saved to server knowledge base for future reference.`,
    ].join('\n');

    // Index into RAG knowledge base table if available
    let indexed = false;
    try {
      dbService.run(
        `INSERT INTO memory_facts (id, user_id, fact_key, fact_value, confidence, source, timestamp)
         VALUES (?, ?, ?, ?, 1.0, 'workshop_transcriber', ?)`,
        id,
        params.hostId,
        `workshop:${params.topic.toLowerCase().replace(/\s+/g, '_')}`,
        JSON.stringify({
          topic: params.topic,
          takeaways: keyTakeaways,
          actionItems,
          date: Date.now(),
        }),
        Date.now()
      );
      indexed = true;
      logger.info(`[VoiceTranscriber] Workshop "${params.topic}" summarized and indexed to server_facts`);
    } catch (err) {
      logger.warn(`[VoiceTranscriber] Could not index to server_facts:`, err);
    }

    return {
      id,
      guildId: params.guildId,
      channelId: params.channelId,
      topic: params.topic,
      hostId: params.hostId,
      attendeesCount: params.attendeesCount,
      keyTakeaways: keyTakeaways.slice(0, 5),
      actionItems: actionItems.slice(0, 5),
      indexedToRAG: indexed,
      formattedNotes,
    };
  }
}

export const voiceTranscriberService = new VoiceTranscriberService();
