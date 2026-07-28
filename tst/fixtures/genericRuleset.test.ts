import { validateRuleset } from '@/ruleset';
import type { RulesetDefinition } from '@/ruleset/types';
import { exampleRuleset } from '@/ruleset/exampleRuleset';
import { genericRuleset } from './genericRuleset';
import { mechanicsRuleset } from './mechanicsRuleset';

const identifiersOf = (ruleset: RulesetDefinition): string[] => [
  ...ruleset.archetypes.map(a => a.id),
  ...ruleset.traits.map(t => t.id),
  ...ruleset.qualities.map(q => q.id),
  ...ruleset.traitCategories.map(c => c.id),
  ...ruleset.attributes.map(a => a.id),
];

describe.each([
  ['generic', genericRuleset],
  ['mechanics', mechanicsRuleset],
])('the %s fixture ruleset', (_name, fixture) => {
  it('is valid, so a failing test means the code, not the fixture', () => {
    expect(validateRuleset(fixture)).toEqual({ valid: true, issues: [] });
  });
});

/**
 * Every fixture must be disjoint from every other ruleset in the tree. A
 * shared id is how a test passes by coincidence — asserting on a value the
 * code got from somewhere other than the ruleset under test.
 */
describe('the fixture rulesets share no ids with anything else', () => {
  const rulesets: [string, RulesetDefinition][] = [
    ['example', exampleRuleset],
    ['generic', genericRuleset],
    ['mechanics', mechanicsRuleset],
  ];

  const pairs = rulesets.flatMap(([leftName, left], index) =>
    rulesets
      .slice(index + 1)
      .map(([rightName, right]) => ({ leftName, left, rightName, right }))
  );

  it.each(pairs)('$leftName vs $rightName', ({ left, right }) => {
    const rightIds = new Set(identifiersOf(right));
    const overlap = identifiersOf(left).filter(id => rightIds.has(id));
    expect(overlap).toEqual([]);
  });
});
