import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Build identity is env-driven with Lore defaults (`src/branding.ts`). Two
 * things are worth proving: an untouched clone gets Lore's identity, and a
 * fork's `.env` actually reaches the constants — the alternative is a fork
 * that thinks it has been rebranded while EAS still builds someone else's app.
 *
 * Every case re-imports the module, because the constants are resolved once at
 * module load.
 */

const ENV_KEYS = [
  'EXPO_PUBLIC_APP_NAME',
  'EXPO_PUBLIC_APP_SLUG',
  'EXPO_PUBLIC_APP_VERSION',
  'EXPO_PUBLIC_BUNDLE_IDENTIFIER',
  'EXPO_PUBLIC_SPLASH_BACKGROUND_COLOR',
  'EAS_PROJECT_ID',
  'EXPO_OWNER',
] as const;

type Branding = typeof import('@/branding');

const loadBranding = async (
  env: Partial<Record<string, string>> = {}
): Promise<Branding> => {
  const saved = { ...process.env };
  ENV_KEYS.forEach(key => delete process.env[key]);
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  let branding: Branding = {} as Branding;
  await jest.isolateModulesAsync(async () => {
    branding = await import('@/branding');
  });

  process.env = saved;
  return branding;
};

describe('build identity defaults', () => {
  it('is Lore when nothing is set in the environment', async () => {
    const branding = await loadBranding();

    expect(branding.APP_NAME).toBe('Lore');
    expect(branding.APP_SLUG).toBe('lore');
    expect(branding.BUNDLE_IDENTIFIER).toBe('com.mccarjac.lore');
    expect(branding.EXPO_OWNER).toBe('mccarjac');
  });

  it('leaves the EAS project id empty until `eas init` has run', async () => {
    expect((await loadBranding()).EAS_PROJECT_ID).toBe('');
  });

  it('carries no trace of the fork it was generalized out of', async () => {
    const branding = await loadBranding();
    const values = [
      branding.APP_NAME,
      branding.APP_SLUG,
      branding.APP_VERSION,
      branding.BUNDLE_IDENTIFIER,
      branding.EAS_PROJECT_ID,
      branding.EXPO_OWNER,
      ...Object.values(branding.BRANDING_ASSETS),
    ].join(' ');

    expect(values).not.toMatch(/junktown/i);
    expect(values).not.toMatch(/GameCharacterManager/i);
  });
});

describe('build identity overrides', () => {
  it('takes every value from the environment when one is set', async () => {
    const branding = await loadBranding({
      EXPO_PUBLIC_APP_NAME: 'Some Flavor',
      EXPO_PUBLIC_APP_SLUG: 'some-flavor',
      EXPO_PUBLIC_APP_VERSION: '2.3.4',
      EXPO_PUBLIC_BUNDLE_IDENTIFIER: 'com.example.someflavor',
      EXPO_PUBLIC_SPLASH_BACKGROUND_COLOR: '#101010',
      EAS_PROJECT_ID: '00000000-1111-2222-3333-444444444444',
      EXPO_OWNER: 'someone-else',
    });

    expect(branding.APP_NAME).toBe('Some Flavor');
    expect(branding.APP_SLUG).toBe('some-flavor');
    expect(branding.APP_VERSION).toBe('2.3.4');
    expect(branding.BUNDLE_IDENTIFIER).toBe('com.example.someflavor');
    expect(branding.SPLASH_BACKGROUND_COLOR).toBe('#101010');
    expect(branding.EAS_PROJECT_ID).toBe(
      '00000000-1111-2222-3333-444444444444'
    );
    expect(branding.EXPO_OWNER).toBe('someone-else');
  });
});

describe('branding assets', () => {
  it('points at files that exist', async () => {
    // `app.config.ts` hands these paths to Expo verbatim; a missing one fails
    // at build time, long after the edit that broke it. The paths are relative
    // to the project root, which is Jest's cwd.
    const { BRANDING_ASSETS } = await loadBranding();
    Object.values(BRANDING_ASSETS).forEach(path => {
      expect(existsSync(resolve(process.cwd(), path))).toBe(true);
    });
  });
});
