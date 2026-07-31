/**
 * The character-attribute layer (#22).
 *
 * The parity fixture cannot cover any of this: Afterworlds declares no
 * character attributes, so every one of its cases exercises the layer as a
 * no-op. These tests are the only proof that step 1b of the pipeline behaves,
 * and that adding it did not disturb the steps around it. They run on the
 * mechanics fixture rather than a flavor, so the layer is proved for any
 * ruleset — `mechanicsRuleset` carries the caps, category bonuses and
 * scoreExclusions the pipeline needs.
 */
import { calculateDerivedStats } from '@/ruleset/derived';
import { validateCharacterAttributes } from '@/ruleset/validate';
import { getCategoryScore, type FacetCollection } from '@/ruleset/facets';
import { flag, num, text, type AttributeBag } from '@/ruleset/attributes';
import type { RulesetDefinition } from '@/ruleset/types';
import type { GameCharacter, FacetValue } from '@/models/types';
import { mechanicsRuleset } from '../fixtures/mechanicsRuleset';

const TS = '2026-01-01T00:00:00.000Z';

/** The mechanics fixture plus a few GM-defined per-character attributes. */
const rulesetWithCharacterAttributes = (): RulesetDefinition => ({
  ...mechanicsRuleset,
  attributes: [
    ...mechanicsRuleset.attributes,
    { id: 'homeworld', label: 'Homeworld', type: 'text' },
    { id: 'corruption', label: 'Corruption', type: 'number', min: 0, max: 10 },
    { id: 'sworn', label: 'Sworn', type: 'flag' },
  ],
});

const character = (
  attributes?: AttributeBag,
  facets: Record<string, FacetValue[]> = { callings: ['tinker'] }
): GameCharacter =>
  ({
    id: 'c1',
    name: 'Test',
    facets,
    factions: [],
    relationships: [],
    attributes,
    createdAt: TS,
    updatedAt: TS,
  }) as GameCharacter;

describe('character attributes in derived stats', () => {
  const ruleset = rulesetWithCharacterAttributes();

  it('is a no-op when the character declares none', () => {
    const withNone = calculateDerivedStats(character(), ruleset);
    const withEmpty = calculateDerivedStats(character({}), ruleset);

    // Tinker: base grit 2, base spark 2.
    expect(withNone.values.grit).toBe(2);
    expect(withEmpty.values).toEqual(withNone.values);
  });

  it('overrides an archetype base value absolutely, not as a delta', () => {
    const stats = calculateDerivedStats(character({ grit: num(4) }), ruleset);

    // 4, not 2 + 4 — character attributes are assignments. Deltas are what
    // knacks and rigs are for.
    expect(stats.values.grit).toBe(4);
  });

  it('surfaces freeform attributes without touching numeric values', () => {
    const stats = calculateDerivedStats(
      character({ homeworld: text('Ashvale'), sworn: flag(true) }),
      ruleset
    );

    expect(stats.attributes.homeworld).toEqual(text('Ashvale'));
    expect(stats.attributes.sworn).toEqual(flag(true));
    expect(stats.values.grit).toBe(2);
    expect(stats.values.homeworld).toBeUndefined();
  });

  it('exposes a GM-defined numeric attribute in both values and attributes', () => {
    const stats = calculateDerivedStats(
      character({ corruption: num(3) }),
      ruleset
    );

    expect(stats.values.corruption).toBe(3);
    expect(stats.attributes.corruption).toEqual(num(3));
  });

  it('resolves archetype base underneath the character override', () => {
    const stats = calculateDerivedStats(character({ grit: num(4) }), ruleset);

    // Untouched archetype attributes still come through.
    expect(stats.attributes.spark).toEqual(num(2));
    expect(stats.attributes.attuned).toEqual(flag(false));
  });

  it('still clamps an overridden resource to its cap', () => {
    // Tinker's gritCap is 6; an override above it must not escape the clamp.
    const stats = calculateDerivedStats(character({ grit: num(99) }), ruleset);

    expect(stats.values.grit).toBe(6);
  });

  it('lets a character raise its own cap', () => {
    const stats = calculateDerivedStats(
      character({ grit: num(99), gritCap: num(8) }),
      ruleset
    );

    expect(stats.values.grit).toBe(8);
  });

  it('applies knack deltas on top of a character override', () => {
    // Overridden base 3, plus a +1 grit knack, still under the cap of 6.
    const withKnack = character(
      { grit: num(3) },
      {
        callings: ['tinker'],
        knacks: ['hammer_hand'],
      }
    );

    expect(calculateDerivedStats(withKnack, ruleset).values.grit).toBe(4);
  });

  it('leaves an unknown archetype rendering rather than throwing', () => {
    const orphan = character(
      { corruption: num(1) },
      { callings: ['NotARealCalling'] }
    );

    const stats = calculateDerivedStats(orphan, ruleset);

    expect(stats.values.corruption).toBe(1);
    expect(stats.values.grit).toBe(0);
  });
});

describe('validateCharacterAttributes', () => {
  const ruleset = rulesetWithCharacterAttributes();

  it('accepts declared attributes of the right type', () => {
    const result = validateCharacterAttributes(
      { homeworld: text('Ashvale'), corruption: num(2) },
      ruleset
    );
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('accepts a character with no attributes at all', () => {
    expect(validateCharacterAttributes(undefined, ruleset).valid).toBe(true);
  });

  it('rejects an attribute id the ruleset does not declare', () => {
    const result = validateCharacterAttributes({ nope: num(1) }, ruleset);

    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain("Unknown attribute id 'nope'");
  });

  it('rejects a value contradicting its declared type', () => {
    const result = validateCharacterAttributes(
      { corruption: text('lots') },
      ruleset
    );

    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain(
      "declared as 'number' but holds 'text'"
    );
  });

  it('enforces declared numeric bounds', () => {
    const result = validateCharacterAttributes(
      { corruption: num(99) },
      ruleset
    );

    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain('above its maximum of 10');
  });
});

describe('derived stats — modifier edge cases', () => {
  const ruleset = rulesetWithCharacterAttributes();

  const withRig = (attributeDeltas: Record<string, number>): GameCharacter =>
    character(undefined, {
      callings: ['tinker'],
      rigs: [{ name: 'Rig', description: '', modifier: { attributeDeltas } }],
    });

  it('ignores a zero delta', () => {
    const stats = calculateDerivedStats(withRig({ grit: 0 }), ruleset);
    expect(stats.values.grit).toBe(2);
  });

  it('ignores a delta naming an attribute the ruleset does not declare', () => {
    const stats = calculateDerivedStats(withRig({ nonexistent: 5 }), ruleset);
    expect(stats.values.nonexistent).toBeUndefined();
    expect(stats.values.grit).toBe(2);
  });

  it('leaves a resource unclamped when its cap attribute has no value', () => {
    // A resource may declare a capAttributeId whose value no archetype
    // supplies; that should read as "unbounded", not "clamped to zero".
    const uncapped: RulesetDefinition = {
      ...ruleset,
      facets: ruleset.facets.map(collection =>
        collection.id === 'callings'
          ? {
              ...collection,
              entries: collection.entries.map(entry =>
                entry.id === 'tinker'
                  ? {
                      ...entry,
                      attributes: Object.fromEntries(
                        Object.entries(entry.attributes ?? {}).filter(
                          ([id]) => id !== 'gritCap'
                        )
                      ),
                    }
                  : entry
              ),
            }
          : collection
      ),
      attributes: ruleset.attributes.filter(a => a.id !== 'gritCap'),
    };

    const stats = calculateDerivedStats(withRig({ grit: 50 }), uncapped);

    expect(stats.values.grit).toBe(52);
  });

  it('applies no score exclusions when the collection declares none', () => {
    const without: RulesetDefinition = {
      ...ruleset,
      facets: ruleset.facets.map(collection =>
        collection.id === 'knacks'
          ? ({ ...collection, scoreExclusions: undefined } as FacetCollection)
          : collection
      ),
    };
    const revenant = character(undefined, {
      callings: ['revenant'],
      knacks: ['kin_secret'],
    });

    // With the carve-out gone, the group-restricted knack now scores. Under
    // the rule it is skipped outright, so the category has no entry at all.
    expect(
      getCategoryScore(
        calculateDerivedStats(revenant, ruleset).categoryScores,
        'knacks',
        'forge'
      )
    ).toBe(0);
    expect(
      getCategoryScore(
        calculateDerivedStats(revenant, without).categoryScores,
        'knacks',
        'forge'
      )
    ).toBe(1);
  });
});
