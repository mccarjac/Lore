/**
 * The character-attribute layer (#22).
 *
 * The parity fixture cannot cover any of this: Afterworlds declares no
 * character attributes, so every one of its 26 cases exercises the layer as a
 * no-op. These tests are the only proof that step 1b of the pipeline behaves,
 * and that adding it did not disturb the steps around it.
 */
import { calculateDerivedStats } from '@/ruleset/derived';
import { afterworldsRuleset } from '@/ruleset/defaultRuleset';
import { validateCharacterAttributes } from '@/ruleset/validate';
import { flag, num, text, type AttributeBag } from '@/ruleset/attributes';
import type { RulesetDefinition } from '@/ruleset/types';
import type { GameCharacter } from '@/models/types';

const TS = '2026-01-01T00:00:00.000Z';

/** Afterworlds plus a few GM-defined per-character attributes. */
const rulesetWithCharacterAttributes = (): RulesetDefinition => ({
  ...afterworldsRuleset,
  attributes: [
    ...afterworldsRuleset.attributes,
    { id: 'homeworld', label: 'Homeworld', type: 'text' },
    { id: 'corruption', label: 'Corruption', type: 'number', min: 0, max: 10 },
    { id: 'sworn', label: 'Sworn', type: 'flag' },
  ],
});

const character = (attributes?: AttributeBag): GameCharacter =>
  ({
    id: 'c1',
    name: 'Test',
    archetypeId: 'Human',
    traitIds: [],
    qualityIds: [],
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

    // Human: base health 2, base limit 2.
    expect(withNone.values.health).toBe(2);
    expect(withEmpty.values).toEqual(withNone.values);
  });

  it('overrides an archetype base value absolutely, not as a delta', () => {
    const stats = calculateDerivedStats(character({ health: num(4) }), ruleset);

    // 4, not 2 + 4 — character attributes are assignments. Deltas are what
    // traits and modifications are for.
    expect(stats.values.health).toBe(4);
  });

  it('surfaces freeform attributes without touching numeric values', () => {
    const stats = calculateDerivedStats(
      character({ homeworld: text('Junktown'), sworn: flag(true) }),
      ruleset
    );

    expect(stats.attributes.homeworld).toEqual(text('Junktown'));
    expect(stats.attributes.sworn).toEqual(flag(true));
    expect(stats.values.health).toBe(2);
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
    const stats = calculateDerivedStats(character({ health: num(4) }), ruleset);

    // Untouched archetype attributes still come through.
    expect(stats.attributes.limit).toEqual(num(2));
    expect(stats.attributes.cyberware).toEqual(flag(true));
  });

  it('still clamps an overridden resource to its cap', () => {
    // Human healthCap is 5; an override above it must not escape the clamp.
    const stats = calculateDerivedStats(
      character({ health: num(99) }),
      ruleset
    );

    expect(stats.values.health).toBe(5);
  });

  it('lets a character raise its own cap', () => {
    const stats = calculateDerivedStats(
      character({ health: num(99), healthCap: num(8) }),
      ruleset
    );

    expect(stats.values.health).toBe(8);
  });

  it('applies trait deltas on top of a character override', () => {
    // Overridden base 3, plus a +1 health trait, still under the cap of 5.
    const withTrait = {
      ...character({ health: num(3) }),
      traitIds: ['defense_23'],
    } as GameCharacter;

    expect(calculateDerivedStats(withTrait, ruleset).values.health).toBe(4);
  });

  it('leaves an unknown archetype rendering rather than throwing', () => {
    const orphan = {
      ...character({ corruption: num(1) }),
      archetypeId: 'NotARealArchetype',
    } as GameCharacter;

    const stats = calculateDerivedStats(orphan, ruleset);

    expect(stats.values.corruption).toBe(1);
    expect(stats.values.health).toBe(0);
  });
});

describe('validateCharacterAttributes', () => {
  const ruleset = rulesetWithCharacterAttributes();

  it('accepts declared attributes of the right type', () => {
    const result = validateCharacterAttributes(
      { homeworld: text('Junktown'), corruption: num(2) },
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
