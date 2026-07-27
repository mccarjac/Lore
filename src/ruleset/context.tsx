import React, { createContext, useContext, useMemo } from 'react';
import { activeRuleset, activeAssets } from '@/activeRuleset';
import { type RulesetAssets } from './assets';
import { validateRuleset } from './validate';
import type { RulesetDefinition } from './types';

export interface RulesetContextValue {
  ruleset: RulesetDefinition;
  assets: RulesetAssets;
}

const DEFAULT_CONTEXT_VALUE: RulesetContextValue = {
  ruleset: activeRuleset,
  assets: activeAssets,
};

/**
 * Defaults outside a provider (rather than undefined + a throwing hook) so
 * every screen that renders bare in tests keeps working unchanged.
 */
const RulesetContext = createContext<RulesetContextValue>(
  DEFAULT_CONTEXT_VALUE
);

export interface RulesetProviderProps {
  ruleset?: RulesetDefinition;
  assets?: RulesetAssets;
  children: React.ReactNode;
}

export const RulesetProvider: React.FC<RulesetProviderProps> = ({
  ruleset = activeRuleset,
  assets = activeAssets,
  children,
}) => {
  const value = useMemo(() => {
    const result = validateRuleset(ruleset);
    if (!result.valid) {
      const summary = result.issues
        .map(issue => `  ${issue.path}: ${issue.message}`)
        .join('\n');
      if (__DEV__) {
        throw new Error(`Invalid ruleset '${ruleset.id}':\n${summary}`);
      }
      console.error(`Invalid ruleset '${ruleset.id}':\n${summary}`);
    }
    return { ruleset, assets };
  }, [ruleset, assets]);

  return (
    <RulesetContext.Provider value={value}>{children}</RulesetContext.Provider>
  );
};

export function useRuleset(): RulesetContextValue {
  return useContext(RulesetContext);
}
