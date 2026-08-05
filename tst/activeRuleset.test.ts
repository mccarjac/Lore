import {
  configureLore,
  getActiveRuleset,
  getActiveAssets,
  isLoreConfigured,
  resetLoreConfig,
  warnIfUnconfigured,
} from '@/activeRuleset';
import { validateRuleset } from '@/ruleset/validate';
import { exampleRuleset } from '@/ruleset/exampleRuleset';
import { APP_NAME } from '@/branding';
import type { RulesetAssets } from '@/ruleset/assets';
import { genericRuleset } from './fixtures/genericRuleset';

/**
 * The seam's contract, not its current value.
 *
 * The engine reads its ruleset from a registry a consumer pushes into
 * (`configureLore`), because a package cannot import its consumer's module.
 * What has to hold: an unconfigured build still runs, a configured one is
 * actually used, and the case that silently corrupts data — a storage
 * migration running before configuration — is loud in development.
 */
describe('the active ruleset registry', () => {
  afterEach(resetLoreConfig);

  it('serves the example ruleset until configured', () => {
    expect(isLoreConfigured()).toBe(false);
    expect(getActiveRuleset()).toBe(exampleRuleset);
    expect(getActiveAssets()).toEqual({});
  });

  it('serves what the consumer configured', () => {
    const assets: RulesetAssets = { map: 1 };
    configureLore({ ruleset: genericRuleset, assets });

    expect(isLoreConfigured()).toBe(true);
    expect(getActiveRuleset()).toBe(genericRuleset);
    expect(getActiveAssets()).toBe(assets);
  });

  it('defaults assets to empty when a ruleset bundles no images', () => {
    configureLore({ ruleset: genericRuleset });
    expect(getActiveAssets()).toEqual({});
  });

  it('is replaceable, so a later call wins', () => {
    configureLore({ ruleset: genericRuleset });
    configureLore({ ruleset: exampleRuleset });
    expect(getActiveRuleset()).toBe(exampleRuleset);
  });
});

describe('whatever ruleset is active', () => {
  afterEach(resetLoreConfig);

  it('validates', () => {
    // Properties that must survive changing flavors — this is what catches a
    // bad swap, whichever ruleset a build selects.
    const result = validateRuleset(getActiveRuleset());
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('agrees with the build about the app name', () => {
    // Build identity (src/branding.ts) and runtime display identity
    // (RulesetDefinition.branding.appName) are separate concepts but must not
    // disagree in a single-ruleset app. Relax this first if a ruleset picker
    // ever lands.
    expect(getActiveRuleset().branding.appName).toBe(APP_NAME);
  });

  it('resolves every asset key it references', () => {
    // A dangling imageKey renders as a blank screen rather than an error, so
    // the check has to be explicit.
    const ruleset = getActiveRuleset();
    const assets = getActiveAssets();

    [ruleset.branding.iconKey, ruleset.branding.splashKey]
      .filter((key): key is string => key !== undefined)
      .forEach(key => expect(assets[key]).toBeDefined());
  });
});

describe('warnIfUnconfigured', () => {
  const previousDev = global.__DEV__;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
    global.__DEV__ = previousDev;
    resetLoreConfig();
  });

  it('complains in dev when a caller ran before configuration', () => {
    global.__DEV__ = true;
    warnIfUnconfigured('migrateRulesetFields');

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('migrateRulesetFields')
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('configureLore()')
    );
  });

  it('says nothing once configured', () => {
    global.__DEV__ = true;
    configureLore({ ruleset: genericRuleset });
    warnIfUnconfigured('migrateRulesetFields');

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('stays quiet outside dev', () => {
    global.__DEV__ = false;
    warnIfUnconfigured('migrateRulesetFields');

    expect(consoleError).not.toHaveBeenCalled();
  });
});
