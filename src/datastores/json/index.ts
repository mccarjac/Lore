/**
 * The local JSON data store — the one enabled by default (#29).
 *
 * "JSON" names the payload, not the container. An export is a `.zip` holding
 * `data.json` plus an `images/` tree, because a dataset without its pictures
 * is not a backup; an import accepts either that archive or a bare `.json`
 * file, which is what an older export or a hand-edited dataset looks like.
 *
 * This is `utils/exportImport.ts` reshaped into a `DataStore`, with the three
 * copies of the image handling collapsed into `fileArchive.ts`. Behavior on
 * the file path is unchanged.
 */

import 'react-native-get-random-values';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';
import { zip, unzip } from 'react-native-zip-archive';
import { updateCharacter, type MergeConflict } from '@utils/characterStorage';
import { sortDatasetDeterministically } from '@utils/datasetSorting';
import type {
  DataStore,
  DataStoreActionResult,
  DataStoreContext,
} from '../types';
import {
  createStagingTree,
  restoreImagesFromArchive,
  stageDatasetImages,
  stripLegacyImageUris,
} from './fileArchive';

/** Cache first, documents as the fallback — matches every other write here. */
const workingDirectory = (): string =>
  FileSystem.cacheDirectory || FileSystem.documentDirectory || '';

const timestampForFilename = (): string =>
  new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');

/**
 * Ask the user for a `.json` or `.zip` and hand back its parsed dataset.
 *
 * `null` means "stop, quietly" — a cancelled picker or an archive we already
 * reported on. The zip branch restores images into permanent storage as a side
 * effect, which is why this returns the dataset rather than raw text.
 */
const pickDataset = async (): Promise<
  { dataset: Record<string, unknown> } | { cancelled: true } | { error: string }
> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/zip'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return { cancelled: true };
  }

  const fileUri = result.assets[0].uri;
  const isZip = result.assets[0].name.endsWith('.zip');

  if (!isZip) {
    // A bare `.json` carries no image assets, so a legacy single `imageUri`
    // is dropped rather than backfilled — there is no picture behind it.
    const dataset = JSON.parse(await FileSystem.readAsStringAsync(fileUri));
    stripLegacyImageUris(dataset);
    return { dataset };
  }

  const tempDir = `${workingDirectory()}import_temp_${new Date().getTime()}/`;

  try {
    await unzip(fileUri, tempDir);
  } catch (error) {
    return {
      error: `Failed to extract zip file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }

  const dataJsonPath = tempDir + 'data.json';
  const dataJsonInfo = await FileSystem.getInfoAsync(dataJsonPath);
  if (!dataJsonInfo.exists) {
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    return { error: 'Invalid zip file: data.json not found in the archive.' };
  }

  const jsonContent = await FileSystem.readAsStringAsync(dataJsonPath);
  let dataset: Record<string, unknown>;
  try {
    dataset = JSON.parse(jsonContent);
  } catch (error) {
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    return {
      error: `Invalid JSON in data.json: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }

  await restoreImagesFromArchive(tempDir, dataset);
  await FileSystem.deleteAsync(tempDir, { idempotent: true });

  return { dataset };
};

const exportToFile = async (
  ctx: DataStoreContext
): Promise<DataStoreActionResult> => {
  try {
    const dataset = JSON.parse(await ctx.exportDataset());

    const timestamp = timestampForFilename();
    const tempDir = `${workingDirectory()}export_temp_${timestamp}/`;
    await createStagingTree(tempDir);

    const imageCount = await stageDatasetImages(dataset, tempDir);

    // Sorted deterministically so a re-export of unchanged data produces an
    // identical file rather than diff noise.
    await FileSystem.writeAsStringAsync(
      tempDir + 'data.json',
      JSON.stringify(sortDatasetDeterministically(dataset), null, 2)
    );

    const zipPath = `${workingDirectory()}character-faction-data-${timestamp}.zip`;
    await zip(tempDir, zipPath);
    await FileSystem.deleteAsync(tempDir, { idempotent: true });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        dialogTitle: 'Export Game Data',
      });
      // The share sheet is the confirmation; a follow-up alert is noise.
      return { success: true, handled: true };
    }

    return {
      success: true,
      message: `Game data exported to: ${zipPath}${
        imageCount > 0 ? ` (includes ${imageCount} images)` : ''
      }`,
    };
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      error: 'Failed to export game data. Please try again.',
    };
  }
};

const importFromFile = async (
  ctx: DataStoreContext
): Promise<DataStoreActionResult> => {
  try {
    const picked = await pickDataset();
    if ('cancelled' in picked) {
      return { success: false, handled: true };
    }
    if ('error' in picked) {
      return { success: false, error: picked.error };
    }

    const imported = await ctx.importDataset(JSON.stringify(picked.dataset));
    if (!imported) {
      return {
        success: false,
        error: 'The selected file is not a valid game data file.',
      };
    }

    return {
      success: true,
      message:
        'Game data has been imported successfully. All existing data has been replaced.',
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to import game data: ${
        error instanceof Error ? error.message : 'Unknown error'
      }\n\nPlease check the file format and try again.`,
    };
  }
};

/**
 * Walk the user through each conflicting property, one alert at a time.
 *
 * Sequential rather than batched because `Alert` shows one dialog at a time on
 * both platforms; the `await` per property is what keeps them from stacking.
 */
const resolveConflictsInteractively = async (
  conflicts: MergeConflict[]
): Promise<void> => {
  for (const conflict of conflicts) {
    for (const property of conflict.conflicts) {
      const existingValue = (
        conflict.existing as unknown as Record<string, unknown>
      )[property];
      const importedValue = (
        conflict.imported as unknown as Record<string, unknown>
      )[property];

      await new Promise<void>(resolve => {
        Alert.alert(
          'Merge Conflict',
          `Character "${conflict.existing.name}" has conflicting ${property}:\n\nExisting: ${existingValue}\nImported: ${importedValue}\n\nWhich value would you like to keep?`,
          [
            { text: 'Keep Existing', onPress: () => resolve() },
            {
              text: 'Use Imported',
              onPress: async () => {
                await updateCharacter(conflict.id, {
                  [property]: importedValue,
                });
                resolve();
              },
            },
            {
              text: 'Skip This Property',
              style: 'cancel',
              onPress: () => resolve(),
            },
          ]
        );
      });
    }
  }
};

const mergeFromFile = async (
  ctx: DataStoreContext
): Promise<DataStoreActionResult> => {
  try {
    const picked = await pickDataset();
    if ('cancelled' in picked) {
      return { success: false, handled: true };
    }
    if ('error' in picked) {
      return { success: false, error: picked.error };
    }

    const merged = await ctx.mergeDataset(JSON.stringify(picked.dataset));
    if (!merged.success) {
      return {
        success: false,
        error: 'The selected file is not a valid game data file.',
      };
    }

    if (merged.conflicts.length === 0) {
      return {
        success: true,
        message: `Successfully merged ${merged.added.length} new items with no conflicts.`,
      };
    }

    Alert.alert(
      'Conflicts Found',
      `Found ${merged.conflicts.length} item(s) with conflicts. You'll be asked to resolve each conflict.`,
      [
        {
          text: 'Resolve Conflicts',
          onPress: async () => {
            await resolveConflictsInteractively(merged.conflicts);
            Alert.alert(
              'Merge Complete',
              `Successfully merged ${merged.added.length} new items, and resolved conflicts for ${merged.conflicts.length} existing items.`,
              [{ text: 'OK' }]
            );
          },
        },
        {
          text: 'Skip Conflicts',
          style: 'cancel',
          onPress: () => {
            Alert.alert(
              'Merge Complete',
              `Successfully merged ${merged.added.length} new items. Conflicts were resolved automatically by merging compatible properties.`,
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );

    // The conflict prompts are the store's own UI; the screen stays quiet.
    return { success: true, handled: true };
  } catch (error) {
    console.error('Merge error:', error);
    return {
      success: false,
      error:
        'Failed to merge game data. Please check the file format and try again.',
    };
  }
};

export const jsonDataStore: DataStore = {
  id: 'json',
  label: 'JSON Data Management',
  description:
    'Export, import, or merge your game data as a file for backup or sharing. Exports are a .zip holding data.json plus any images.',
  actions: [
    {
      id: 'export',
      label: 'Export Game Data',
      progressMessage: 'Exporting data...',
      variant: 'warning',
      run: exportToFile,
    },
    {
      id: 'import',
      label: 'Import & Replace',
      progressMessage: 'Importing data...',
      variant: 'secondary',
      run: importFromFile,
    },
    {
      id: 'merge',
      label: 'Merge Data',
      progressMessage: 'Merging data...',
      variant: 'primary',
      run: mergeFromFile,
    },
  ],
};
