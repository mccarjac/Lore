import { exampleRuleset } from '@/ruleset/exampleRuleset';
import type { RulesetAssets } from '@/ruleset/assets';
import type { RulesetDefinition } from '@/ruleset/types';

/**
 * Which ruleset this build runs on — **consumer-owned**.
 *
 * This used to export a constant, which worked while the engine and the flavor
 * lived in one tree. As a package it cannot: a library cannot import its
 * consumer's file. So the seam inverted — the consumer *pushes* its ruleset in
 * through `configureLore()`, and the engine reads it back through
 * `getActiveRuleset()`.
 *
 * **It is deliberately a module-level registry and not a `RulesetProvider`
 * prop.** Non-component code needs the active ruleset too:
 * `characterStorage.migrateRulesetFields()` calls
 * `normalizeCharactersRulesetFields(characters)` with no ruleset argument, and
 * that default is what maps a legacy `caps.health` onto
 * `attributeDeltas.healthCap`. A storage module can never read a React
 * context, so folding this into the provider would silently degrade that
 * migration for every ruleset but the built-in one.
 *
 * **Call `configureLore` in your entry file, before `registerRootComponent`
 * and before any storage call.** The default below keeps an unconfigured build
 * running, but a migration that runs against the example ruleset when the app
 * meant to use its own will normalize stored fields against the wrong
 * attribute table. `warnIfUnconfigured` makes that loud in development rather
 * than silent.
 *
 * Cycle rule: import `@/ruleset/*` submodules directly here, never the
 * `@/ruleset` barrel — the barrel re-exports `context.tsx`, which imports this
 * file.
 */

export interface LoreConfig {
  ruleset: RulesetDefinition;
  /**
   * Bundled images the ruleset references by key (`map.imageKey`,
   * `branding.iconKey`, …). Omit when the ruleset declares no images.
   */
  assets?: RulesetAssets;
}

let currentRuleset: RulesetDefinition = exampleRuleset;
let currentAssets: RulesetAssets = {};
let configured = false;

export const configureLore = ({ ruleset, assets = {} }: LoreConfig): void => {
  currentRuleset = ruleset;
  currentAssets = assets;
  configured = true;
};

export const getActiveRuleset = (): RulesetDefinition => currentRuleset;

export const getActiveAssets = (): RulesetAssets => currentAssets;

/** True once `configureLore` has been called. */
export const isLoreConfigured = (): boolean => configured;

/**
 * Development-only nudge for the failure that is otherwise invisible: storage
 * migrating a real dataset against the example ruleset because the app never
 * configured its own. Called from `migrateRulesetFields`, not from render — an
 * app that only reads is unaffected by the default.
 */
export const warnIfUnconfigured = (caller: string): void => {
  if (__DEV__ && !configured) {
    console.error(
      `[lore] ${caller} ran before configureLore(), so it used the example ` +
        `ruleset. Call configureLore({ ruleset }) in your entry file, before ` +
        `registerRootComponent, or stored fields will be normalized against ` +
        `the wrong attribute table.`
    );
  }
};

/**
 * Test-only: drop back to the engine default so one suite cannot leak its
 * ruleset into the next.
 */
export const resetLoreConfig = (): void => {
  currentRuleset = exampleRuleset;
  currentAssets = {};
  configured = false;
};
