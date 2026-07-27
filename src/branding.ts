/**
 * App identity — the build/native values Expo, EAS and the app stores need.
 *
 * This is one of the small set of **fork-owned** files (see AGENTS.md →
 * "Engine vs fork"), but a fork no longer has to edit it: every value reads
 * from the environment first and falls back to Lore's own identity. A flavor
 * sets its values in `.env` (see `.env.example`) and changes `assets/` and its
 * ruleset directory, and nothing else.
 *
 * Three constraints keep this module working:
 *
 * - **Stay dependency-free.** `app.config.ts` imports it outside Metro, before
 *   any React code runs, so it cannot reach for `react-native`, a path alias,
 *   or anything that pulls one in.
 * - **Read `process.env` with static member access only.** Expo's babel
 *   transform inlines `process.env.EXPO_PUBLIC_*` by literal text substitution,
 *   so a lookup helper (`env('EXPO_PUBLIC_APP_NAME')`) would silently read
 *   `undefined` in a release bundle. The accesses below are written out for
 *   that reason — do not factor them into a helper.
 * - **`EXPO_PUBLIC_` only for what the app bundle reads.** `APP_NAME` is used
 *   at runtime (rulesets import it for `branding.appName`), so it needs the
 *   prefix. The slug, bundle identifier, EAS project id and Expo owner are read
 *   only by `app.config.ts` under Node, so they stay unprefixed and out of the
 *   shipped bundle.
 *
 * Don't confuse this with `RulesetDefinition.branding`. That field is *runtime
 * display* identity, owned by whichever ruleset is active and correctly
 * per-ruleset. This module is *build* identity, which no ruleset can supply
 * because it is resolved before one is chosen. `APP_NAME` is the single source:
 * rulesets import it for their `branding.appName`, never the other way round.
 */

export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? 'Lore';
export const APP_SLUG = process.env.EXPO_PUBLIC_APP_SLUG ?? 'lore';
export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0';

/** Shared by the iOS bundle identifier and the Android package. */
export const BUNDLE_IDENTIFIER =
  process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER ?? 'com.mccarjac.lore';

/**
 * Empty until someone runs `eas init` for this repo and puts the id it prints
 * into `.env`. Nothing but an EAS build reads it, so an empty value is only a
 * problem at the moment you build. Junktown Intelligence's own id stays with
 * that fork — in its `.env`, not here.
 */
export const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '';
export const EXPO_OWNER = process.env.EXPO_OWNER ?? 'mccarjac';

export const SPLASH_BACKGROUND_COLOR =
  process.env.EXPO_PUBLIC_SPLASH_BACKGROUND_COLOR ?? '#ffffff';

/** Paths are relative to the project root — `app.config.ts` resolves them. */
export const BRANDING_ASSETS = {
  icon: './assets/icon.png',
  adaptiveIcon: './assets/adaptive-icon.png',
  splash: './assets/splash-icon.png',
  favicon: './assets/favicon.png',
};
