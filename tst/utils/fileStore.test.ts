import * as FileSystem from 'expo-file-system/legacy';
import {
  deleteManagedFile,
  extensionOf,
  fileExists,
  isLocalFileUri,
  isManagedUri,
  listManagedFiles,
  managedRelativePath,
  persistFile,
  persistImage,
  resolveFileUri,
  sweepOrphanFiles,
  toManagedUri,
} from '@utils/fileStore';

jest.mock('uuid', () => ({ v4: () => 'generated-uuid' }));

const DOCS = 'file://mock-document-directory/';

/**
 * `documentDirectory` is a module constant, so the web case (where it is null)
 * is only reachable by replacing it on the mock for the duration of a test.
 */
const withoutDocumentDirectory = async (body: () => Promise<void> | void) => {
  const replaced = jest.replaceProperty(
    FileSystem as { documentDirectory: string | null },
    'documentDirectory',
    null
  );
  try {
    await body();
  } finally {
    replaced.restore();
  }
};

describe('fileStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('URI classification', () => {
    it('round-trips a relative path through the managed scheme', () => {
      const uri = toManagedUri('images/characters/a.jpg');
      expect(uri).toBe('lore-file://images/characters/a.jpg');
      expect(isManagedUri(uri)).toBe(true);
      expect(managedRelativePath(uri)).toBe('images/characters/a.jpg');
    });

    it('tolerates a leading slash on the relative path', () => {
      expect(toManagedUri('/images/a.jpg')).toBe('lore-file://images/a.jpg');
    });

    it('reports non-managed URIs as such', () => {
      expect(isManagedUri('file:///photos/a.jpg')).toBe(false);
      expect(managedRelativePath('data:image/png;base64,QUJD')).toBeNull();
    });

    it('counts managed and absolute URIs as ours to read, nothing else', () => {
      expect(isLocalFileUri('lore-file://images/a.jpg')).toBe(true);
      expect(isLocalFileUri('file:///photos/a.jpg')).toBe(true);
      expect(isLocalFileUri('/photos/a.jpg')).toBe(true);
      expect(isLocalFileUri('https://example.com/a.jpg')).toBe(false);
      expect(isLocalFileUri('data:image/png;base64,QUJD')).toBe(false);
    });

    it('reads a file extension, lowercased', () => {
      expect(extensionOf('images/a.PNG')).toBe('png');
      // The archive format's long-standing quirk: no dot means no split, so
      // the whole string comes back. `persistImage` guards against it below.
      expect(extensionOf('images/no-extension')).toBe('images/no-extension');
    });
  });

  describe('resolveFileUri', () => {
    it('expands a managed URI against the current documents directory', () => {
      expect(resolveFileUri('lore-file://images/characters/a.jpg')).toBe(
        `${DOCS}images/characters/a.jpg`
      );
    });

    it('leaves data, remote and legacy absolute URIs alone', () => {
      for (const uri of [
        'data:image/png;base64,QUJD',
        'https://cdn.example.com/a.jpg',
        'file:///old-container/Documents/images/a.jpg',
      ]) {
        expect(resolveFileUri(uri)).toBe(uri);
      }
    });
  });

  describe('persistFile', () => {
    it('creates the directory, copies, and returns a managed URI', async () => {
      const stored = await persistFile(
        'file://mock-cache-directory/ImagePicker/x.jpg',
        'images/characters/a.jpg'
      );

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        `${DOCS}images/characters/`,
        { intermediates: true }
      );
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: 'file://mock-cache-directory/ImagePicker/x.jpg',
        to: `${DOCS}images/characters/a.jpg`,
      });
      expect(stored).toBe('lore-file://images/characters/a.jpg');
    });

    it('resolves a managed source before copying', async () => {
      await persistFile('lore-file://images/characters/a.jpg', 'images/b.jpg');

      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: `${DOCS}images/characters/a.jpg`,
        to: `${DOCS}images/b.jpg`,
      });
    });

    it('passes a remote URL straight through — there is nothing to copy', async () => {
      const uri = 'https://cdn.example.com/a.jpg';
      expect(await persistFile(uri, 'images/a.jpg')).toBe(uri);
      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    });

    it('is a no-op on web, where there is no documents directory', async () => {
      await withoutDocumentDirectory(async () => {
        const uri = 'blob:http://localhost/abc';
        expect(await persistFile(uri, 'images/a.jpg')).toBe(uri);
        expect(FileSystem.copyAsync).not.toHaveBeenCalled();
      });
    });
  });

  describe('persistImage', () => {
    it('names the copy by uuid under the collection, keeping the extension', async () => {
      const stored = await persistImage(
        'file://mock-cache-directory/ImagePicker/IMG_0001.PNG',
        'locations'
      );

      expect(stored).toBe('lore-file://images/locations/generated-uuid.png');
    });

    it('falls back to jpg rather than letting a dotless URI shape the path', async () => {
      const stored = await persistImage(
        'file://mock-cache-directory/ImagePicker/no-extension',
        'locations'
      );

      expect(stored).toBe('lore-file://images/locations/generated-uuid.jpg');
    });
  });

  describe('fileExists', () => {
    it('resolves a managed URI before asking the filesystem', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
      });

      expect(await fileExists('lore-file://images/a.jpg')).toBe(true);
      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(
        `${DOCS}images/a.jpg`
      );
    });

    it('is false for a missing file, a remote URL, and a throwing lookup', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });
      expect(await fileExists('lore-file://images/a.jpg')).toBe(false);

      expect(await fileExists('https://cdn.example.com/a.jpg')).toBe(false);

      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('x'));
      expect(await fileExists('lore-file://images/a.jpg')).toBe(false);
    });
  });

  describe('listManagedFiles', () => {
    it('walks each managed root recursively', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(
        (dir: string) => {
          if (dir === `${DOCS}images/`) return Promise.resolve(['characters']);
          if (dir === `${DOCS}images/characters/`)
            return Promise.resolve(['a.jpg', 'b.jpg']);
          if (dir === `${DOCS}discord_images/`)
            return Promise.resolve(['c.png']);
          return Promise.reject(new Error('no such directory'));
        }
      );
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(
        (path: string) =>
          Promise.resolve({
            exists: true,
            isDirectory: path.endsWith('characters'),
          })
      );

      expect(await listManagedFiles()).toEqual([
        'images/characters/a.jpg',
        'images/characters/b.jpg',
        'discord_images/c.png',
      ]);
    });

    it('treats a missing root as empty rather than an error', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockRejectedValue(
        new Error('no such directory')
      );

      expect(await listManagedFiles()).toEqual([]);
    });
  });

  describe('deleteManagedFile', () => {
    it('swallows a failed delete — a file we cannot remove is not an error', async () => {
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('x'));

      await expect(deleteManagedFile('images/a.jpg')).resolves.toBeUndefined();
    });
  });

  describe('sweepOrphanFiles', () => {
    beforeEach(() => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(
        (dir: string) =>
          dir === `${DOCS}images/`
            ? Promise.resolve(['kept.jpg', 'orphan.jpg'])
            : Promise.reject(new Error('no such directory'))
      );
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        isDirectory: false,
      });
    });

    it('deletes only the files no record refers to', async () => {
      const removed = await sweepOrphanFiles(
        new Set(['lore-file://images/kept.jpg'])
      );

      expect(removed).toBe(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        `${DOCS}images/orphan.jpg`,
        { idempotent: true }
      );
    });

    it('ignores references that are not managed — they live outside the roots', async () => {
      const removed = await sweepOrphanFiles(
        new Set(['https://cdn.example.com/kept.jpg'])
      );

      expect(removed).toBe(2);
    });
  });
});
