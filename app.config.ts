import type { ExpoConfig } from 'expo/config';
import {
  APP_NAME,
  APP_SLUG,
  APP_VERSION,
  BRANDING_ASSETS,
  BUNDLE_IDENTIFIER,
  EAS_PROJECT_ID,
  EXPO_OWNER,
  SPLASH_BACKGROUND_COLOR,
} from './src/branding.ts';

/**
 * Engine-owned: this file holds the config *shape* and no identity literals.
 * Everything a fork changes lives in `src/branding.ts`.
 *
 * Two things about that import are load-bearing. It is **relative**, because
 * Expo resolves this file outside Metro and path aliases do not exist here.
 * And it carries an explicit **`.ts` extension**: Expo transpiles this entry
 * file through sucrase but resolves its requires with plain Node, which would
 * otherwise look for `./src/branding.js` and fail. `allowImportingTsExtensions`
 * in tsconfig.json is what keeps `tsc` happy with that.
 *
 * `cli.appVersionSource` is read by EAS CLI and is not part of `ExpoConfig`,
 * hence the intersection.
 */
const config: ExpoConfig & { cli?: { appVersionSource?: string } } = {
  name: APP_NAME,
  slug: APP_SLUG,
  version: APP_VERSION,
  orientation: 'portrait',
  icon: BRANDING_ASSETS.icon,
  userInterfaceStyle: 'light',
  splash: {
    image: BRANDING_ASSETS.splash,
    resizeMode: 'contain',
    backgroundColor: SPLASH_BACKGROUND_COLOR,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_IDENTIFIER,
  },
  android: {
    package: BUNDLE_IDENTIFIER,
    adaptiveIcon: {
      foregroundImage: BRANDING_ASSETS.adaptiveIcon,
      backgroundColor: SPLASH_BACKGROUND_COLOR,
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: BRANDING_ASSETS.favicon,
  },
  cli: {
    appVersionSource: 'remote',
  },
  // Omitted entirely until `EAS_PROJECT_ID` is set, rather than published as
  // an empty string: EAS treats a blank id as a malformed project reference,
  // and an absent one as "not initialized yet", which is what a fresh clone is.
  extra: EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : undefined,
  owner: EXPO_OWNER,
};

export default config;
