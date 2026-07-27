import type { ImageSourcePropType } from 'react-native';

/**
 * Maps the asset keys referenced by a RulesetDefinition (map.imageKey,
 * branding.iconKey, branding.splashKey) to bundled images. Kept separate
 * from RulesetDefinition because bundled images cannot round-trip through
 * JSON, and the definition itself must stay serializable.
 *
 * The images themselves are ruleset content and live with the ruleset, in
 * `src/rulesets/<flavor>/assets.ts`.
 */
export type RulesetAssets = Record<string, ImageSourcePropType>;

export const resolveAsset = (
  assets: RulesetAssets,
  key: string | undefined
): ImageSourcePropType | undefined => (key ? assets[key] : undefined);
