/**
 * The example-campaign seed store — a dev-only, import-only `DataStore` that
 * loads `exampleSeedDataset` into local storage (#51).
 *
 * Every statistics screen (`CharacterStatsScreen`, `FactionStatsScreen`,
 * `InfluenceReportScreen`, the relationship graph) is empty on a fresh
 * install, which makes the facet generalization impossible to eyeball by
 * just running the app. This store is how "run the app" produces a campaign
 * to look at, without shipping example data in every consumer's build —
 * `registry.ts` registers it only under `__DEV__`, so it never reaches a
 * shipped app.
 *
 * Import-only, mirroring `pdfDataStore`'s export-only shape (#28): nothing
 * here reads local data back out, so there is no export/merge action to
 * write.
 */
import { Alert } from 'react-native';
import { exampleSeedDataset } from '@/ruleset/exampleSeedData';
import type {
  DataStore,
  DataStoreActionResult,
  DataStoreContext,
} from '../types';

const confirmOverwrite = (): Promise<boolean> =>
  new Promise(resolve => {
    Alert.alert(
      'Load Example Campaign',
      'This replaces all local game data with a small example campaign. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Load', style: 'destructive', onPress: () => resolve(true) },
      ]
    );
  });

const loadExampleCampaign = async (
  ctx: DataStoreContext
): Promise<DataStoreActionResult> => {
  // The dataset's ids (archetypes, traits, qualities, faction names) are
  // authored against `exampleRuleset` specifically and would not resolve
  // against a different ruleset — refuse with a message rather than import
  // data that renders as a wall of "unresolved" badges.
  if (ctx.ruleset.id !== 'example') {
    return {
      success: false,
      error:
        'The example campaign only makes sense with the example ruleset — this build is running a different one.',
    };
  }

  const confirmed = await confirmOverwrite();
  if (!confirmed) {
    return { success: false, handled: true };
  }

  try {
    // Via the context, never AsyncStorage — the seam's first rule (same as
    // every other store).
    const imported = await ctx.importDataset(
      JSON.stringify(exampleSeedDataset)
    );
    if (!imported) {
      return { success: false, error: 'Failed to load the example campaign.' };
    }
    return {
      success: true,
      message: 'Example campaign loaded — every screen now has data to show.',
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to load the example campaign: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
};

export const seedDataStore: DataStore = {
  id: 'seed',
  label: 'Example Campaign (Dev)',
  description:
    'Load a small example campaign so every screen — stats, influence report, relationship graph — has real data to render. Replaces all local data.',
  actions: [
    {
      id: 'load',
      label: 'Load Example Campaign',
      progressMessage: 'Loading example campaign...',
      variant: 'danger',
      run: loadExampleCampaign,
    },
  ],
};
