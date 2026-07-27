import { getNumber } from '@/ruleset/attributes';
import { afterworldsRuleset } from '@/ruleset/defaultRuleset';
import { validateRuleset } from '@/ruleset/validate';
import { SPECIES_BASE_STATS } from '@models/speciesTypes';
import { AVAILABLE_PERKS, AVAILABLE_DISTINCTIONS } from '@models/gameData';

describe('afterworldsRuleset', () => {
  it('is valid', () => {
    expect(validateRuleset(afterworldsRuleset)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('is JSON-serializable', () => {
    const roundTripped = JSON.parse(JSON.stringify(afterworldsRuleset));
    expect(roundTripped).toEqual(afterworldsRuleset);
  });

  it('carries one archetype per species, in SPECIES_BASE_STATS order', () => {
    expect(afterworldsRuleset.archetypes.map(a => a.id)).toEqual(
      Object.keys(SPECIES_BASE_STATS)
    );
  });

  it('carries every perk as a trait and every distinction as a quality', () => {
    expect(afterworldsRuleset.traits).toHaveLength(AVAILABLE_PERKS.length);
    expect(afterworldsRuleset.qualities).toHaveLength(
      AVAILABLE_DISTINCTIONS.length
    );
  });

  it('carries 12 trait categories and 36 category bonus rules', () => {
    expect(afterworldsRuleset.traitCategories).toHaveLength(12);
    expect(afterworldsRuleset.categoryBonuses).toHaveLength(36);
  });

  it.each([
    ['Human', 2, 2, 5, 5],
    ['Unturned', 0, 3, 0, 10],
    ['Rad-Titan', 3, 0, 10, 0],
    ['Mutoid', 2, 1, 5, 5],
  ])(
    'reproduces %s base values and caps exactly',
    (id, health, limit, healthCap, limitCap) => {
      const attributes = afterworldsRuleset.archetypes.find(
        a => a.id === id
      )?.attributes;

      expect(getNumber(attributes, 'health')).toBe(health);
      expect(getNumber(attributes, 'limit')).toBe(limit);
      expect(getNumber(attributes, 'healthCap')).toBe(healthCap);
      expect(getNumber(attributes, 'limitCap')).toBe(limitCap);
    }
  );

  it('declares caps as their own attributes, linked from the resource', () => {
    const health = afterworldsRuleset.attributes.find(a => a.id === 'health');
    const healthCap = afterworldsRuleset.attributes.find(
      a => a.id === 'healthCap'
    );

    expect(health?.role).toBe('resource');
    expect(health?.capAttributeId).toBe('healthCap');
    expect(healthCap?.role).toBe('cap');
  });

  it('carries a trait cap delta faithfully even though the engine ignores it', () => {
    // smarts_20 declares limitCap +1 in gameData. The transform must not
    // silently drop real source data — derived.ts is where the decision not
    // to apply trait cap deltas lives, and the parity suite proves it holds.
    const smarts20 = afterworldsRuleset.traits.find(t => t.id === 'smarts_20');
    expect(smarts20?.modifier?.attributeDeltas?.limitCap).toBe(1);
  });

  it('carries the Perfect Mutant carve-out as an archetype rule', () => {
    expect(afterworldsRuleset.archetypeRules).toEqual([
      {
        archetypeId: 'Perfect Mutant',
        kind: 'excludeCategoryScoreFromGroupRestrictedTraits',
        groupId: 'mutant',
      },
    ]);
  });

  it('places Tech-Mutant in the organic, mutant, and android groups', () => {
    const archetype = afterworldsRuleset.archetypes.find(
      a => a.id === 'Tech-Mutant'
    );
    expect(archetype?.groups.sort()).toEqual(
      ['organic', 'mutant', 'android'].sort()
    );
  });

  it('places Unknown in no group', () => {
    const archetype = afterworldsRuleset.archetypes.find(
      a => a.id === 'Unknown'
    );
    expect(archetype?.groups).toEqual([]);
  });
});
