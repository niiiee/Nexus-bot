import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { JobListing } from './jobBoard.js';

export interface MatchedCandidate {
  userId: string;
  username: string;
  seniorityLevel: string;
  matchedSkills: string[];
  matchScore: number; // 0 to 100
  language: 'en' | 'ar';
}

export class JobMatcherService {
  public findMatches(job: JobListing, minScore = 40): MatchedCandidate[] {
    const candidates = dbService.all<{
      user_id: string;
      username: string;
      seniority_level: string;
      tools: string;
      field: string;
      language: string;
    }>(
      `SELECT user_id, username, seniority_level, tools, field, language 
       FROM members 
       WHERE guild_id = ? AND opt_in_job_matching = 1 AND is_restricted = 0`,
      job.guildId
    );

    const matches: MatchedCandidate[] = [];
    const jobSkills = job.requiredSkills.map((s) => s.toLowerCase().trim());

    for (const member of candidates) {
      const memberTools = (member.tools || '')
        .split(',')
        .map((t) => t.toLowerCase().trim())
        .filter(Boolean);
      const memberField = (member.field || '').toLowerCase().trim();

      const matchedSkills = jobSkills.filter(
        (js) => memberTools.some((mt) => mt.includes(js) || js.includes(mt)) || memberField.includes(js)
      );

      if (jobSkills.length === 0) {
        matches.push({
          userId: member.user_id,
          username: member.username,
          seniorityLevel: member.seniority_level,
          matchedSkills: [],
          matchScore: 50,
          language: (member.language === 'ar' ? 'ar' : 'en'),
        });
        continue;
      }

      const matchRatio = matchedSkills.length / jobSkills.length;
      const score = Math.round(matchRatio * 100);

      if (score >= minScore) {
        matches.push({
          userId: member.user_id,
          username: member.username,
          seniorityLevel: member.seniority_level,
          matchedSkills,
          matchScore: score,
          language: (member.language === 'ar' ? 'ar' : 'en'),
        });
      }
    }

    // Sort by highest match score
    matches.sort((a, b) => b.matchScore - a.matchScore);
    logger.info('JobMatcher', `Found ${matches.length} matching candidates for job ${job.id}`);
    return matches;
  }

  public formatAlertMessage(candidate: MatchedCandidate, job: JobListing): string {
    const isAr = candidate.language === 'ar';
    if (isAr) {
      return (
        `👋 يا باشا، لقينا فرصة شغل مناسبة لمهاراتك بنسبة ${candidate.matchScore}%!\n\n` +
        `📌 **العنوان:** ${job.title}\n` +
        `💰 **الميزانية:** ${job.budgetRange}\n` +
        `🛠 **المهارات المتطابقة:** ${candidate.matchedSkills.join(', ') || 'مهارات عامة'}\n` +
        `⏳ **الموعد النهائي:** ${job.deadline}\n\n` +
        `تقدر تقدم على الوظيفة أو تشوف التفاصيل برقم: \`${job.id}\``
      );
    }

    return (
      `👋 Hey ${candidate.username}, we found an opportunity matching your skills (${candidate.matchScore}% match)!\n\n` +
      `📌 **Title:** ${job.title}\n` +
      `💰 **Budget:** ${job.budgetRange}\n` +
      `🛠 **Matched Skills:** ${candidate.matchedSkills.join(', ') || 'General'}\n` +
      `⏳ **Deadline:** ${job.deadline}\n\n` +
      `Check out details with Job ID: \`${job.id}\``
    );
  }
}

export const jobMatcherService = new JobMatcherService();
