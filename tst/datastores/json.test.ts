import { jsonDataStore } from '@/datastores/json';
import { createDataStoreContext } from '@/datastores/context';
import type { DataStoreAction } from '@/datastores/types';
import { SafeAsyncStorageJSONParser } from '@/utils/safeAsyncStorageJSONParser';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { zip, unzip } from 'react-native-zip-archive';
import { Alert } from 'react-native';

// The store runs against the REAL characterStorage entry points — only the
// native boundary (file picking, reading, zipping, sharing) is mocked, so
// these are genuine round trips through the already-mocked storage layer.
jest.mock('@/utils/safeAsyncStorageJSONParser');

// characterStorage.ts imports the real `uuid`, which ships ESM and isn't in
// transformIgnorePatterns.
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

const actionById = (id: string): DataStoreAction => {
  const action = jsonDataStore.actions?.find(a => a.id === id);
  if (!action) {
    throw new Error(`jsonDataStore has no "${id}" action`);
  }
  return action;
};

const run = (id: string) => actionById(id).run(createDataStoreContext());

describe('jsonDataStore', () => {
  const mockDate = '2025-01-01T00:00:00.000Z';

  const mockPickedFile = (name: string, uri = 'file://picked/' + name) => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri, name }],
    });
  };

  const mockCancelledPicker = () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: [],
    });
  };

  const character = (overrides: Record<string, unknown> = {}) => ({
    id: 'char-1',
    name: 'Imported Hero',
    archetypeId: 'Human',
    traitIds: [],
    qualityIds: [],
    factions: [],
    relationships: [],
    present: false,
    retired: false,
    createdAt: mockDate,
    updatedAt: mockDate,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    // Default storage state: nothing stored yet.
    (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(null);
    (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(true);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('declares the three file operations', () => {
    expect(jsonDataStore.id).toBe('json');
    expect(jsonDataStore.actions?.map(a => a.id)).toEqual([
      'export',
      'import',
      'merge',
    ]);
    // The default store renders through DataStoreSection, not its own UI.
    expect(jsonDataStore.Section).toBeUndefined();
  });

  describe('export', () => {
    it('writes data.json into a staging tree and zips it', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockImplementation(
        async (key: string) =>
          key === 'gameCharacterManager'
            ? { characters: [character()], version: '1.0' }
            : null
      );

      const result = await run('export');

      expect(result.success).toBe(true);
      const dataJsonWrite = (
        FileSystem.writeAsStringAsync as jest.Mock
      ).mock.calls.find(call => String(call[0]).endsWith('data.json'));
      expect(dataJsonWrite).toBeDefined();
      expect(JSON.parse(dataJsonWrite![1]).characters[0].id).toBe('char-1');

      // The archive is what carries the images, so the export is always a zip.
      expect(zip).toHaveBeenCalledWith(
        expect.stringContaining('export_temp_'),
        expect.stringContaining('.zip')
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('export_temp_'),
        { idempotent: true }
      );
    });

    it('shares the archive and stays quiet when sharing is available', async () => {
      const result = await run('export');

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining('.zip'),
        expect.objectContaining({ mimeType: 'application/zip' })
      );
      // The share sheet is the confirmation; the screen must not alert again.
      expect(result).toEqual({ success: true, handled: true });
    });

    it('reports the file path when sharing is unavailable', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      const result = await run('export');

      expect(result.success).toBe(true);
      expect(result.message).toContain('.zip');
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });
  });

  describe('import', () => {
    it('imports a valid JSON dataset and replaces stored characters', async () => {
      mockPickedFile('backup.json');
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({
          characters: [character()],
          version: '1.0',
          lastUpdated: mockDate,
        })
      );

      const result = await run('import');

      expect(result.success).toBe(true);
      expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
        'gameCharacterManager',
        expect.objectContaining({
          characters: expect.arrayContaining([
            expect.objectContaining({ id: 'char-1', name: 'Imported Hero' }),
          ]),
        })
      );
    });

    it('strips a legacy imageUri from a bare .json import', async () => {
      mockPickedFile('backup.json');
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({
          characters: [character({ imageUri: 'data:image/png;base64,abc' })],
          version: '1.0',
          lastUpdated: mockDate,
        })
      );

      await run('import');

      const saved = (
        SafeAsyncStorageJSONParser.setItem as jest.Mock
      ).mock.calls.find(c => c[0] === 'gameCharacterManager')?.[1];
      // A bare .json carries no image assets, so the deprecated imageUri is
      // dropped rather than backfilled — there is no picture behind it.
      expect(saved.characters[0].imageUri).toBeUndefined();
      expect(saved.characters[0].imageUris).toBeUndefined();
    });

    it('reads data.json out of a .zip and restores its images', async () => {
      mockPickedFile('backup.zip');
      (unzip as jest.Mock).mockResolvedValue('file://mock-cache-directory/x/');
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        async (path: string) => ({
          exists: true,
          isDirectory: !path.includes('.'),
        })
      );
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({ characters: [character()], version: '1.0' })
      );
      (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(
        async (dir: string) => {
          if (dir.endsWith('/images/characters/')) {
            return ['char-1_0.png'];
          }
          if (dir.endsWith('/images/')) {
            return ['characters'];
          }
          if (dir.includes('import_temp_') && !dir.includes('images')) {
            return ['data.json', 'images'];
          }
          return [];
        }
      );

      const result = await run('import');

      expect(result.success).toBe(true);
      const saved = (
        SafeAsyncStorageJSONParser.setItem as jest.Mock
      ).mock.calls.find(c => c[0] === 'gameCharacterManager')?.[1];
      expect(saved.characters[0].imageUris).toEqual([
        'file://mock-document-directory/images/characters/char-1_0.png',
      ]);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('import_temp_'),
        { idempotent: true }
      );
    });

    it('reports a zip with no data.json rather than failing silently', async () => {
      mockPickedFile('backup.zip');
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const result = await run('import');

      expect(result.success).toBe(false);
      expect(result.error).toContain('data.json not found');
      expect(SafeAsyncStorageJSONParser.setItem).not.toHaveBeenCalled();
    });

    it('treats a cancelled picker as handled, not as a failure', async () => {
      mockCancelledPicker();

      const result = await run('import');

      expect(result).toEqual({ success: false, handled: true });
      expect(SafeAsyncStorageJSONParser.setItem).not.toHaveBeenCalled();
    });

    it('reports malformed JSON', async () => {
      mockPickedFile('corrupt.json');
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        'not valid json {'
      );

      const result = await run('import');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to import game data');
    });
  });

  describe('merge', () => {
    it('merges a valid JSON dataset with no conflicts', async () => {
      mockPickedFile('backup.json');
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({
          characters: [character({ id: 'char-new', name: 'New Character' })],
          factions: [],
          locations: [],
          version: '1.0',
          lastUpdated: mockDate,
        })
      );

      const result = await run('merge');

      expect(result.success).toBe(true);
      expect(result.message).toContain('1 new item');
      expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
        'gameCharacterManager',
        expect.objectContaining({
          characters: expect.arrayContaining([
            expect.objectContaining({ id: 'char-new' }),
          ]),
        })
      );
    });

    it('runs its own conflict prompts and reports them as handled', async () => {
      mockPickedFile('backup.json');
      const existing = character({ name: 'Existing Name' });
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockImplementation(
        async (key: string) =>
          key === 'gameCharacterManager'
            ? { characters: [existing], version: '1.0', lastUpdated: mockDate }
            : null
      );
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({
          characters: [{ ...existing, name: 'Conflicting Name' }],
          version: '1.0',
          lastUpdated: mockDate,
        })
      );

      const result = await run('merge');

      // The conflict dialog is the store's own UI, so the screen stays quiet.
      expect(result).toEqual({ success: true, handled: true });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Conflicts Found',
        expect.stringContaining('1 item(s)'),
        expect.anything()
      );
    });

    it('treats a cancelled picker as handled, not as a failure', async () => {
      mockCancelledPicker();

      const result = await run('merge');

      expect(result).toEqual({ success: false, handled: true });
      expect(SafeAsyncStorageJSONParser.setItem).not.toHaveBeenCalled();
    });

    it('reports malformed JSON', async () => {
      mockPickedFile('corrupt.json');
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        '{not valid'
      );

      const result = await run('merge');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to merge game data');
    });
  });
});
