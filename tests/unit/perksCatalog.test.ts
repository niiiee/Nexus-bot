import { describe, it, expect, beforeEach } from 'vitest';
import { ALL_195_PERKS } from '../../src/perks/catalog.js';
import { perkEngine } from '../../src/perks/perkEngine.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';
import { perkRepo } from '../../src/database/repositories/perkRepo.js';

describe('Phase 3: 195+ Modular Perks System (Section 7.4)', () => {
  const guildId = 'guild_perks_test';
  const userId = 'user_perk_shopper';

  beforeEach(() => {
    memberRepo.getOrCreate(userId, guildId, 'Shopper');
    memberRepo.update(userId, { credits_balance: 500 });
  });

  it('contains all 195 individually configured perks with unique IDs and metadata', () => {
    expect(ALL_195_PERKS.length).toBe(195);

    const ids = new Set<string>();
    for (const perk of ALL_195_PERKS) {
      expect(ids.has(perk.id)).toBe(false); // Zero duplicate IDs
      ids.add(perk.id);

      expect(perk.name).toBeDefined();
      expect(perk.category).toBeDefined();
      expect(perk.description).toBeDefined();
      expect(perk.credit_price).toBeGreaterThan(0);
      expect(perk.effectType).toBeDefined();
    }
  });

  it('seeds all 195 perks to database definitions', () => {
    perkEngine.seedCatalogToDatabase();
    const dbPerks = perkRepo.listAllDefinitions();
    expect(dbPerks.length).toBe(195);
  });

  it('filters perks catalog by category', () => {
    const progressionPerks = perkEngine.listCatalog('Progression');
    expect(progressionPerks.length).toBe(25);

    const cosmeticsPerks = perkEngine.listCatalog('Cosmetics');
    expect(cosmeticsPerks.length).toBe(35);

    const rolesAndColors = perkEngine.listCatalog('Roles & Colors');
    expect(rolesAndColors.length).toBe(25);

    const priorityAccess = perkEngine.listCatalog('Priority Access');
    expect(priorityAccess.length).toBe(25);

    const mentorship = perkEngine.listCatalog('Mentorship');
    expect(mentorship.length).toBe(25);

    const resources = perkEngine.listCatalog('Resources');
    expect(resources.length).toBe(25);

    const privileges = perkEngine.listCatalog('Privileges');
    expect(privileges.length).toBe(20);

    const events = perkEngine.listCatalog('Events');
    expect(events.length).toBe(15);
  });

  it('purchases a perk, deducts credits, and grants active entitlement', () => {
    // Member has 500 credits. Buy Bronze Spark (150 credits)
    const result = perkEngine.purchasePerk({
      userId,
      guildId,
      perkId: 'xp_boost_10',
    });

    expect(result.success).toBe(true);
    expect(result.remainingCredits).toBe(350);
    expect(perkEngine.hasPerk(userId, 'xp_boost_10')).toBe(true);

    const memberPerks = perkRepo.listMemberPerks(userId);
    expect(memberPerks.some(p => p.perk_id === 'xp_boost_10')).toBe(true);
  });

  it('fails safely with insufficient credits', () => {
    // Attempt to buy Immortal Key (5000 credits) with 350 credits
    const result = perkEngine.purchasePerk({
      userId,
      guildId,
      perkId: 'event_immortal_legend',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient credits');
  });
});
