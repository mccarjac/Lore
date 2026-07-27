import { afterworldsRuleset } from '@/ruleset/defaultRuleset';
import { afterworldsAssets, type RulesetAssets } from '@/ruleset/assets';
import type { RulesetDefinition } from '@/ruleset/types';

/**
 * The one file that says which ruleset this build runs on — **fork-owned**
 * (see AGENTS.md → "Engine vs fork"). Changing flavors is an edit here plus
 * `src/branding.ts` and `assets/`.
 *
 * **This is deliberately a module, not a `RulesetProvider` prop.** Non-component
 * code needs the active ruleset too: `characterStorage.migrateRulesetFields()`
 * calls `normalizeCharactersRulesetFields(characters)` with no ruleset
 * argument, and that default is what maps a legacy `caps.health` onto
 * `attributeDeltas.healthCap`. A storage module can never read a React
 * context, so a provider-only seam would silently degrade that migration for
 * any ruleset but the engine's built-in one.
 *
 * Import `@/ruleset/*` submodules directly here, never the `@/ruleset` barrel —
 * the barrel re-exports `context.tsx`, which imports this file, and that is a
 * cycle.
 */
export const activeRuleset: RulesetDefinition = afterworldsRuleset;

export const activeAssets: RulesetAssets = afterworldsAssets;
