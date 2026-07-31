import { exampleRuleset } from '@/ruleset/exampleRuleset';
import { validateRuleset } from '@/ruleset/validate';
import { DEFAULT_TERMINOLOGY, getLabel } from '@/ruleset/terminology';
import { calculateDerivedStats } from '@/ruleset/derived';
import { getCategoryScore } from '@/ruleset/facets';
import { makeCharacter } from '../helpers/factories';

describe('the example ruleset', () => {
  it('is valid', () => {
    // RulesetProvider throws on an invalid ruleset under __DEV__, so an
    // invalid example would not merely fail a test — it would fail to boot.
    expect(validateRuleset(exampleRuleset)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('round-trips through JSON', () => {
    // The schema's serializability rule is what keeps the backlogged in-app
    // ruleset editor (#18) possible. The shipped example must obey it.
    expect(JSON.parse(JSON.stringify(exampleRuleset))).toEqual(exampleRuleset);
  });

  it('overrides no terminology, so the app shows the engine’s own core nouns', () => {
    expect(exampleRuleset.terminology).toEqual({});
    expect(getLabel(exampleRuleset, 'character.plural')).toBe(
      DEFAULT_TERMINOLOGY['character.plural']
    );
    expect(getLabel(exampleRuleset, 'quest.singular')).toBe(
      DEFAULT_TERMINOLOGY['quest.singular']
    );
  });

  it('names every facet collection on the collection itself, not through terminology', () => {
    // Since #51 there is no `archetype.*`/`trait.*` TermKey — a collection's
    // noun is its own `singular`/`plural`.
    const archetypes = exampleRuleset.facets.find(c => c.id === 'archetypes');
    const traits = exampleRuleset.facets.find(c => c.id === 'traits');
    expect(archetypes?.singular).toBe('Archetype');
    expect(archetypes?.plural).toBe('Archetypes');
    expect(traits?.singular).toBe('Trait');
    expect(traits?.plural).toBe('Traits');
  });

  it('declares five facet collections — one more than the engine used to hardcode', () => {
    expect(exampleRuleset.facets.map(c => c.id).sort()).toEqual([
      'archetypes',
      'modifications',
      'qualities',
      'recipes',
      'traits',
    ]);
  });

  it('declares no map, because images belong to the ruleset that uses them', () => {
    expect(exampleRuleset.map).toBeUndefined();
    expect(exampleRuleset.features.map).toBe(false);
  });

  it('enables the core features, leaving reporting screens opt-in', () => {
    const {
      map,
      influenceReport,
      relationshipGraph,
      characterStats,
      factionStats,
      ...rest
    } = exampleRuleset.features;
    expect(map).toBe(false);
    // Reporting/statistics screens are opt-in, so they default off even
    // though the engine ships fully able to reach them.
    expect(influenceReport).toBe(false);
    expect(relationshipGraph).toBe(false);
    expect(characterStats).toBe(false);
    expect(factionStats).toBe(false);
    expect(Object.values(rest).every(Boolean)).toBe(true);
  });

  it('actually computes — it is a working ruleset, not a stub', () => {
    const stats = calculateDerivedStats(
      makeCharacter({ facets: { archetypes: ['warden'], traits: ['tough'] } }),
      exampleRuleset
    );
    expect(stats.values.stamina).toBe(5); // warden base 4 + tough 1
    expect(getCategoryScore(stats.categoryScores, 'traits', 'body')).toBe(1);
  });
});
