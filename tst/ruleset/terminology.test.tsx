import { renderHook } from '@testing-library/react-native';
import React from 'react';
import {
  getLabel,
  useLabels,
  DEFAULT_TERMINOLOGY,
} from '@/ruleset/terminology';
import { RulesetProvider } from '@/ruleset/context';
import { getActiveRuleset } from '@/activeRuleset';
import type { RulesetDefinition } from '@/ruleset/types';
import { genericRuleset } from '../fixtures/genericRuleset';

// The fixture overrides `map.label`; stripping it is how the fallback path
// gets exercised. Neither variant is a flavor — that a *particular*
// ruleset's overrides read the way its players expect is asserted with that
// ruleset, in `tst/rulesets/`.
const rulesetWithoutOverrides: RulesetDefinition = {
  ...genericRuleset,
  terminology: {},
};

describe('getLabel', () => {
  it('falls back to the neutral default when a ruleset has no override', () => {
    expect(getLabel(rulesetWithoutOverrides, 'character.plural')).toBe(
      'Characters'
    );
  });

  it('uses the ruleset override when present', () => {
    expect(getLabel(genericRuleset, 'map.label')).toBe('Realm Map');
  });

  it('applies lower casing', () => {
    expect(getLabel(genericRuleset, 'character.plural', 'lower')).toBe(
      'characters'
    );
  });

  it('applies title casing', () => {
    expect(getLabel(rulesetWithoutOverrides, 'quest.plural', 'title')).toBe(
      'Quests'
    );
  });

  it('covers every declared term key with a neutral default', () => {
    Object.values(DEFAULT_TERMINOLOGY).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });

  it('only covers the engine’s own core nouns — a facet noun is not a TermKey', () => {
    // Since #51 the archetype/trait/quality/modification/recipe nouns live on
    // each `FacetCollection.singular`/`.plural`, not in `TerminologyMap`.
    expect(Object.keys(DEFAULT_TERMINOLOGY)).toEqual([
      'character.singular',
      'character.plural',
      'faction.singular',
      'faction.plural',
      'quest.singular',
      'quest.plural',
      'resource.singular',
      'resource.plural',
      'questSponsor.singular',
      'questSponsor.plural',
      'map.label',
    ]);
  });
});

describe('a facet collection names itself directly', () => {
  it('uses its own singular/plural rather than terminology', () => {
    const talents = genericRuleset.facets.find(c => c.id === 'talents');
    const lineages = genericRuleset.facets.find(c => c.id === 'lineages');
    expect(talents?.singular).toBe('Talent');
    expect(talents?.plural).toBe('Talents');
    expect(lineages?.singular).toBe('Lineage');
    expect(lineages?.plural).toBe('Lineages');
  });

  it('names a scored collection’s categories through categorySingular/Plural', () => {
    const talents = genericRuleset.facets.find(c => c.id === 'talents');
    expect(talents?.categorySingular).toBe('Discipline');
    expect(talents?.categoryPlural).toBe('Disciplines');
  });
});

describe('useLabels', () => {
  it('reads from the nearest RulesetProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RulesetProvider ruleset={genericRuleset}>{children}</RulesetProvider>
    );
    const { result } = renderHook(() => useLabels(), { wrapper });
    expect(result.current('map.label')).toBe('Realm Map');
  });

  it('falls back to the active ruleset outside a provider', () => {
    // Derived from the seam rather than hardcoded: the point is *which
    // ruleset* answers outside a provider, not what this build happens to
    // call its characters.
    const { result } = renderHook(() => useLabels());
    expect(result.current('character.plural')).toBe(
      getLabel(getActiveRuleset(), 'character.plural')
    );
  });
});
