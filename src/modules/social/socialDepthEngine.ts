import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export class SocialDepthEngine {
  // Chapter 256: Interest Circles
  public createInterestCircle(circleName: string, leadId: string): { circleId: string; name: string; leadId: string } {
    return {
      circleId: `circ_${cryptoRandomUUID().substring(0, 8)}`,
      name: circleName,
      leadId
    };
  }

  // Chapter 257: Local Meetup Organizer Kit
  public registerMeetup(organizerId: string, title: string, city: string, dateTs: number, checklistCompleted: boolean): { meetupId: string; isApproved: boolean } {
    const id = `meet_${cryptoRandomUUID().substring(0, 8)}`;
    dbService.run(
      `INSERT INTO meetup_events (id, organizer_id, title, city, date_timestamp, safety_checklist_completed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      organizerId,
      title,
      city,
      dateTs,
      checklistCompleted ? 1 : 0,
      Date.now()
    );
    return { meetupId: id, isApproved: checklistCompleted };
  }

  // Chapter 258: Follow-the-Sun Support Desk
  public routeSupportQuestion(userTimezone: string, activeVolunteers: Array<{ id: string; timezone: string; activeTickets: number }>): string | null {
    const matching = activeVolunteers
      .filter((v) => v.timezone === userTimezone && v.activeTickets < 3)
      .sort((a, b) => a.activeTickets - b.activeTickets);
    return matching[0]?.id || activeVolunteers[0]?.id || null;
  }

  // Chapter 259: Structured Peer Support Circles
  public evaluatePeerCircleMessage(messageText: string): { triggersCareEscalation: boolean } {
    const lower = messageText.toLowerCase();
    const hasDistress = lower.includes('want to die') || lower.includes('end my life') || lower.includes('انتحار') || lower.includes('انهي حياتي');
    return { triggersCareEscalation: hasDistress };
  }

  // Chapter 260: Isolation Detection (Privacy-Preserving)
  public evaluateMemberIsolation(publicMessageCountLast30Days: number, isOptedIn: boolean): { sendGentleNudge: boolean } {
    if (!isOptedIn) return { sendGentleNudge: false };
    return { sendGentleNudge: publicMessageCountLast30Days === 0 };
  }

  // Chapter 261: Collaboration Partner Suggestions
  public suggestPartner(userSkills: string[], candidatePool: Array<{ id: string; skills: string[]; isOptedIn: boolean }>): string | null {
    for (const c of candidatePool) {
      if (!c.isOptedIn) continue;
      // Complementary check: candidate has skill user doesn't have
      const hasComplementary = c.skills.some((s) => !userSkills.includes(s));
      if (hasComplementary) return c.id;
    }
    return null;
  }

  // Chapter 262: Event Series Automation
  public rescheduleEventSeries(seriesId: string, newDateTimestamp: number): { seriesId: string; remindersUpdated: boolean } {
    return { seriesId, remindersUpdated: true };
  }

  // Chapter 263: Community Ritual Engine
  public checkQuietHoursForRitual(currentHourUtc: number, quietStart = 22, quietEnd = 6): boolean {
    if (quietStart > quietEnd) {
      return currentHourUtc >= quietStart || currentHourUtc < quietEnd;
    }
    return currentHourUtc >= quietStart && currentHourUtc < quietEnd;
  }

  // Chapter 264: Restorative Justice Tools
  public initRestorativeMediation(caseId: string, severity: string, consentP1: boolean, consentP2: boolean): { mediationOpened: boolean; mediatorAssigned: boolean } {
    // Only eligible for S1 and S2 cases with mutual consent
    const isEligible = (severity === 'S1' || severity === 'S2') && consentP1 && consentP2;
    return { mediationOpened: isEligible, mediatorAssigned: isEligible };
  }

  // Chapter 265: New Leader Training Path
  public verifyLeaderEligibility(modulesCompleted: string[]): boolean {
    const requiredModules = ['mod_ethics', 'mod_deescalation', 'mod_charter_parity'];
    return requiredModules.every((m) => modulesCompleted.includes(m));
  }

  // Chapter 266: Volunteer Management Hub
  public logVolunteerHours(volunteerId: string, activity: string, hours: number): boolean {
    dbService.run(
      `INSERT INTO volunteer_hours_ledger (id, volunteer_id, activity, hours_logged, logged_at)
       VALUES (?, ?, ?, ?, ?)`,
      `vol_${cryptoRandomUUID().substring(0, 8)}`,
      volunteerId,
      activity,
      hours,
      Date.now()
    );
    return true;
  }

  // Chapter 267: Recognition Wall with Stories
  public submitImpactStory(authorId: string, storyText: string, consentGranted: boolean): { published: boolean } {
    return { published: consentGranted && storyText.length > 20 };
  }

  // Chapter 268: Values Quiz at Onboarding
  public scoreValuesQuiz(scorePercent: number): { accessBlocked: boolean; feedback: string } {
    // Charter Guarantee: Non-gating, informational only, never blocks access
    return {
      accessBlocked: false,
      feedback: `You scored ${scorePercent}%. Thank you for learning about our community values!`
    };
  }

  // Chapter 270: Anonymous Opinion Pulse
  public castPulseVote(pollId: string, choiceIndex: number, isTimingDefenseApplied: boolean): { recorded: boolean; anonymous: boolean } {
    return { recorded: true, anonymous: isTimingDefenseApplied };
  }
}

export const socialDepthEngine = new SocialDepthEngine();
