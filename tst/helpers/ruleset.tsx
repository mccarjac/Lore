import React from 'react';
import { render, type RenderResult } from '@testing-library/react-native';
import {
  RulesetProvider,
  type RulesetDefinition,
  type RulesetAssets,
} from '@/ruleset';
import { afterworldsRuleset } from '@/rulesets/afterworlds';
import { afterworldsAssets } from '@/rulesets/afterworlds/assets';

export const renderWithRuleset = (
  ui: React.ReactElement,
  overrides: {
    ruleset?: RulesetDefinition;
    assets?: RulesetAssets;
  } = {}
): RenderResult => {
  const { ruleset = afterworldsRuleset, assets = afterworldsAssets } =
    overrides;
  return render(ui, {
    wrapper: ({ children }) => (
      <RulesetProvider ruleset={ruleset} assets={assets}>
        {children}
      </RulesetProvider>
    ),
  });
};
