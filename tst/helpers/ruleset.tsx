import React from 'react';
import { render, type RenderResult } from '@testing-library/react-native';
import {
  RulesetProvider,
  type RulesetDefinition,
  type RulesetAssets,
} from '@/ruleset';
import { genericRuleset } from '../fixtures/genericRuleset';

/**
 * Renders inside a `RulesetProvider`.
 *
 * The default is the **neutral fixture**, not whatever the build happens to
 * ship — "no argument" should mean "any ruleset", so a test passing here is
 * not quietly asserting on the engine's default. Tests genuinely about a
 * specific ruleset pass one explicitly.
 */
export const renderWithRuleset = (
  ui: React.ReactElement,
  overrides: {
    ruleset?: RulesetDefinition;
    assets?: RulesetAssets;
  } = {}
): RenderResult => {
  const { ruleset = genericRuleset, assets = {} } = overrides;
  return render(ui, {
    wrapper: ({ children }) => (
      <RulesetProvider ruleset={ruleset} assets={assets}>
        {children}
      </RulesetProvider>
    ),
  });
};
