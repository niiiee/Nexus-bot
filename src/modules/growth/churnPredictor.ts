import { logger } from '../../utils/logger.js';

export interface ChurnPredictionResult {
  userId: string;
  churnRiskScore: number; // 0 to 100
  riskFactors: string[];
  recommendedAction: 'no_action' | 'gentle_checkin' | 'winback_offer';
  personalizedMessage: string;
}

export class ChurnPredictorService {
  public predictChurn(params: {
    userId: string;
    daysInactive: number;
    hasFailedSkillTest: boolean;
    unansweredQuestionsCount: number;
    currentCredits: number;
    lang?: 'en' | 'ar';
  }): ChurnPredictionResult {
    const isAr = params.lang === 'ar';
    const riskFactors: string[] = [];
    let riskScore = 0;

    if (params.daysInactive >= 21) {
      riskFactors.push('Prolonged inactivity (> 21 days without message or task)');
      riskScore += 45;
    } else if (params.daysInactive >= 14) {
      riskFactors.push('Moderate inactivity (14-20 days)');
      riskScore += 25;
    }

    if (params.hasFailedSkillTest) {
      riskFactors.push('Failed a recent skill test or received penalty');
      riskScore += 30;
    }

    if (params.unansweredQuestionsCount > 0) {
      riskFactors.push('Asked questions that did not receive community replies');
      riskScore += 20;
    }

    riskScore = Math.min(100, riskScore);

    let recommendedAction: ChurnPredictionResult['recommendedAction'] = 'no_action';
    if (riskScore >= 60) recommendedAction = 'winback_offer';
    else if (riskScore >= 30) recommendedAction = 'gentle_checkin';

    let personalizedMessage = '';
    if (recommendedAction === 'winback_offer') {
      personalizedMessage = isAr
        ? 'يا باشا واحشنا في السيرفر! نزلنا مهام جديدة وتحديات برمجية وفيها مكافآت 100 نقطة إضافية. مستنيين كودك النظيف!'
        : 'Hey! We noticed you have been quiet lately. New community challenges just dropped with bonus 100 XP rewards. We would love to see you back!';
    } else if (recommendedAction === 'gentle_checkin') {
      personalizedMessage = isAr
        ? 'أهلاً يا صديقي! كيف الشغل والمشاريع؟ لو محتاج مراجعة كود أو مساعدة في صفقة إحنا موجودين دايماً.'
        : 'Hey there! How are your projects going? Remember our #help and code review rooms are open whenever you hit a blocker.';
    }

    logger.info('ChurnPredictor', `Predicted churn for user ${params.userId}: score=${riskScore} (${recommendedAction})`);

    return {
      userId: params.userId,
      churnRiskScore: riskScore,
      riskFactors,
      recommendedAction,
      personalizedMessage,
    };
  }
}

export const churnPredictorService = new ChurnPredictorService();
