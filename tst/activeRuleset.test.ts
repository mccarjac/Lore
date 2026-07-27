import { activeRuleset, activeAssets } from '@/activeRuleset';
import { validateRuleset } from '@/ruleset/validate';
import { APP_NAME } from '@/branding';

/**
 * The seam's contract, not its current value. Whichever ruleset a build
 * selects has to satisfy all of this — these are the properties that must
 * survive changing flavors, so this file is what catches a bad swap.
 */
describe('the active ruleset', () => {
  it('validates', () => {
    const result = validateRuleset(activeRuleset);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('agrees with the build about the app name', () => {
    // Build identity (src/branding.ts) and runtime display identity
    // (RulesetDefinition.branding.appName) are separate concepts but must not
    // disagree in a single-ruleset app. Relax this first if a ruleset picker
    // ever lands.
    expect(activeRuleset.branding.appName).toBe(APP_NAME);
  });

  it('resolves every asset key it references', () => {
    // A dangling imageKey renders as a blank screen rather than an error, so
    // the check has to be explicit.
    if (activeRuleset.map) {
      expect(activeAssets[activeRuleset.map.imageKey]).toBeDefined();
    }
    [activeRuleset.branding.iconKey, activeRuleset.branding.splashKey]
      .filter((key): key is string => key !== undefined)
      .forEach(key => expect(activeAssets[key]).toBeDefined());
  });
});
