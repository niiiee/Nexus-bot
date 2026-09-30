import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';

export interface ReputationBreakdown {
  userId: string;
  totalScore: number;
  components: {
    baseScore: number;
    verifiedProjectsCount: number;
    verifiedProjectsPoints: number;
    endorsementsCount: number;
    endorsementsPoints: number;
    tasksCompletedCount: number;
    tasksPoints: number;
    cleanDealsCount: number;
    cleanDealsPoints: number;
    disputePenalties: number;
  };
  explanation: string;
}

export class ReputationEngine {
  private weights = {
    verifiedProject: 30,
    endorsement: 10,
    dailyTask: 5,
    cleanDeal: 50,
    disputePenalty: 75,
  };

  public calculateReputation(userId: string, guildId: string, lang: 'en' | 'ar' = 'en'): ReputationBreakdown {
    const isAr = lang === 'ar';
    const baseScore = 100;

    // 1. Verified first work projects
    const verifiedProjects = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM work_submissions WHERE user_id = ? AND guild_id = ? AND status = 'approved'`,
      userId,
      guildId
    )?.count || 0;
    const verifiedProjectsPoints = verifiedProjects * this.weights.verifiedProject;

    // 2. Peer endorsements received
    const endorsements = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM endorsements WHERE receiver_id = ? AND guild_id = ?`,
      userId,
      guildId
    )?.count || 0;
    const endorsementsPoints = endorsements * this.weights.endorsement;

    // 3. Approved daily tasks
    const tasksCompleted = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_submissions WHERE user_id = ? AND status = 'approved'`,
      userId
    )?.count || 0;
    const tasksPoints = tasksCompleted * this.weights.dailyTask;

    // 4. Clean completed deals (as freelancer or client)
    const cleanDeals = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM deals 
       WHERE guild_id = ? AND (freelancer_id = ? OR client_id = ?) AND status = 'completed'`,
      guildId,
      userId,
      userId
    )?.count || 0;
    const cleanDealsPoints = cleanDeals * this.weights.cleanDeal;

    // 5. Disputed deals penalties
    const disputedDeals = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM deals 
       WHERE guild_id = ? AND (freelancer_id = ? OR client_id = ?) AND status = 'disputed'`,
      guildId,
      userId,
      userId
    )?.count || 0;
    const disputePenalties = disputedDeals * this.weights.disputePenalty;

    const totalScore = Math.max(
      0,
      baseScore + verifiedProjectsPoints + endorsementsPoints + tasksPoints + cleanDealsPoints - disputePenalties
    );

    // Update in members table
    dbService.run(
      `UPDATE members SET reputation_score = ? WHERE user_id = ? AND guild_id = ?`,
      totalScore,
      userId,
      guildId
    );

    const explanation = isAr
      ? `معادلة السمعة الشفافة:\n` +
        `• الأساس: ${baseScore} نقطة\n` +
        `• مشاريع معتمدة: +${verifiedProjectsPoints} (${verifiedProjects} × ${this.weights.verifiedProject})\n` +
        `• تزكيات الزملاء: +${endorsementsPoints} (${endorsements} × ${this.weights.endorsement})\n` +
        `• مهام يومية منجزة: +${tasksPoints} (${tasksCompleted} × ${this.weights.dailyTask})\n` +
        `• صفقات وساطة مكتملة بنجاح: +${cleanDealsPoints} (${cleanDeals} × ${this.weights.cleanDeal})\n` +
        (disputePenalties > 0 ? `• خصومات النزاعات: -${disputePenalties} (${disputedDeals} × ${this.weights.disputePenalty})\n` : '') +
        `المجموع النهائي: ${totalScore} نقطة`
      : `Transparent Reputation Breakdown:\n` +
        `• Base: ${baseScore} pts\n` +
        `• Verified Projects: +${verifiedProjectsPoints} (${verifiedProjects} × ${this.weights.verifiedProject})\n` +
        `• Peer Endorsements: +${endorsementsPoints} (${endorsements} × ${this.weights.endorsement})\n` +
        `• Daily Tasks: +${tasksPoints} (${tasksCompleted} × ${this.weights.dailyTask})\n` +
        `• Dispute-free Deals: +${cleanDealsPoints} (${cleanDeals} × ${this.weights.cleanDeal})\n` +
        (disputePenalties > 0 ? `• Dispute Penalties: -${disputePenalties} (${disputedDeals} × ${this.weights.disputePenalty})\n` : '') +
        `Total Reputation Score: ${totalScore} pts`;

    logger.info('ReputationEngine', `Calculated reputation for user ${userId}: ${totalScore}`);

    return {
      userId,
      totalScore,
      components: {
        baseScore,
        verifiedProjectsCount: verifiedProjects,
        verifiedProjectsPoints,
        endorsementsCount: endorsements,
        endorsementsPoints,
        tasksCompletedCount: tasksCompleted,
        tasksPoints,
        cleanDealsCount: cleanDeals,
        cleanDealsPoints,
        disputePenalties,
      },
      explanation,
    };
  }
}

export const reputationEngine = new ReputationEngine();
