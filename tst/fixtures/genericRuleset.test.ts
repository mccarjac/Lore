import { validateRuleset } from '@/ruleset';
import { afterworldsRuleset } from '@/rulesets/afterworlds';
import { genericRuleset } from './genericRuleset';

describe('the generic fixture ruleset', () => {
  it('is valid, so a failing screen test means the screen, not the fixture', () => {
    expect(validateRuleset(genericRuleset)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('shares no ids with Afterworlds, so nothing can pass by coincidence', () => {
    const afterworldsIds = new Set([
      ...afterworldsRuleset.archetypes.map(a => a.id),
      ...afterworldsRuleset.traits.map(t => t.id),
      ...afterworldsRuleset.qualities.map(q => q.id),
      ...afterworldsRuleset.traitCategories.map(c => c.id),
      ...afterworldsRuleset.attributes.map(a => a.id),
    ]);

    const fixtureIds = [
      ...genericRuleset.archetypes.map(a => a.id),
      ...genericRuleset.traits.map(t => t.id),
      ...genericRuleset.qualities.map(q => q.id),
      ...genericRuleset.traitCategories.map(c => c.id),
      ...genericRuleset.attributes.map(a => a.id),
    ];

    fixtureIds.forEach(id => expect(afterworldsIds.has(id)).toBe(false));
  });
});
