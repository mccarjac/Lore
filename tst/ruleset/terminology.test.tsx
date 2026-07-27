import { renderHook } from '@testing-library/react-native';
import React from 'react';
import {
  getLabel,
  useLabels,
  DEFAULT_TERMINOLOGY,
} from '@/ruleset/terminology';
import { RulesetProvider } from '@/ruleset/context';
import { activeRuleset } from '@/activeRuleset';
import type { RulesetDefinition } from '@/ruleset/types';
import { genericRuleset } from '../fixtures/genericRuleset';

// The fixture overrides most nouns; stripping them is how the fallback path
// gets exercised. Neither variant is a flavor — that a *particular* ruleset's
// overrides read the way its players expect is asserted with that ruleset,
// in `tst/rulesets/`.
const rulesetWithoutOverrides: RulesetDefinition = {
  ...genericRuleset,
  terminology: {},
};

describe('getLabel', () => {
  it('falls back to the neutral default when a ruleset has no override', () => {
    expect(getLabel(rulesetWithoutOverrides, 'trait.plural')).toBe('Traits');
  });

  it('uses the ruleset override when present', () => {
    expect(getLabel(genericRuleset, 'trait.plural')).toBe('Talents');
    expect(getLabel(genericRuleset, 'archetype.singular')).toBe('Lineage');
    expect(getLabel(genericRuleset, 'modification.plural')).toBe('Augments');
  });

  it('applies lower casing', () => {
    expect(getLabel(genericRuleset, 'trait.plural', 'lower')).toBe('talents');
  });

  it('applies title casing', () => {
    expect(
      getLabel(rulesetWithoutOverrides, 'traitCategory.plural', 'title')
    ).toBe('Categories');
  });

  it('covers every declared term key with a neutral default', () => {
    Object.values(DEFAULT_TERMINOLOGY).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });
});

describe('useLabels', () => {
  it('reads from the nearest RulesetProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RulesetProvider ruleset={genericRuleset}>{children}</RulesetProvider>
    );
    const { result } = renderHook(() => useLabels(), { wrapper });
    expect(result.current('trait.plural')).toBe('Talents');
  });

  it('falls back to the active ruleset outside a provider', () => {
    // Derived from the seam rather than hardcoded: the point is *which
    // ruleset* answers outside a provider, not what this build happens to
    // call its traits.
    const { result } = renderHook(() => useLabels());
    expect(result.current('trait.plural')).toBe(
      getLabel(activeRuleset, 'trait.plural')
    );
  });
});
