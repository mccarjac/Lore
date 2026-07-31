/**
 * The **engine** test for `calculateDerivedStats`, written entirely against a
 * neutral fixture. It asserts the rules of the six-step pipeline, not the
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
 *   knacks (preBonus, deltaRoles: ['resource'], categoryScore)
 *           hammer_hand  forge  +1 grit
 *           kin_secret   forge  +1 fate, restricted to exactly group `kin`
 *           quick_read   wit    +1 spark
 *           steady_hand  wit    —
 *           overclock    wit    +2 sparkCap  (a cap delta: must be ignored)
 *   bonds  (a SECOND, independent scored collection)
 *           oath_kept    duty     —
 *           old_friend   kinship  +1 grit
 *   rigs   (authored, postBonus, deltaRoles: ['resource', 'cap'])
 *   bonuses knacks: forge >= 2 -> +1 grit ; wit >= 3 -> +2 spark
 *           bonds:  duty >= 1 -> +1 fate
 *   rule    revenant takes no category score from `kin`-restricted knacks
 */
import { calculateDerivedStats } from '@/ruleset/derived';
import { num } from '@/ruleset/attributes';
import { getCategoryScore } from '@/ruleset/facets';
import { GameCharacter, FacetValue, AuthoredFacetEntry } from '@/models/types';
import { mechanicsRuleset } from '../fixtures/mechanicsRuleset';

const character = (
  facets: Record<string, FacetValue[]> = { callings: ['tinker'] },
  overrides: Partial<GameCharacter> = {}
): GameCharacter => ({
  id: 'c1',
  name: 'Test',
  facets,
  factions: [],
  relationships: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
});

const statsFor = (
  facets?: Record<string, FacetValue[]>,
  overrides?: Partial<GameCharacter>
) => calculateDerivedStats(character(facets, overrides), mechanicsRuleset);

const knackScore = (
  stats: ReturnType<typeof statsFor>,
  categoryId: string
): number => getCategoryScore(stats.categoryScores, 'knacks', categoryId);

describe('calculateDerivedStats — step 1: base collection attributes', () => {
  it('reads numeric values from the character’s held single-collection entry', () => {
    const stats = statsFor();
    expect(stats.values.grit).toBe(2);
    expect(stats.values.spark).toBe(2);
    expect(stats.values.fate).toBe(1);
  });

  it('uses the entry actually held, not the first declared', () => {
    expect(statsFor({ callings: ['sentinel'] }).values.grit).toBe(3);
  });

  it('carries non-numeric attributes through untouched', () => {
    // Capability flags ride along in `attributes`; only numbers reach `values`.
    expect(statsFor({ callings: ['sentinel'] }).attributes.attuned).toEqual({
      type: 'flag',
      value: true,
    });
    expect(statsFor().values.attuned).toBeUndefined();
  });

  it('falls back to zeroes when no single-collection entry is held', () => {
    // Stored data may name an entry from a ruleset that is no longer active,
    // or hold none at all; that character must still render rather than
    // throw.
    const stats = statsFor({ callings: ['no-such-calling'] });
    expect(stats.values.grit).toBe(0);
    expect(stats.values.fate).toBe(0);

    const unset = statsFor({});
    expect(unset.values.grit).toBe(0);
  });
});

describe('calculateDerivedStats — step 1b: character attribute overrides', () => {
  it('overrides the base value absolutely, not as a delta', () => {
    // 5, not 2 + 5. "This character has grit 5" is an assignment; deltas are
    // what knacks and rigs are for.
    expect(
      statsFor(undefined, { attributes: { grit: num(5) } }).values.grit
    ).toBe(5);
  });

  it('still clamps an override to the cap', () => {
    expect(
      statsFor(undefined, { attributes: { spark: num(9) } }).values.spark
    ).toBe(6);
  });
});

describe('calculateDerivedStats — step 2: preBonus deltas and category scores', () => {
  it('applies a knack’s resource delta', () => {
    expect(
      statsFor({ callings: ['tinker'], knacks: ['hammer_hand'] }).values.grit
    ).toBe(3);
  });

  it('scores one point per held entry in its category', () => {
    const stats = statsFor({
      callings: ['tinker'],
      knacks: ['quick_read', 'steady_hand'],
    });
    expect(knackScore(stats, 'wit')).toBe(2);
    expect(knackScore(stats, 'forge')).toBe(0);
  });

  it('ignores entry ids the collection does not define', () => {
    expect(
      statsFor({ callings: ['tinker'], knacks: ['not-a-knack'] }).values.grit
    ).toBe(2);
  });

  it('does NOT let a preBonus entry raise a cap outside its deltaRoles', () => {
    // `overclock` declares +2 sparkCap. `knacks` only applies `'resource'`
    // deltas, so the ceiling must not move — Afterworlds' `smarts_20` is the
    // real case, and this proves the rule is general rather than a carve-out.
    const stats = statsFor(
      { callings: ['tinker'], knacks: ['overclock'] },
      { attributes: { spark: num(9) } }
    );
    expect(stats.values.sparkCap).toBe(6);
    expect(stats.values.spark).toBe(6);
  });
});

describe('calculateDerivedStats — step 3: category-bonus grants', () => {
  it('grants nothing below the threshold', () => {
    const stats = statsFor({ callings: ['tinker'], knacks: ['hammer_hand'] });
    expect(knackScore(stats, 'forge')).toBe(1);
    expect(stats.values.grit).toBe(3); // base 2 + knack 1, no bonus
  });

  it('grants once the threshold is met', () => {
    const stats = statsFor({
      callings: ['tinker'],
      knacks: ['hammer_hand', 'kin_secret'],
    });
    expect(knackScore(stats, 'forge')).toBe(2);
    expect(stats.values.grit).toBe(4); // base 2 + knack 1 + bonus 1
  });

  it('applies each category’s own threshold independently', () => {
    const stats = statsFor({
      callings: ['tinker'],
      knacks: ['quick_read', 'steady_hand', 'overclock'],
    });
    expect(knackScore(stats, 'wit')).toBe(3);
    expect(stats.values.spark).toBe(5); // base 2 + knack 1 + bonus 2
  });

  it('evaluates a second, independent scored collection', () => {
    // `bonds` scores and grants entirely separately from `knacks`.
    const stats = statsFor({ callings: ['tinker'], bonds: ['oath_kept'] });
    expect(getCategoryScore(stats.categoryScores, 'bonds', 'duty')).toBe(1);
    expect(stats.values.fate).toBe(2); // base 1 + bonds bonus 1

    const withDelta = statsFor({
      callings: ['tinker'],
      bonds: ['old_friend'],
    });
    expect(withDelta.values.grit).toBe(3); // base 2 + old_friend's own +1
  });
});

describe('calculateDerivedStats — scoreExclusions', () => {
  const kinKnacks = {
    callings: ['revenant'],
    knacks: ['hammer_hand', 'kin_secret'],
  };

  it('suppresses category score from group-restricted entries for the named entry', () => {
    // `kin_secret` is restricted to exactly the membership of group `kin`,
    // and `revenant` is named by the exclusion — so it scores 1, not 2, and
    // the forge bonus never fires.
    const stats = statsFor(kinKnacks);
    expect(knackScore(stats, 'forge')).toBe(1);
    expect(stats.values.grit).toBe(3); // base 2 + knack 1, no bonus
  });

  it('still applies that entry’s attribute delta', () => {
    // The exclusion is about *score*, not about the entry doing nothing.
    const stats = statsFor(kinKnacks);
    expect(stats.values.fate).toBe(2); // base 1 + kin_secret 1
  });

  it('leaves other entries in the same group alone', () => {
    const stats = statsFor({
      callings: ['tinker'],
      knacks: ['hammer_hand', 'kin_secret'],
    });
    expect(knackScore(stats, 'forge')).toBe(2);
    expect(stats.values.grit).toBe(4);
  });
});

describe('calculateDerivedStats — step 4: postBonus (authored) collections', () => {
  const withRigs = (rigs: AuthoredFacetEntry[]) =>
    statsFor({ callings: ['tinker'], rigs });

  it('applies resource deltas', () => {
    expect(
      withRigs([
        {
          name: 'Brace',
          description: '',
          modifier: { attributeDeltas: { grit: 2 } },
        },
      ]).values.grit
    ).toBe(4);
  });

  it('may raise a cap, unlike a preBonus entry', () => {
    const stats = withRigs([
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
      withRigs([
        {
          name: 'Rig',
          description: '',
          modifier: { attributeDeltas: { spark: 5 } },
        },
      ]).values.spark
    ).toBe(6);
  });

  it('sums multiple entries', () => {
    expect(
      withRigs([
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
    // Authored entries land at step 4, after grants are computed at step 3.
    const stats = withRigs([
      {
        name: 'Charm',
        description: '',
        modifier: { categoryDeltas: { knacks: { forge: 5 } } },
      },
    ]);
    expect(knackScore(stats, 'forge')).toBe(5);
    expect(stats.values.grit).toBe(2); // no bonus despite the score
  });

  it('treats a missing or empty authored list as none', () => {
    expect(statsFor({ callings: ['tinker'] }).values.grit).toBe(2);
    expect(statsFor({ callings: ['tinker'], rigs: [] }).values.grit).toBe(2);
  });
});

describe('calculateDerivedStats — step 5: clamping', () => {
  it('clamps a resource that declares a cap attribute', () => {
    expect(
      statsFor(undefined, { attributes: { grit: num(50) } }).values.grit
    ).toBe(6);
  });

  it('leaves a resource with no cap attribute unbounded', () => {
    expect(
      statsFor(undefined, { attributes: { fate: num(99) } }).values.fate
    ).toBe(99);
  });
});

describe('calculateDerivedStats — isolation', () => {
  it('does not leak one character’s cap change onto another', () => {
    // The pre-generalization implementation mutated the shared archetype
    // stat objects; issue #6 fixed it and this is the guard.
    const plain = () => statsFor().values.spark;
    const before = plain();

    statsFor({
      callings: ['tinker'],
      rigs: [
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
