export type SupportedLanguage = 'ar' | 'en';

// Detects if a string contains significant Arabic characters
export function detectLanguage(text: string): SupportedLanguage {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const arabicMatches = text.match(arabicRegex);
  if (!arabicMatches) return 'en';
  // If at least 20% of non-whitespace characters are Arabic, classify as Arabic
  const nonWhitespaceCount = text.replace(/\s+/g, '').length;
  if (nonWhitespaceCount === 0) return 'en';
  return (arabicMatches.length / nonWhitespaceCount) > 0.2 ? 'ar' : 'en';
}

export const STRINGS = {
  en: {
    welcome_title: 'Welcome to the Community!',
    welcome_body: 'Hey {username}! Welcome to Senior Progg Freelancers Community. Please check your private verification channel to get started.',
    rules_summary: '1. Respect all members\n2. No spam or unapproved self-promo\n3. Deliver with pride\n4. Never bypass verified escrow',
    verification_started: 'Starting your onboarding interview...',
    field_prompt: 'What is your primary craft? (Development, UI/UX Design, or Other)',
    exp_prompt: 'How many years of professional or freelance experience do you have?',
    tools_prompt: 'What are your top tools, frameworks, and technologies?',
    goals_prompt: 'What brings you to our community? (Finding clients, hiring, learning, peer review)',
    vetting_success: 'Verification passed! Welcome aboard, {role}.',
    larper_warning: 'Test score was below the required threshold. The "{role}" restriction role has been applied. You may appeal via /appeal.',
    appeal_received: 'Your appeal has been securely forwarded to server management. Case ID: {caseId}.',
    deal_created: 'New deal channel created: {channel}. Please confirm agreement terms.',
    dispute_opened: 'Dispute case opened. The assigned middleman will review within SLA.',
  },
  ar: {
    welcome_title: 'منور السيرفر يا باشا!',
    welcome_body: 'يا هلا بيك يا {username} في مجتمع سينور بروج للفريلانسرز (برمجة وتصميم). اتفضل في روم التوثيق الخاص بيك عشان نحدد مجالك ورتبتك.',
    rules_summary: '1. الاحترام المتبادل أساس السيرفر\n2. ممنوع الإعلانات والسبام\n3. كود نظيف وتصميم بجودة عالية\n4. الصفقات بأمان عن طريق الوسيط المعتمد',
    verification_started: 'يلا بينا نبدأ مقابلة التوثيق الخفيفة...',
    field_prompt: 'إيه مجالك الأساسي يا هندسة؟ (برمجة وتطوير / تصميم UI/UX / مجال تاني)',
    exp_prompt: 'عندك كام سنة خبرة في الشغل الحر أو الشركات؟',
    tools_prompt: 'إيه أهم الأدوات واللغات والفريموركس اللي بتشتغل بيها يومياً؟',
    goals_prompt: 'إيه هدفك من الانضمام لينا؟ (شغل وتيمات / تعليم وكورسات / مراجعة أعمالك)',
    vetting_success: 'ألف مبروك! عديت التوثيق بجدارة يا باشمهندس ورتبتك دلوقتي: {role}.',
    larper_warning: 'للأسف النتيجة كانت أقل من 50%، وتم تطبيق رتبة "{role}" مؤقتاً. تقدر تقدم التماس في أي وقت عن طريق /appeal.',
    appeal_received: 'تم استلام طلب الالتماس بتاعك ووصل للإدارة للمراجعة العادلة. كود الطلب: {caseId}.',
    deal_created: 'تم إنشاء روم الصفقة: {channel}. يرجى تأكيد الشروط والبنود.',
    dispute_opened: 'تم فتح نزاع بخصوص الصفقة، الوسيط المعتمد هيدخل يحل الموضوع فوراً.',
  },
} as const;

export function t(lang: SupportedLanguage, key: keyof typeof STRINGS['en'], params?: Record<string, string | number>): string {
  let template: string = STRINGS[lang]?.[key] || STRINGS['en'][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return template;
}
