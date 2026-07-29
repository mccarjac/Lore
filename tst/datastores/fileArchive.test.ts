import * as FileSystem from 'expo-file-system/legacy';
import {
  extractImageData,
  restoreImagesFromArchive,
  sanitizeForFilename,
  stageCollectionImages,
  stageDatasetImages,
  stripLegacyImageUris,
} from '@/datastores/json/fileArchive';

const STAGING = 'file://mock-cache-directory/export_temp/';

describe('fileArchive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('extractImageData', () => {
    it('splits a base64 data URI into mime type, payload and extension', () => {
      expect(extractImageData('data:image/png;base64,QUJD')).toEqual({
        mimeType: 'image/png',
        base64Data: 'QUJD',
        extension: 'png',
      });
    });

    it('returns null for anything that is not a base64 data URI', () => {
      expect(extractImageData('file:///photos/a.jpg')).toBeNull();
      expect(extractImageData('images/characters/a.jpg')).toBeNull();
    });
  });

  describe('stageCollectionImages', () => {
    it('writes a data URI into the archive and rewrites the reference', async () => {
      const characters = [
        { id: 'char-1', imageUris: ['data:image/png;base64,QUJD'] },
      ];

      const staged = await stageCollectionImages(
        characters,
        'characters',
        STAGING
      );

      expect(staged).toBe(1);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        STAGING + 'images/characters/char-1_0.png',
        'QUJD',
        { encoding: 'base64' }
      );
      expect(characters[0].imageUris).toEqual([
        'images/characters/char-1_0.png',
      ]);
    });

    it('copies a local file URI and keeps its extension', async () => {
      const locations = [{ id: 'loc-1', imageUris: ['file:///photos/a.JPEG'] }];

      await stageCollectionImages(locations, 'locations', STAGING);

      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: 'file:///photos/a.JPEG',
        to: STAGING + 'images/locations/loc-1_0.jpeg',
      });
      expect(locations[0].imageUris).toEqual(['images/locations/loc-1_0.jpeg']);
    });

    it('keys factions by sanitized name, since they have no id', async () => {
      const factions = [
        { name: 'The Rust Kings!', imageUris: ['data:image/png;base64,QUJD'] },
      ];

      await stageCollectionImages(factions, 'factions', STAGING);

      expect(factions[0].imageUris).toEqual([
        'images/factions/The_Rust_Kings__0.png',
      ]);
    });

    it('normalizes a legacy single imageUri onto imageUris and drops it', async () => {
      const events = [
        { id: 'ev-1', imageUri: 'data:image/jpeg;base64,QUJD' },
      ] as { id: string; imageUri?: string; imageUris?: string[] }[];

      await stageCollectionImages(events, 'events', STAGING);

      expect(events[0].imageUris).toEqual(['images/events/ev-1.jpeg']);
      // The deprecated field is never written back out.
      expect(events[0].imageUri).toBeUndefined();
    });

    it('carries an already-relative reference through untouched', async () => {
      const characters = [
        { id: 'char-1', imageUris: ['images/characters/char-1_0.png'] },
      ];

      const staged = await stageCollectionImages(
        characters,
        'characters',
        STAGING
      );

      expect(staged).toBe(0);
      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
      expect(characters[0].imageUris).toEqual([
        'images/characters/char-1_0.png',
      ]);
    });

    it('skips an unreadable file rather than failing the whole export', async () => {
      (FileSystem.copyAsync as jest.Mock).mockRejectedValue(
        new Error('ENOENT')
      );
      const characters = [
        {
          id: 'char-1',
          imageUris: ['file:///gone.jpg', 'data:image/png;base64,QUJD'],
        },
      ];

      const staged = await stageCollectionImages(
        characters,
        'characters',
        STAGING
      );

      expect(staged).toBe(1);
      expect(characters[0].imageUris).toEqual([
        'images/characters/char-1_1.png',
      ]);
    });
  });

  describe('stageDatasetImages', () => {
    it('stages every image-bearing collection and Discord attachments', async () => {
      const dataset = {
        characters: [{ id: 'c', imageUris: ['data:image/png;base64,QUJD'] }],
        locations: [{ id: 'l', imageUris: ['data:image/png;base64,QUJD'] }],
        events: [{ id: 'e', imageUris: ['data:image/png;base64,QUJD'] }],
        factions: [{ name: 'F', imageUris: ['data:image/png;base64,QUJD'] }],
        discord: {
          messages: [{ id: 'm', imageUris: ['file:///dl/m.png'] }],
        },
      };

      expect(await stageDatasetImages(dataset, STAGING)).toBe(5);
      expect(dataset.discord.messages[0].imageUris).toEqual([
        'images/discord/m_0.png',
      ]);
    });
  });

  describe('restoreImagesFromArchive', () => {
    const EXTRACTED = 'file://mock-cache-directory/import_temp/';

    beforeEach(() => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(
        async (dir: string) => {
          if (dir === EXTRACTED) {
            return ['data.json', 'images'];
          }
          if (dir === EXTRACTED + 'images/') {
            return ['characters', 'factions'];
          }
          if (dir === EXTRACTED + 'images/characters/') {
            return ['char-1_1.png', 'char-1_0.png'];
          }
          if (dir === EXTRACTED + 'images/factions/') {
            return ['The_Rust_Kings.png'];
          }
          return [];
        }
      );
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        async (path: string) => ({
          exists: true,
          isDirectory: !path.includes('.'),
        })
      );
    });

    it('copies images into permanent storage in index order', async () => {
      const dataset = {
        characters: [{ id: 'char-1' }],
        factions: [{ name: 'The Rust Kings' }],
      } as {
        characters: { id: string; imageUris?: string[] }[];
        factions: { name: string; imageUris?: string[] }[];
      };

      await restoreImagesFromArchive(EXTRACTED, dataset);

      // `_1` is listed first on disk; the restored order comes from the index
      // in the filename, not from readDirectoryAsync's ordering.
      expect(dataset.characters[0].imageUris).toEqual([
        'file://mock-document-directory/images/characters/char-1_0.png',
        'file://mock-document-directory/images/characters/char-1_1.png',
      ]);
      // Restored as file URIs, never base64: a dataset that inlined every
      // image would be re-serialized into storage on every write.
      expect(dataset.factions[0].imageUris).toEqual([
        'file://mock-document-directory/images/factions/The_Rust_Kings.png',
      ]);
    });

    it('ignores an image whose record is not in the dataset', async () => {
      const dataset = { characters: [{ id: 'someone-else' }] } as {
        characters: { id: string; imageUris?: string[] }[];
      };

      await restoreImagesFromArchive(EXTRACTED, dataset);

      expect(dataset.characters[0].imageUris).toBeUndefined();
    });

    it('does nothing for an archive with no images directory', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'data.json',
      ]);
      const dataset = { characters: [{ id: 'char-1' }] };

      await restoreImagesFromArchive(EXTRACTED, dataset);

      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    });
  });

  describe('stripLegacyImageUris', () => {
    it('drops the deprecated field from every collection', () => {
      const dataset = {
        characters: [{ id: 'c', imageUri: 'data:image/png;base64,QUJD' }],
        locations: [{ id: 'l', imageUri: 'file:///a.png' }],
        events: [{ id: 'e', imageUri: 'file:///b.png' }],
        factions: [{ name: 'F', imageUri: 'file:///c.png' }],
      };

      stripLegacyImageUris(dataset);

      expect(dataset.characters[0].imageUri).toBeUndefined();
      expect(dataset.locations[0].imageUri).toBeUndefined();
      expect(dataset.events[0].imageUri).toBeUndefined();
      expect(dataset.factions[0].imageUri).toBeUndefined();
    });
  });

  describe('sanitizeForFilename', () => {
    it('replaces everything outside [a-zA-Z0-9]', () => {
      expect(sanitizeForFilename("O'Malley & Sons")).toBe('O_Malley___Sons');
    });
  });
});
