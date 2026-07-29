/**
 * Turning a campaign's stored images into something a PDF can hold (#28).
 *
 * The document is produced by handing one HTML string to the platform's print
 * engine, which means every picture has to be *inside* that string as a `data:`
 * URI. A `file://` path would resolve against the print WebView rather than the
 * app, and a remote URL would race the snapshot.
 *
 * URI classification is shared with the local JSON store rather than repeated:
 * `extractImageData`, `isLocalFileUri` and `extensionOf` all come from
 * `json/fileArchive.ts`, which is where the same three shapes are already
 * distinguished on the way into a `.zip`.
 *
 * **Nothing here fails an export.** An unreadable file, a dead URL, an image
 * too large to embed — each is simply absent from the returned map, and the
 * renderer prints a visible note in its place. A campaign is still worth
 * printing without one of its photographs.
 */

import * as FileSystem from 'expo-file-system/legacy';
import {
  extensionOf,
  extractImageData,
  isLocalFileUri,
} from '../json/fileArchive';
import {
  collectImageUris,
  type CampaignDataset,
  type ResolvedImages,
} from './dataset';

/**
 * Budgets, in bytes of decoded image data.
 *
 * These exist because the HTML string is handed to a WebView in one piece and
 * base64 inflates whatever it carries by a third: a campaign with fifty
 * full-resolution phone photographs would produce a document no print engine
 * will render, and the failure mode is a crash rather than a large file. The
 * numbers are a judgement call — roughly "a photograph, not a RAW file" and
 * "a document that still opens on a phone".
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 24 * 1024 * 1024;

/**
 * Extension to mime type. `extensionOf` returns the file suffix, and a `data:`
 * URI has to name a type the print engine recognizes — `image/jpg` is not one.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const mimeTypeOf = (uri: string): string =>
  MIME_BY_EXTENSION[extensionOf(uri)] ?? 'image/jpeg';

/**
 * Decoded size of the base64 payload in a `data:` URI, near enough for a budget.
 *
 * Measured from the offset rather than by slicing the payload out: these are
 * megabyte-scale strings, and allocating a copy of one only to ask its length
 * would spend the memory the budget exists to protect.
 */
const decodedBytes = (dataUri: string): number => {
  const payloadLength = dataUri.length - (dataUri.indexOf(',') + 1);
  return Math.floor((payloadLength * 3) / 4);
};

const isRemoteUri = (uri: string): boolean => /^https?:\/\//i.test(uri);

/** Cache first, documents as the fallback — as everywhere else in the stores. */
const workingDirectory = (): string =>
  FileSystem.cacheDirectory || FileSystem.documentDirectory || '';

/**
 * Read a local file as base64, refusing one that is too big to embed.
 *
 * The size is checked with `getInfoAsync` *before* the read so an oversized
 * image is never pulled into a JavaScript string in the first place — the point
 * of the budget is to avoid the allocation, not to discard it afterwards.
 */
const readLocalImage = async (
  path: string,
  displayUri: string
): Promise<string | null> => {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    return null;
  }
  if (typeof info.size === 'number' && info.size > MAX_IMAGE_BYTES) {
    return null;
  }

  const base64 = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeTypeOf(displayUri)};base64,${base64}`;
};

/**
 * Fetch a remote image into the cache, read it, and clean up.
 *
 * Discord attachments are normally downloaded to disk on ingestion, but a
 * message's `imageUris` can still hold the original CDN URL — an import of a
 * bare `.json`, or a download that never completed. Reaching the network during
 * an export is the only way that picture appears in the document.
 */
const readRemoteImage = async (uri: string): Promise<string | null> => {
  const tempPath = `${workingDirectory()}pdf_image_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.${extensionOf(uri)}`;

  try {
    const download = await FileSystem.downloadAsync(uri, tempPath);
    if (download.status !== 200) {
      return null;
    }
    return await readLocalImage(tempPath, uri);
  } finally {
    await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(
      () => undefined
    );
  }
};

/**
 * Resolve every image in the dataset to an inline `data:` URI.
 *
 * A URI absent from the returned map could not be embedded, for any reason;
 * the caller does not need to know which.
 */
export const resolveDatasetImages = async (
  dataset: CampaignDataset
): Promise<ResolvedImages> => {
  const resolved: ResolvedImages = new Map();
  let totalBytes = 0;

  for (const uri of collectImageUris(dataset)) {
    let dataUri: string | null = null;

    try {
      if (uri.startsWith('data:')) {
        // Already inline. Parsed rather than trusted, so a malformed blob is
        // dropped here instead of producing a broken <img> in the document.
        dataUri = extractImageData(uri) ? uri : null;
      } else if (isLocalFileUri(uri)) {
        dataUri = await readLocalImage(uri, uri);
      } else if (isRemoteUri(uri)) {
        dataUri = await readRemoteImage(uri);
      }
    } catch {
      // Unreadable file, failed download, out-of-memory read — the omission
      // note in the document is a better outcome than no document.
      dataUri = null;
    }

    if (!dataUri) {
      continue;
    }

    const bytes = decodedBytes(dataUri);
    if (bytes > MAX_IMAGE_BYTES || totalBytes + bytes > MAX_TOTAL_IMAGE_BYTES) {
      // Over budget. Skipped rather than truncating the run, so a single huge
      // photograph does not cost every smaller one that follows it.
      continue;
    }

    totalBytes += bytes;
    resolved.set(uri, dataUri);
  }

  return resolved;
};
