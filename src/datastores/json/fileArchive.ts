/**
 * Image handling for the archive format the local JSON store reads and writes.
 *
 * An export is a `.zip` holding `data.json` plus an `images/<collection>/`
 * tree; every record's `imageUris` are rewritten to archive-relative paths on
 * the way out and back to permanent on-device paths on the way in. That is the
 * only reason this file exists — the dataset itself is plain JSON.
 *
 * These helpers used to be three near-identical copies inside
 * `utils/exportImport.ts` (one per operation), each with four near-identical
 * per-collection loops inside it. Collapsing them is why the collection is a
 * parameter here rather than a branch.
 *
 * The awkward part of the format, preserved deliberately: **factions are keyed
 * by a sanitized name, not an id** — `StoredFaction` has no id — so the
 * filename cannot round-trip through `find(f => f.id === …)` like the others.
 */

import * as FileSystem from 'expo-file-system/legacy';

/** Collections whose records carry images, in archive-path order. */
export const IMAGE_COLLECTIONS = [
  'characters',
  'locations',
  'events',
  'factions',
] as const;

export type ImageCollection = (typeof IMAGE_COLLECTIONS)[number];

/** A record we only ever touch the image fields of. */
interface ImageBearingRecord {
  id?: string;
  name?: string;
  imageUris?: string[];
  /** Predates the `imageUris` migration; read-only tolerance, never written. */
  imageUri?: string;
}

interface ArchiveDataset {
  characters?: ImageBearingRecord[];
  locations?: ImageBearingRecord[];
  events?: ImageBearingRecord[];
  factions?: ImageBearingRecord[];
  discord?: { messages?: ImageBearingRecord[] };
}

/** Filenames come from user-authored names, so anything unsafe becomes `_`. */
export const sanitizeForFilename = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, '_');

/**
 * A faction's archive key is its sanitized name; everything else uses its id.
 */
const archiveKeyOf = (
  record: ImageBearingRecord,
  collection: ImageCollection
): string | undefined =>
  collection === 'factions'
    ? record.name && sanitizeForFilename(record.name)
    : record.id;

export const extractImageData = (
  dataUri: string
): { mimeType: string; base64Data: string; extension: string } | null => {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    return null;
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split('/')[1] || 'jpg';

  return { mimeType, base64Data, extension };
};

const isLocalFileUri = (uri: string): boolean =>
  uri.startsWith('file://') || uri.startsWith('/');

const extensionOf = (uri: string): string =>
  uri.split('.').pop()?.toLowerCase() || 'jpg';

/**
 * Copy one image into the staging directory, returning its archive-relative
 * path — or `null` when there is nothing to copy (an unreadable file, or a
 * URI shape we do not own). A URI that is already relative or remote is
 * carried through unchanged by the caller rather than routed here.
 */
const stageImage = async (
  uri: string,
  stagingDir: string,
  archivePath: string
): Promise<string | null> => {
  if (uri.startsWith('data:')) {
    const imageData = extractImageData(uri);
    if (!imageData) {
      return null;
    }
    const filename = `${archivePath}.${imageData.extension}`;
    await FileSystem.writeAsStringAsync(
      stagingDir + filename,
      imageData.base64Data,
      { encoding: FileSystem.EncodingType.Base64 }
    );
    return filename;
  }

  if (isLocalFileUri(uri)) {
    try {
      const filename = `${archivePath}.${extensionOf(uri)}`;
      await FileSystem.copyAsync({ from: uri, to: stagingDir + filename });
      return filename;
    } catch {
      // Image file not accessible — the dataset is still worth exporting.
      return null;
    }
  }

  return null;
};

/**
 * Rewrite one collection's `imageUris` onto archive-relative paths, writing
 * each image into `stagingDir`. Returns how many images were staged.
 *
 * Mutates the records in place — the caller owns a parsed copy of the dataset,
 * never live storage.
 */
export const stageCollectionImages = async (
  records: ImageBearingRecord[] | undefined,
  collection: ImageCollection,
  stagingDir: string
): Promise<number> => {
  if (!records) {
    return 0;
  }

  let staged = 0;

  for (const record of records) {
    const key = archiveKeyOf(record, collection);
    if (!key) {
      continue;
    }

    if (record.imageUris && record.imageUris.length > 0) {
      const processed: string[] = [];
      for (let i = 0; i < record.imageUris.length; i++) {
        const uri = record.imageUris[i];
        if (!uri) {
          continue;
        }
        const filename = await stageImage(
          uri,
          stagingDir,
          `images/${collection}/${key}_${i}`
        );
        if (filename) {
          processed.push(filename);
          staged++;
        } else if (!uri.startsWith('data:') && !isLocalFileUri(uri)) {
          // Already a relative/remote path — carry it over as-is.
          processed.push(uri);
        }
      }
      if (processed.length > 0) {
        record.imageUris = processed;
      }
      continue;
    }

    // A legacy single image from data predating the `imageUris` migration.
    // Read-only tolerance: normalize onto `imageUris` and never write the
    // deprecated field back out.
    if (record.imageUri) {
      const legacyUri = record.imageUri;
      const filename = await stageImage(
        legacyUri,
        stagingDir,
        `images/${collection}/${key}`
      );
      if (filename) {
        record.imageUris = [filename];
        staged++;
      } else if (!legacyUri.startsWith('data:') && !isLocalFileUri(legacyUri)) {
        record.imageUris = [legacyUri];
      }
      delete record.imageUri;
    }
  }

  return staged;
};

/** Stage every image-bearing collection, plus Discord's file-only images. */
export const stageDatasetImages = async (
  dataset: ArchiveDataset,
  stagingDir: string
): Promise<number> => {
  let staged = 0;

  for (const collection of IMAGE_COLLECTIONS) {
    staged += await stageCollectionImages(
      dataset[collection],
      collection,
      stagingDir
    );
  }

  // Discord images are always downloaded files — never data URIs — and their
  // messages are not part of the id-keyed restore below, so they are staged
  // but never read back onto records on import.
  const messages = dataset.discord?.messages;
  if (messages) {
    for (const message of messages) {
      if (!message.id || !message.imageUris?.length) {
        continue;
      }
      const processed: string[] = [];
      for (let i = 0; i < message.imageUris.length; i++) {
        const uri = message.imageUris[i];
        if (!uri) {
          continue;
        }
        if (isLocalFileUri(uri)) {
          const filename = await stageImage(
            uri,
            stagingDir,
            `images/discord/${message.id}_${i}`
          );
          if (filename) {
            processed.push(filename);
            staged++;
          }
        } else {
          processed.push(uri);
        }
      }
      if (processed.length > 0) {
        message.imageUris = processed;
      }
    }
  }

  return staged;
};

/** Every directory the staging tree needs before anything is written into it. */
export const createStagingTree = async (stagingDir: string): Promise<void> => {
  await FileSystem.makeDirectoryAsync(stagingDir, { intermediates: true });
  for (const collection of [...IMAGE_COLLECTIONS, 'discord']) {
    await FileSystem.makeDirectoryAsync(`${stagingDir}images/${collection}/`, {
      intermediates: true,
    });
  }
};

export const readDirRecursive = async (
  dirPath: string
): Promise<{ path: string; isDirectory: boolean }[]> => {
  const items = await FileSystem.readDirectoryAsync(dirPath);
  const results: { path: string; isDirectory: boolean }[] = [];

  for (const item of items) {
    const itemPath = dirPath + item;
    const info = await FileSystem.getInfoAsync(itemPath);
    if (info.isDirectory) {
      results.push({ path: itemPath + '/', isDirectory: true });
      results.push(...(await readDirRecursive(itemPath + '/')));
    } else {
      results.push({ path: itemPath, isDirectory: false });
    }
  }

  return results;
};

const collectionOfPath = (path: string): ImageCollection | undefined =>
  IMAGE_COLLECTIONS.find(collection => path.includes(`/${collection}/`));

const findByArchiveKey = (
  records: ImageBearingRecord[] | undefined,
  collection: ImageCollection,
  key: string
): ImageBearingRecord | undefined =>
  records?.find(record => archiveKeyOf(record, collection) === key);

/**
 * Copy an extracted archive's images into permanent app storage and point the
 * dataset's `imageUris` at them.
 *
 * Images are restored as **file URIs, not base64 data URIs** — a dataset that
 * inlined every image would be re-serialized into AsyncStorage on every write.
 */
export const restoreImagesFromArchive = async (
  extractedDir: string,
  dataset: ArchiveDataset
): Promise<void> => {
  const allFiles = await readDirRecursive(extractedDir);
  const imageFiles = allFiles.filter(
    file => !file.isDirectory && file.path.includes('/images/')
  );
  if (imageFiles.length === 0) {
    return;
  }

  const permanentImageDir = FileSystem.documentDirectory + 'images/';
  for (const collection of IMAGE_COLLECTIONS) {
    await FileSystem.makeDirectoryAsync(permanentImageDir + collection + '/', {
      intermediates: true,
    });
  }

  // collection -> archive key -> index -> permanent path
  const restored: Record<string, Record<string, Record<number, string>>> = {};

  for (const file of imageFiles) {
    const filename = file.path.split('/').pop();
    const collection = collectionOfPath(file.path);
    if (!filename || !collection) {
      continue;
    }

    // `key_index.ext`, falling back to `key.ext` for pre-multi-image exports.
    const match =
      filename.match(/^(.+?)_(\d+)\.[^.]+$/) || filename.match(/^(.+)\.[^.]+$/);
    if (!match) {
      continue;
    }
    const key = match[1];
    const index = match[2] ? parseInt(match[2], 10) : 0;

    const permanentPath = `${permanentImageDir}${collection}/${filename}`;
    await FileSystem.copyAsync({ from: file.path, to: permanentPath });

    restored[collection] ??= {};
    restored[collection][key] ??= {};
    restored[collection][key][index] = permanentPath;
  }

  for (const [collection, byKey] of Object.entries(restored)) {
    for (const [key, byIndex] of Object.entries(byKey)) {
      const record = findByArchiveKey(
        dataset[collection as ImageCollection],
        collection as ImageCollection,
        key
      );
      if (!record) {
        continue;
      }
      record.imageUris = Object.keys(byIndex)
        .map(index => parseInt(index, 10))
        .sort((a, b) => a - b)
        .map(index => byIndex[index]);
    }
  }
};

/**
 * Drop the deprecated single `imageUri` from every record.
 *
 * Used on the bare-`.json` path, which carries no image assets at all: a
 * legacy `imageUri` there is a `data:` blob or a device-local path from
 * another install, so backfilling it into `imageUris` would produce a broken
 * reference rather than a picture.
 */
export const stripLegacyImageUris = (dataset: ArchiveDataset): void => {
  for (const collection of IMAGE_COLLECTIONS) {
    dataset[collection]?.forEach(record => {
      delete record.imageUri;
    });
  }
};
