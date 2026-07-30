import { useRuleset } from './context';
import type { FeatureFlags, RulesetDefinition } from './types';

export type FeatureKey = keyof FeatureFlags;

/**
 * The canonical flag list. Declared as data rather than derived from a type so
 * the validator can iterate it — a `keyof` has no runtime representation, and a
 * ruleset that simply omits a flag would otherwise gate a whole subsystem off
 * by accident.
 */
export const FEATURE_KEYS: readonly FeatureKey[] = [
  'quests',
  'recipes',
  'discord',
  'map',
  'modifications',
  'influenceReport',
  'relationshipGraph',
  'characterStats',
  'factionStats',
];

/** Non-hook form, mirroring `getLabel` — for navigators and pure utils. */
export function isFeatureEnabled(
  ruleset: RulesetDefinition,
  key: FeatureKey
): boolean {
  return ruleset.features[key];
}

/** Hook form, mirroring `useLabels`. */
export function useFeature(key: FeatureKey): boolean {
  const { ruleset } = useRuleset();
  return isFeatureEnabled(ruleset, key);
}
