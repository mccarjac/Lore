import * as FileSystem from 'expo-file-system/legacy';
import {
  collectManagedUris,
  migrateImageReferences,
  migrateRecordImages,
} from '@utils/imageMigration';

jest.mock('uuid', () => ({ v4: () => 'generated-uuid' }));

const DOCS = 'file://mock-document-directory/';
const CACHE = 'file://mock-cache-directory/';

/** Only the paths named here exist; everything else is a cache-clear casualty. */
const onDisk = (...paths: string[]) => {
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) =>
    Promise.resolve({ exists: paths.includes(path) })
  );
};

describe('imageMigration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    onDisk();
  });

  describe('migrateImageReferences', () => {
    it('leaves data and remote URIs alone without touching the filesystem', async () => {
      const uris = ['data:image/png;base64,QUJD', 'https://cdn.test/a.jpg'];

      expect(await migrateImageReferences(uris, 'characters')).toBe(uris);
      expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
    });

    it('returns the same reference when there is nothing to do', async () => {
      onDisk(`${DOCS}images/characters/a.jpg`);
      const uris = ['lore-file://images/characters/a.jpg'];

      expect(await migrateImageReferences(uris, 'characters')).toBe(uris);
    });

    it('rewrites a documents-container path to a managed reference', async () => {
      onDisk(`${DOCS}images/characters/a.jpg`);

      expect(
        await migrateImageReferences(
          [`${DOCS}images/characters/a.jpg`],
          'characters'
        )
      ).toEqual(['lore-file://images/characters/a.jpg']);
      // Already durable — only the address changed, so nothing was copied.
      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    });

    it('copies a still-readable file out of the cache before rewriting it', async () => {
      onDisk(`${CACHE}ImagePicker/x.jpg`);

      expect(
        await migrateImageReferences([`${CACHE}ImagePicker/x.jpg`], 'locations')
      ).toEqual(['lore-file://images/locations/generated-uuid.jpg']);
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: `${CACHE}ImagePicker/x.jpg`,
        to: `${DOCS}images/locations/generated-uuid.jpg`,
      });
    });

    it('drops a cache path whose file the cache clear already took', async () => {
      expect(
        await migrateImageReferences(
          [`${CACHE}ImagePicker/gone.jpg`],
          'characters'
        )
      ).toEqual([]);
    });

    it('drops a managed reference whose file is missing', async () => {
      expect(
        await migrateImageReferences(
          ['lore-file://images/characters/gone.jpg'],
          'x'
        )
      ).toEqual([]);
    });

    it('drops a documents path whose file is missing', async () => {
      expect(
        await migrateImageReferences([`${DOCS}images/characters/gone.jpg`], 'x')
      ).toEqual([]);
    });

    it("keeps the survivors when only some of a record's images are gone", async () => {
      onDisk(`${DOCS}images/characters/kept.jpg`);

      expect(
        await migrateImageReferences(
          [
            `${CACHE}ImagePicker/gone.jpg`,
            `${DOCS}images/characters/kept.jpg`,
            'https://cdn.test/remote.jpg',
          ],
          'characters'
        )
      ).toEqual([
        'lore-file://images/characters/kept.jpg',
        'https://cdn.test/remote.jpg',
      ]);
    });

    it('passes an empty or absent list through untouched', async () => {
      expect(
        await migrateImageReferences(undefined, 'characters')
      ).toBeUndefined();
      const empty: string[] = [];
      expect(await migrateImageReferences(empty, 'characters')).toBe(empty);
    });

    it('leaves a shape this app has never written for someone who knows', async () => {
      const uris = ['content://media/external/images/1'];

      expect(await migrateImageReferences(uris, 'characters')).toBe(uris);
    });

    it('is idempotent — a second pass changes nothing', async () => {
      onDisk(
        `${CACHE}ImagePicker/x.jpg`,
        `${DOCS}images/events/generated-uuid.jpg`
      );

      const once = await migrateImageReferences(
        [`${CACHE}ImagePicker/x.jpg`],
        'events'
      );
      expect(await migrateImageReferences(once, 'events')).toBe(once);
    });
  });

  describe('migrateRecordImages', () => {
    it('reports whether anything changed, and mutates only what did', async () => {
      onDisk(`${DOCS}images/characters/a.jpg`);
      const records = [
        { imageUris: [`${DOCS}images/characters/a.jpg`] },
        { imageUris: ['https://cdn.test/b.jpg'] },
        {},
      ];

      expect(await migrateRecordImages(records, 'characters')).toBe(true);
      expect(records[0].imageUris).toEqual([
        'lore-file://images/characters/a.jpg',
      ]);
      expect(records[1].imageUris).toEqual(['https://cdn.test/b.jpg']);
    });

    it('reports false when every record is already current', async () => {
      onDisk(`${DOCS}images/characters/a.jpg`);
      const records = [{ imageUris: ['lore-file://images/characters/a.jpg'] }];

      expect(await migrateRecordImages(records, 'characters')).toBe(false);
    });
  });

  describe('collectManagedUris', () => {
    it('gathers managed references only — nothing else is sweepable', () => {
      const into = new Set<string>();

      collectManagedUris(
        [
          { imageUris: ['lore-file://images/a.jpg', 'https://cdn.test/b.jpg'] },
          { imageUris: ['lore-file://images/a.jpg'] },
          {},
        ],
        into
      );

      expect([...into]).toEqual(['lore-file://images/a.jpg']);
    });
  });
});
