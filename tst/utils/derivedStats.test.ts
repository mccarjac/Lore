/**
 * The **engine** test for `calculateDerivedStats`, written entirely against a
 * neutral fixture. It asserts the rules of the five-step pipeline, not the
 * numbers of any one ruleset.
 *
 * Afterworlds' actual numbers are guarded separately and more strictly by
 * `derivedStats.parity.test.ts`, which pins 27 cases captured from the
 * pre-generalization implementation. Duplicating those here — as this file
 * used to — proved only that the engine works for one ruleset.
 *
 * `mechanicsRuleset` (tst/fixtures) supplies:
 *   grit  (resource, capped by gritCap 6)   base 2  — sentinel 3
 *   spark (resource, capped by sparkCap 6)  base 2
 *   fate  (resource, UNCAPPED)              base 1
 *   traits  hammer_hand  forge  +1 grit
 *           kin_secret   forge  +1 fate, restricted to exactly group `kin`
 *           quick_read   wit    +1 spark
 *           steady_hand  wit    —
 *           overclock    wit    +2 sparkCap  (a cap delta: must be ignored)
 *   bonuses forge >= 2 -> +1 grit ; wit >= 3 -> +2 spark
 *   rule    revenant takes no category score from `kin`-restricted traits
 */
import { calculateDerivedStats } from '@/ruleset/derived';
import { num } from '@/ruleset/attributes';
import { GameCharacter, Modification } from '@/models/types';
import { mechanicsRuleset } from '../fixtures/mechanicsRuleset';

const character = (overrides: Partial<GameCharacter> = {}): GameCharacter => ({
  id: 'c1',
  name: 'Test',
  archetypeId: 'tinker',
  traitIds: [],
  qualityIds: [],
  factions: [],
  relationships: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
});

const statsFor = (overrides: Partial<GameCharacter> = {}) =>
  calculateDerivedStats(character(overrides), mechanicsRuleset);

describe('calculateDerivedStats — step 1: archetype base attributes', () => {
  it('reads numeric values from the character’s archetype', () => {
    const stats = statsFor();
    expect(stats.values.grit).toBe(2);
    expect(stats.values.spark).toBe(2);
    expect(stats.values.fate).toBe(1);
  });

  it('uses the archetype actually named, not the first declared', () => {
    expect(statsFor({ archetypeId: 'sentinel' }).values.grit).toBe(3);
  });

  it('carries non-numeric attributes through untouched', () => {
    // Capability flags ride along in `attributes`; only numbers reach `values`.
    expect(statsFor({ archetypeId: 'sentinel' }).attributes.attuned).toEqual({
      type: 'flag',
      value: true,
    });
    expect(statsFor().values.attuned).toBeUndefined();
  });

  it('falls back to zeroes for an archetype the ruleset does not define', () => {
    // Stored data may name an archetype from a ruleset that is no longer
    // active; that character must still render rather than throw.
    const stats = statsFor({ archetypeId: 'no-such-archetype' });
    expect(stats.values.grit).toBe(0);
    expect(stats.values.fate).toBe(0);
  });
});

describe('calculateDerivedStats — step 1b: character attribute overrides', () => {
  it('overrides the archetype base absolutely, not as a delta', () => {
    // 5, not 2 + 5. "This character has grit 5" is an assignment; deltas are
    // what traits and modifications are for.
    expect(statsFor({ attributes: { grit: num(5) } }).values.grit).toBe(5);
  });

  it('still clamps an override to the cap', () => {
    expect(statsFor({ attributes: { spark: num(9) } }).values.spark).toBe(6);
  });
});

describe('calculateDerivedStats — step 2: trait deltas and category scores', () => {
  it('applies a trait’s resource delta', () => {
    expect(statsFor({ traitIds: ['hammer_hand'] }).values.grit).toBe(3);
  });

  it('scores one point per held trait in its category', () => {
    const stats = statsFor({ traitIds: ['quick_read', 'steady_hand'] });
    expect(stats.categoryScores.get('wit')).toBe(2);
    expect(stats.categoryScores.get('forge')).toBeUndefined();
  });

  it('ignores trait ids the ruleset does not define', () => {
    expect(statsFor({ traitIds: ['not-a-trait'] }).values.grit).toBe(2);
  });

  it('does NOT let a trait raise a cap', () => {
    // `overclock` declares +2 sparkCap. Traits touch role 'resource' only, so
    // the ceiling must not move — Afterworlds' `smarts_20` is the real case,
    // and this proves the rule is general rather than a carve-out.
    const stats = statsFor({
      traitIds: ['overclock'],
      attributes: { spark: num(9) },
    });
    expect(stats.values.sparkCap).toBe(6);
    expect(stats.values.spark).toBe(6);
  });
});

describe('calculateDerivedStats — step 3: category-bonus grants', () => {
  it('grants nothing below the threshold', () => {
    const stats = statsFor({ traitIds: ['hammer_hand'] });
    expect(stats.categoryScores.get('forge')).toBe(1);
    expect(stats.values.grit).toBe(3); // base 2 + trait 1, no bonus
  });

  it('grants once the threshold is met', () => {
    const stats = statsFor({ traitIds: ['hammer_hand', 'kin_secret'] });
    expect(stats.categoryScores.get('forge')).toBe(2);
    expect(stats.values.grit).toBe(4); // base 2 + trait 1 + bonus 1
  });

  it('applies each category’s own threshold independently', () => {
    const stats = statsFor({
      traitIds: ['quick_read', 'steady_hand', 'overclock'],
    });
    expect(stats.categoryScores.get('wit')).toBe(3);
    expect(stats.values.spark).toBe(5); // base 2 + trait 1 + bonus 2
  });
});

describe('calculateDerivedStats — archetype rules', () => {
  const kinTraits = { traitIds: ['hammer_hand', 'kin_secret'] };

  it('suppresses category score from group-restricted traits for the named archetype', () => {
    // `kin_secret` is restricted to exactly the membership of group `kin`,
    // and `revenant` declares the carve-out — so it scores 1, not 2, and the
    // forge bonus never fires.
    const stats = calculateDerivedStats(
      character({ ...kinTraits, archetypeId: 'revenant' }),
      mechanicsRuleset
    );
    expect(stats.categoryScores.get('forge')).toBe(1);
    expect(stats.values.grit).toBe(3); // base 2 + trait 1, no bonus
  });

  it('still applies that trait’s attribute delta', () => {
    // The carve-out is about *score*, not about the trait doing nothing.
    const stats = calculateDerivedStats(
      character({ ...kinTraits, archetypeId: 'revenant' }),
      mechanicsRuleset
    );
    expect(stats.values.fate).toBe(2); // base 1 + kin_secret 1
  });

  it('leaves other archetypes in the same group alone', () => {
    const stats = calculateDerivedStats(
      character({ ...kinTraits, archetypeId: 'tinker' }),
      mechanicsRuleset
    );
    expect(stats.categoryScores.get('forge')).toBe(2);
    expect(stats.values.grit).toBe(4);
  });
});

describe('calculateDerivedStats — step 4: modifications', () => {
  const withMods = (modifications: Modification[]) =>
    statsFor({ modifications });

  it('applies resource deltas', () => {
    expect(
      withMods([
        {
          name: 'Brace',
          description: '',
          modifier: { attributeDeltas: { grit: 2 } },
        },
      ]).values.grit
    ).toBe(4);
  });

  it('may raise a cap, unlike a trait', () => {
    const stats = withMods([
      {
        name: 'Rig',
        description: '',
        modifier: { attributeDeltas: { spark: 5, sparkCap: 3 } },
      },
    ]);
    expect(stats.values.sparkCap).toBe(9);
    expect(stats.values.spark).toBe(7); // 2 + 5, under the raised cap
  });

  it('is clamped by the unraised cap when it only adds a resource', () => {
    expect(
      withMods([
        {
          name: 'Rig',
          description: '',
          modifier: { attributeDeltas: { spark: 5 } },
        },
      ]).values.spark
    ).toBe(6);
  });

  it('sums multiple modifications', () => {
    expect(
      withMods([
        {
          name: 'A',
          description: '',
          modifier: { attributeDeltas: { fate: 1 } },
        },
        {
          name: 'B',
          description: '',
          modifier: { attributeDeltas: { fate: 2 } },
        },
      ]).values.fate
    ).toBe(4);
  });

  it('reports category deltas but does NOT retroactively unlock a bonus', () => {
    // Modifications land at step 4, after grants are computed at step 3.
    const stats = withMods([
      {
        name: 'Charm',
        description: '',
        modifier: { categoryDeltas: { forge: 5 } },
      },
    ]);
    expect(stats.categoryScores.get('forge')).toBe(5);
    expect(stats.values.grit).toBe(2); // no bonus despite the score
  });

  it('treats a missing modifications array as none', () => {
    expect(statsFor({ modifications: undefined }).values.grit).toBe(2);
    expect(statsFor({ modifications: [] }).values.grit).toBe(2);
  });
});

describe('calculateDerivedStats — step 5: clamping', () => {
  it('clamps a resource that declares a cap attribute', () => {
    expect(statsFor({ attributes: { grit: num(50) } }).values.grit).toBe(6);
  });

  it('leaves a resource with no cap attribute unbounded', () => {
    expect(statsFor({ attributes: { fate: num(99) } }).values.fate).toBe(99);
  });
});

describe('calculateDerivedStats — isolation', () => {
  it('does not leak one character’s cap change onto another', () => {
    // The pre-generalization implementation mutated the shared archetype
    // stat objects; issue #6 fixed it and this is the guard.
    const plain = () => statsFor().values.spark;
    const before = plain();

    statsFor({
      modifications: [
        {
          name: 'Rig',
          description: '',
          modifier: { attributeDeltas: { spark: 5, sparkCap: 3 } },
        },
      ],
    });

    expect(plain()).toBe(before);
  });
});
