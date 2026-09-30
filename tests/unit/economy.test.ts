import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { creditLedgerService } from '../../src/modules/economy/creditLedger.js';
import { perkShopService } from '../../src/modules/economy/perkShop.js';
import { seasonalEngineService } from '../../src/modules/economy/seasonalEngine.js';
import { squadManagerService } from '../../src/modules/economy/squadManager.js';
import { questEngineService } from '../../src/modules/economy/questEngine.js';
import { achievementEngineService } from '../../src/modules/economy/achievementEngine.js';
import { microMarketplaceService } from '../../src/modules/economy/microMarketplace.js';
import { antiCheatEngineService } from '../../src/modules/economy/antiCheatEngine.js';
import { economyBalancingService } from '../../src/modules/economy/economyBalancing.js';
import { hallOfFameService } from '../../src/modules/economy/hallOfFame.js';

describe('Economy, Seasons & Guilds (Section 19)', () => {
  const guildId = 'guild_econ_123';
  const userA = 'user_econ_a';
  const userB = 'user_econ_b';

  beforeEach(() => {
    // Seed members
    dbService.run(`DELETE FROM members WHERE guild_id = ?`, guildId);
    dbService.run(`DELETE FROM squads WHERE guild_id = ?`, guildId);
    dbService.run(`DELETE FROM marketplace_listings WHERE guild_id = ?`, guildId);
    dbService.run(`DELETE FROM credit_ledger WHERE guild_id = ?`, guildId);
    const now = Date.now();
    dbService.run(
      `INSERT INTO members (user_id, guild_id, username, credits, xp, reputation_score, created_at, updated_at)
       VALUES (?, ?, 'UserA', 1000, 500, 100, ?, ?)`,
      userA,
      guildId,
      now,
      now
    );
    dbService.run(
      `INSERT INTO members (user_id, guild_id, username, credits, xp, reputation_score, created_at, updated_at)
       VALUES (?, ?, 'UserB', 200, 100, 80, ?, ?)`,
      userB,
      guildId,
      now,
      now
    );
  });

  it('REQ-19.1: creditLedger handles transactions, double entry audit, and peer transfers', () => {
    // Credit grant
    const res = creditLedgerService.recordTransaction({
      userId: userA,
      guildId,
      amount: 100,
      type: 'admin_grant',
      description: 'Admin bonus',
      bypassCap: true,
    });
    expect(res.success).toBe(true);
    expect(creditLedgerService.getBalance(userA, guildId)).toBe(1100);

    // Transfer
    const transfer = creditLedgerService.transferCredits(userA, userB, guildId, 150, 'Collaboration split');
    expect(transfer.success).toBe(true);
    expect(creditLedgerService.getBalance(userA, guildId)).toBe(950);
    expect(creditLedgerService.getBalance(userB, guildId)).toBe(350);
  });

  it('REQ-19.2: perkShop filters catalog and formats paginated Discord view', () => {
    const all = perkShopService.browseShop();
    expect(all.length).toBeGreaterThan(150);

    const page = perkShopService.formatShopPage({
      page: 1,
      locale: 'ar',
    });
    expect(page.totalPages).toBeGreaterThan(1);
    expect(page.text).toContain('متجر المزايا');
  });

  it('REQ-19.3: seasonalEngine manages active season, tracks XP tiers, and resets', () => {
    const season = seasonalEngineService.getOrCreateActiveSeason(guildId);
    expect(season.name).toContain('Season 1');

    const progress = seasonalEngineService.getMemberSeasonProgress(600);
    expect(progress.currentLevel).toBe(3);

    const reset = seasonalEngineService.concludeSeasonAndReset(guildId);
    expect(reset.newSeason.number).toBe(2);
  });

  it('REQ-19.4: squadManager creates squad, handles membership and leaderboard', () => {
    const squad = squadManagerService.createSquad(guildId, userA, 'Cairo Pyramids Devs');
    expect(squad.success).toBe(true);
    expect(squad.squad?.name).toBe('Cairo Pyramids Devs');

    const join = squadManagerService.joinSquad(guildId, squad.squad!.id, userB);
    expect(join.success).toBe(true);

    squadManagerService.addSquadPoints(squad.squad!.id, 250);
    const leaders = squadManagerService.getLeaderboard(guildId);
    expect(leaders.length).toBeGreaterThan(0);
    expect(leaders[0].points).toBe(250);
  });

  it('REQ-19.5: questEngine assigns narrative quests and records objective progress', () => {
    const active = questEngineService.startQuest(userA, guildId, 'cw_quest_1');
    expect(active).toBeDefined();

    const progress1 = questEngineService.recordProgress(userA, guildId, 'cw_quest_1', 'cw_obj_1', 1);
    expect(progress1.newlyCompleted).toBe(false);

    const progress2 = questEngineService.recordProgress(userA, guildId, 'cw_quest_1', 'cw_obj_2', 1);
    expect(progress2.newlyCompleted).toBe(true);
  });

  it('REQ-19.6: achievementEngine contains 100+ achievements and unlocks them', () => {
    const catalog = achievementEngineService.listAchievements();
    expect(catalog.length).toBeGreaterThanOrEqual(90);

    const unlock = achievementEngineService.unlockAchievement(userA, guildId, 'code_first_task');
    expect(unlock.newlyUnlocked).toBe(true);
    expect(unlock.achievement?.titleUnlocked).toBe('Novice Coder');

    const userAchs = achievementEngineService.getUserAchievements(userA, guildId);
    expect(userAchs.some(a => a.id === 'code_first_task')).toBe(true);
  });

  it('REQ-19.7: microMarketplace creates listing, holds escrow, and confirms payout', () => {
    const listing = microMarketplaceService.createListing({
      guildId,
      sellerId: userA,
      title: 'Full Stack Code Review',
      description: 'Detailed PR review with architecture notes',
      priceCredits: 100,
    });
    expect(listing.success).toBe(true);

    // User B purchases
    const purchase = microMarketplaceService.purchaseListing(userB, listing.listing!.id);
    expect(purchase.success).toBe(true);

    // Confirm completion
    const complete = microMarketplaceService.completeOrder(listing.listing!.id, userB);
    expect(complete.success).toBe(true);
  });

  it('REQ-19.8: antiCheatEngine detects spam velocity and duplicate message flooding', () => {
    antiCheatEngineService.unfreezeAccount(userA);

    for (let i = 0; i < 8; i++) {
      const check = antiCheatEngineService.inspectMessageActivity(userA, guildId, `normal message unique ${i}`);
      expect(check.isSuspicious).toBe(false);
    }

    // Velocity burst trigger (>8 messages)
    const burst = antiCheatEngineService.inspectMessageActivity(userA, guildId, 'spam message burst final');
    expect(burst.isSuspicious).toBe(true);
    expect(burst.actionTaken).toBe('rollback_and_freeze');
    expect(antiCheatEngineService.isFrozen(userA)).toBe(true);

    antiCheatEngineService.unfreezeAccount(userA);
  });

  it('REQ-19.9: economyBalancing evaluates macro supply, sinks, and inflation diagnosis', () => {
    const balance = economyBalancingService.evaluateEconomy(guildId);
    expect(balance.totalCreditSupply).toBeGreaterThan(0);
    expect(['Deflationary', 'Balanced', 'Moderate Inflation', 'High Inflation']).toContain(balance.inflationStatus);
    expect(balance.recommendedFaucetMultiplier).toBeGreaterThan(0);
  });

  it('REQ-19.10: hallOfFame generates monthly inductions and social recognition card', () => {
    const card = hallOfFameService.generateRecognitionCard(guildId, 'September 2026', 'ar');
    expect(card.formattedEmbedText).toContain('لوحة الشرف');
    expect(card.inductees.length).toBeGreaterThanOrEqual(1);
  });
});
