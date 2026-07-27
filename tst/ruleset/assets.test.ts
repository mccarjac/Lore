import { resolveAsset, type RulesetAssets } from '@/ruleset/assets';

/**
 * `resolveAsset` is about key lookup, not about any particular flavor's
 * artwork, so the map here is a stand-in for whatever a ruleset bundles. The
 * values are opaque to the engine — an `ImageSourcePropType` is a number under
 * Metro's asset registry and an object elsewhere.
 */
const assets: RulesetAssets = { map: 1, icon: 2 };

describe('resolveAsset', () => {
  it('resolves a known key', () => {
    expect(resolveAsset(assets, 'map')).toBe(assets.map);
  });

  it('returns undefined for an unknown key', () => {
    expect(resolveAsset(assets, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined when no key is given', () => {
    expect(resolveAsset(assets, undefined)).toBeUndefined();
  });
});
