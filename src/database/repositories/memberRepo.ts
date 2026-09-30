import { dbService } from '../connection.js';

export interface MemberRecord {
  user_id: string;
  guild_id: string;
  username: string;
  field?: string;
  seniority_level: string;
  claimed_experience_years: number;
  tools?: string;
  goals?: string;
  language: string;
  reputation_score: number;
  credits_balance: number;
  lifecycle_stage: string;
  is_restricted: number;
  restriction_expires_at?: number | null;
  opt_in_events: number;
  opt_in_job_matching: number;
  opt_in_telegram_backup: number;
  opt_in_banter: number;
  current_streak: number;
  last_task_date?: string | null;
  created_at: number;
  updated_at: number;
}

export class MemberRepository {
  public get(userId: string): MemberRecord | undefined {
    return dbService.get<MemberRecord>('SELECT * FROM members WHERE user_id = ?', userId);
  }

  public getOrCreate(userId: string, guildId: string, username: string): MemberRecord {
    const existing = this.get(userId);
    if (existing) return existing;

    const now = Date.now();
    dbService.run(
      `INSERT INTO members (
        user_id, guild_id, username, seniority_level, claimed_experience_years,
        language, reputation_score, credits_balance, lifecycle_stage, is_restricted,
        opt_in_events, opt_in_job_matching, opt_in_telegram_backup, opt_in_banter,
        current_streak, created_at, updated_at
      ) VALUES (?, ?, ?, 'Junior', 0, 'en', 100, 50, 'Newcomer', 0, 1, 1, 0, 1, 0, ?, ?)`,
      userId,
      guildId,
      username,
      now,
      now
    );

    return this.get(userId)!;
  }

  public createMember(data: {
    userId: string;
    guildId: string;
    username: string;
    seniorityLevel?: string;
    claimedExperienceYears?: number;
    tools?: string;
    field?: string;
    goals?: string;
    language?: string;
    reputationScore?: number;
    creditsBalance?: number;
    optInJobMatching?: boolean;
    currentStreak?: number;
  }): MemberRecord {
    const member = this.getOrCreate(data.userId, data.guildId, data.username);
    return this.update(data.userId, {
      seniority_level: data.seniorityLevel ?? member.seniority_level,
      claimed_experience_years: data.claimedExperienceYears ?? member.claimed_experience_years,
      tools: data.tools ?? member.tools,
      field: data.field ?? member.field,
      goals: data.goals ?? member.goals,
      language: data.language ?? member.language,
      reputation_score: data.reputationScore ?? member.reputation_score,
      credits_balance: data.creditsBalance ?? member.credits_balance,
      opt_in_job_matching: data.optInJobMatching !== undefined ? (data.optInJobMatching ? 1 : 0) : member.opt_in_job_matching,
      current_streak: data.currentStreak ?? member.current_streak,
    });
  }

  public update(userId: string, partial: Partial<Omit<MemberRecord, 'user_id' | 'created_at'>>): MemberRecord {
    const keys = Object.keys(partial);
    if (keys.length === 0) return this.get(userId)!;

    const setClauses = keys.map(k => `${k} = ?`).join(', ') + ', updated_at = ?';
    const values = [...Object.values(partial), Date.now(), userId];

    dbService.run(`UPDATE members SET ${setClauses} WHERE user_id = ?`, ...values as (string | number | null)[]);
    return this.get(userId)!;
  }

  public adjustCredits(userId: string, delta: number): number {
    const member = this.get(userId);
    if (!member) throw new Error(`Member ${userId} not found`);

    const newBalance = Math.max(0, member.credits_balance + delta);
    this.update(userId, { credits_balance: newBalance });
    return newBalance;
  }

  public adjustReputation(userId: string, delta: number): number {
    const member = this.get(userId);
    if (!member) throw new Error(`Member ${userId} not found`);

    const newReputation = Math.max(0, member.reputation_score + delta);
    this.update(userId, { reputation_score: newReputation });
    return newReputation;
  }

  public listTopReputation(limit: number = 10): MemberRecord[] {
    return dbService.all<MemberRecord>('SELECT * FROM members ORDER BY reputation_score DESC LIMIT ?', limit);
  }

  public exportUserData(userId: string): Record<string, unknown> {
    const member = this.get(userId);
    const vetting = dbService.all('SELECT * FROM vetting_sessions WHERE user_id = ?', userId);
    const tests = dbService.all('SELECT * FROM skill_tests WHERE user_id = ?', userId);
    const works = dbService.all('SELECT * FROM work_submissions WHERE user_id = ?', userId);
    const deals = dbService.all('SELECT * FROM deals WHERE client_id = ? OR freelancer_id = ?', userId, userId);
    const perks = dbService.all('SELECT * FROM member_perks WHERE user_id = ?', userId);
    const ledger = dbService.all('SELECT * FROM credit_ledger WHERE user_id = ?', userId);
    const memory = dbService.all('SELECT * FROM memory_facts WHERE user_id = ?', userId);

    return {
      memberProfile: member,
      vettingSessions: vetting,
      skillTests: tests,
      workSubmissions: works,
      escrowDeals: deals,
      ownedPerks: perks,
      creditHistory: ledger,
      aiMemoryFacts: memory,
    };
  }

  public purgeUserData(userId: string): void {
    // Delete personal user records while preserving required dispute audit trail
    dbService.run('DELETE FROM members WHERE user_id = ?', userId);
    dbService.run('DELETE FROM vetting_sessions WHERE user_id = ?', userId);
    dbService.run('DELETE FROM skill_tests WHERE user_id = ?', userId);
    dbService.run('DELETE FROM member_perks WHERE user_id = ?', userId);
    dbService.run('DELETE FROM memory_facts WHERE user_id = ?', userId);
  }
}

export const memberRepo = new MemberRepository();
