import React, { createContext, useContext, useMemo } from 'react';
import { getActiveRuleset, getActiveAssets } from '@/activeRuleset';
import { type RulesetAssets } from './assets';
import { validateRuleset } from './validate';
import type { RulesetDefinition } from './types';

export interface RulesetContextValue {
  ruleset: RulesetDefinition;
  assets: RulesetAssets;
}

/**
 * The context defaults to `undefined` and `useRuleset` substitutes the
 * registry, rather than seeding the default value here.
 *
 * That indirection is load-bearing now that the ruleset arrives through
 * `configureLore()`: a default computed at module load would capture the
 * example ruleset, since a consumer's `configureLore` call necessarily runs
 * after this module is imported. Reading the registry inside the hook makes
 * the lookup happen at render time, when the configuration exists.
 *
 * It still never throws outside a provider — many screen tests render bare,
 * and a throwing hook would mean wrapping all of them.
 */
const RulesetContext = createContext<RulesetContextValue | undefined>(
  undefined
);

export interface RulesetProviderProps {
  ruleset?: RulesetDefinition;
  assets?: RulesetAssets;
  children: React.ReactNode;
}

export const RulesetProvider: React.FC<RulesetProviderProps> = ({
  // Default parameters evaluate per render, so these see the configuration
  // even when it landed after this module was imported.
  ruleset = getActiveRuleset(),
  assets = getActiveAssets(),
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
  const context = useContext(RulesetContext);
  if (context) return context;
  // Outside a provider: fall back to whatever the app configured, resolved
  // now rather than at module load. See the note on RulesetContext.
  return { ruleset: getActiveRuleset(), assets: getActiveAssets() };
}
