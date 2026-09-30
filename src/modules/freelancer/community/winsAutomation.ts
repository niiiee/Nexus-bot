import { logger } from '../../../utils/logger.js';

export interface WinPost {
  userId: string;
  username: string;
  category: 'first_client' | 'payment_received' | 'launched_product' | 'career_promotion';
  details: string;
}

export class WinsAutomationService {
  private arabicCongrats = [
    'ألف ألف مبروك يا باشا! بداية الغيث قطرة، والشغل النظيف دائماً بيجيب رزقه! 🚀🎉',
    'الله أكبر عليك! مجهود يدرّس، ومن نجاح لنجاح أكبر دايماً يا هندسة! 🌟🔥',
    'عاش يا فنان! السوق محتاج ناس مخلصة وشاطرة زيك. مبروك الإنجاز المستحق! 👏💰',
    'يا ألف نهار أبيض! فرحتنا بيك متتوصفش، كود نظيف وصفقة ناجحة تستاهل كل خير! 🥳🦾',
  ];

  private englishCongrats = [
    'Huge congratulations! Hard work and technical rigor always pay off. Onward and upward! 🚀🎉',
    'Massive win! The community is super proud of your dedication and execution! 🌟🔥',
    'Outstanding achievement! That is how a true senior freelancer delivers value! 👏💰',
    'Sensational! Another milestone crushed. Keep this momentum rolling! 🥳🦾',
  ];

  public generateCelebrationMessage(post: WinPost, lang: 'en' | 'ar' = 'en'): { embed: object; shoutout: string } {
    const isAr = lang === 'ar';
    const list = isAr ? this.arabicCongrats : this.englishCongrats;
    const shoutout = list[Math.floor(Math.random() * list.length)];

    const categoryNames: Record<string, { en: string; ar: string }> = {
      first_client: { en: '🤝 First Client Signed', ar: '🤝 توقيع أول عميل' },
      payment_received: { en: '💰 Payment Milestone Received', ar: '💰 استلام مستحقات دفعة' },
      launched_product: { en: '🚀 Product / App Shipped', ar: '🚀 إطلاق مشروع / تطبيق' },
      career_promotion: { en: '🏆 Career Upgrade & Promotion', ar: '🏆 ترقية مهنية مستحقة' },
    };

    const cat = categoryNames[post.category] || { en: '🎉 Big Win', ar: '🎉 إنجاز جديد' };

    logger.info('WinsAutomation', `Generated win celebration for ${post.username}: ${post.category}`);

    const embed = {
      title: isAr ? `🔥 إنجاز جديد في مجتمعنا: ${cat.ar}!` : `🔥 Community Win: ${cat.en}!`,
      description: `**${post.username}**: "${post.details}"\n\n${shoutout}`,
      color: 0x10b981,
      footer: {
        text: isAr ? 'شاركنا إنجازك في قناة #wins بـ /win' : 'Share your wins in #wins with /win',
      },
    };

    return { embed, shoutout };
  }
}

export const winsAutomationService = new WinsAutomationService();
