/**
 * App identity — the build/native values Expo, EAS and the app stores need.
 *
 * This is one of the small set of **fork-owned** files (see AGENTS.md →
 * "Engine vs fork"): a flavor changes this module plus `assets/` and its
 * ruleset directory, and nothing else.
 *
 * Two constraints keep it useful:
 *
 * - **Stay dependency-free.** `app.config.ts` imports this module outside
 *   Metro, before any React code runs, so it cannot reach for
 *   `react-native`, a path alias, or anything that pulls one in.
 * - **Don't confuse it with `RulesetDefinition.branding`.** That field is
 *   *runtime display* identity, owned by whichever ruleset is active and
 *   correctly per-ruleset. This module is *build* identity, which no ruleset
 *   can supply because it is resolved before one is chosen. `APP_NAME` is the
 *   single source: rulesets import it for their `branding.appName`, never the
 *   other way round.
 */

export const APP_NAME = 'Junktown Intelligence';
export const APP_SLUG = 'GameCharacterManager';
export const APP_VERSION = '1.0.0';

/** Shared by the iOS bundle identifier and the Android package. */
export const BUNDLE_IDENTIFIER = 'com.junktownintelligence.app';

export const EAS_PROJECT_ID = '885b4454-9ce8-4aeb-b316-e62c0b669199';
export const EXPO_OWNER = 'mccarjac';

export const SPLASH_BACKGROUND_COLOR = '#ffffff';

/** Paths are relative to the project root — `app.config.ts` resolves them. */
export const BRANDING_ASSETS = {
  icon: './assets/icon.png',
  adaptiveIcon: './assets/adaptive-icon.png',
  splash: './assets/splash-icon.png',
  favicon: './assets/favicon.png',
};
