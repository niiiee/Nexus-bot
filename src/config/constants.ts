export const CHANNELS = {
  WELCOME: 'welcome',
  VERIFY_PREFIX: 'verify-',
  STAFF_REVIEW: 'staff-review',
  SHOWCASE: 'showcase',
  HELP: 'help',
  RECORDED_COURSES: 'recorded-courses',
  TECH_EVENTS: 'tech-events',
  DESIGN_EVENTS: 'design-events',
  DEALS: 'deals',
  DEAL_PREFIX: 'deal-',
  DISPUTE_PREFIX: 'dispute-',
  WINS: 'wins',
  CHANGELOG: 'changelog',
  AUDIT_LOGS: 'staff-audit-logs',
  ANNOUNCEMENTS: 'announcements',
} as const;

export const DEFAULT_ROLES = {
  // Seniority
  JUNIOR_DEV: 'Junior Developer',
  MID_DEV: 'Mid-Level Developer',
  SENIOR_DEV: 'Senior Developer',
  SPECIALIST_DEV: 'Specialist Developer',
  JUNIOR_DESIGNER: 'Junior Designer',
  MID_DESIGNER: 'Mid-Level Designer',
  SENIOR_DESIGNER: 'Senior Designer',
  SPECIALIST_DESIGNER: 'Specialist Designer',

  // Community & Events
  VERIFIED_MEMBER: 'Verified Member',
  TECH_EVENTS: 'Tech Events',
  DESIGN_EVENTS: 'Design Events',
  STAFF: 'Staff Moderator',
  OWNER: 'Server Owner / CEO',
  
  // Restriction & Middleman
  LARPER: 'Larper / Manipulator',
  VERIFIED_MIDDLEMAN: 'Verified Middleman',
  SENIOR_MIDDLEMAN: 'Senior Middleman',
  HEAD_MIDDLEMAN: 'Head Middleman',
  TRAINEE_MIDDLEMAN: 'Trainee Middleman',
} as const;

export const DEFAULT_THRESHOLDS = {
  SUSPICION_ESCALATION: 0.65, // > 65% suspicion triggers silent staff review
  PASSING_TEST_SCORE: 50,      // < 50% triggers Larper penalty
  MIN_EXPERIENCE_YEARS_FOR_TEST: 3,
  MIN_RESTRICTION_HOURS: 12,
  MAX_RESTRICTION_HOURS: 168, // 7 days
  DEFAULT_ROLLING_WINDOW_HOURS: 24,
  ACTIVITY_DROP_THRESHOLD_PERCENT: 40,
  QUIET_HOURS_START_UTC: 22,   // 10 PM UTC
  QUIET_HOURS_END_UTC: 6,      // 6 AM UTC
  MAX_DAILY_CREDITS_DEFAULT: 500,
  MAX_HOURLY_PINGS: 3,
} as const;

export const SENIOR_PROGG_PERSONA = {
  NAME: 'Senior Progg',
  TAGLINE: 'Senior Full-Stack Architect & Community Mentor',
  AVATAR_URL: 'https://cdn.discordapp.com/embed/avatars/0.png',
  GREETINGS_AR: [
    'يا هلا يا باشمهندس! منور السيرفر.',
    'يا مرحب يا فنان! مستنيين إبداعاتك وشغلك الجامد.',
    'أهلاً بيك في بيت المطورين والمصممين الفريلانسرز!',
    'يا باشا نورت، جهز قهوتك وتعال نبني مع بعض.',
  ],
  GREETINGS_EN: [
    'Welcome aboard, engineer! Glad to have you here.',
    'Welcome to the premier freelancer community for devs & designers!',
    'Grab your coffee and get ready to build something remarkable.',
    'Hey there! Excited to see your craft and contributions.',
  ],
} as const;
