/**
 * Where app-owned files live, and how a stored record addresses one.
 *
 * Two separate bugs motivated this module, and it fixes both:
 *
 * 1. **The cache is not storage.** `expo-image-picker` hands back a URI inside
 *    the OS cache container. Persisting that string means the record keeps a
 *    path the operating system is free to delete the moment it wants space —
 *    which is exactly what "clear cache" does. Every picked image has to be
 *    *copied* somewhere durable before its URI is worth writing down.
 * 2. **An absolute path is not a durable address.** iOS rotates the app
 *    container's UUID on reinstall and on a device restore, so a
 *    `file:///…/<old-uuid>/Documents/images/x.jpg` written last month no longer
 *    names a file that exists, even though the bytes are still on disk.
 *
 * So a stored reference is a **managed URI** — `lore-file://` plus a path
 * relative to `FileSystem.documentDirectory` — and the absolute path is
 * recomputed at the moment of use. `resolveFileUri()` is the only thing that
 * turns one back into something `<Image>` or `FileSystem` can read; nothing
 * else should concatenate `documentDirectory` itself.
 *
 * The on-disk layout (`images/<collection>/`, `discord_images/`) is the one the
 * archive-restore and GitHub-pull paths already wrote into, so no existing file
 * has to move — only the way it is referred to changes.
 *
 * **Web** has no filesystem: `documentDirectory` is null under
 * react-native-web, so `persistFile` is a pass-through and nothing managed is
 * ever created. Every helper here degrades to identity rather than throwing.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';

/** Prefix marking a URI as "ours, relative to the documents directory". */
export const MANAGED_URI_SCHEME = 'lore-file://';

/**
 * Directories under `documentDirectory` that this module owns. The orphan
 * sweep only ever deletes inside these, so adding a root is the one way to put
 * new files under its control.
 */
export const MANAGED_ROOTS = ['images', 'discord_images'] as const;

/**
 * The file suffix, lowercased, defaulting to `jpg` for an empty one.
 *
 * Moved here verbatim from `json/fileArchive.ts`, quirk included: a URI with no
 * dot at all returns the whole string, because the archive format has always
 * relied on that and changing it would rename files in existing exports.
 * `safeExtension` below is what new filenames are built from.
 */
export const extensionOf = (uri: string): string =>
  uri.split('.').pop()?.toLowerCase() || 'jpg';

/**
 * `extensionOf` constrained to something safe to put in a path.
 *
 * A picked URI without a dot would otherwise contribute its own slashes to the
 * filename we are constructing, writing the copy somewhere nobody is looking
 * for it.
 */
const safeExtension = (uri: string): string => {
  const extension = extensionOf(uri);
  return /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'jpg';
};

export const isManagedUri = (uri: string): boolean =>
  uri.startsWith(MANAGED_URI_SCHEME);

/**
 * A URI whose bytes are on this device and ours to read — a managed reference,
 * or a bare absolute path from before managed references existed.
 *
 * Shared with the export paths (`json/fileArchive.ts`, `pdf/images.ts`) so
 * "is this ours?" has one definition rather than two that drift.
 */
export const isLocalFileUri = (uri: string): boolean =>
  isManagedUri(uri) || uri.startsWith('file://') || uri.startsWith('/');

/** `images/characters/x.jpg` -> `lore-file://images/characters/x.jpg`. */
export const toManagedUri = (relativePath: string): string =>
  `${MANAGED_URI_SCHEME}${relativePath.replace(/^\/+/, '')}`;

/** The inverse of `toManagedUri`; `null` for anything not managed. */
export const managedRelativePath = (uri: string): string | null =>
  isManagedUri(uri) ? uri.slice(MANAGED_URI_SCHEME.length) : null;

/** Where managed files live right now. Empty string on web. */
export const managedRoot = (): string => FileSystem.documentDirectory || '';

/**
 * Turn a stored reference into something `<Image>` or `FileSystem` can read.
 *
 * Synchronous on purpose — `documentDirectory` is a constant, so a render path
 * never has to await, and `<StoredImage>` stays a plain wrapper around
 * `<Image>` rather than a component with loading state.
 *
 * Anything that is not a managed URI is returned untouched: `data:` payloads,
 * remote `http(s)` URLs and pre-migration absolute paths all still resolve the
 * way they always did.
 */
export const resolveFileUri = (uri: string): string => {
  const relative = managedRelativePath(uri);
  return relative === null ? uri : managedRoot() + relative;
};

/**
 * `true` when the reference names a file that is actually on disk.
 *
 * Used by the migration to tell "this image moved" apart from "this image is
 * gone", which are the two halves of the reported bug.
 */
export const fileExists = async (uri: string): Promise<boolean> => {
  const resolved = resolveFileUri(uri);
  if (!resolved || !isLocalFileUri(resolved)) {
    return false;
  }
  try {
    const info = await FileSystem.getInfoAsync(resolved);
    return info.exists;
  } catch {
    return false;
  }
};

/** `makeDirectoryAsync` is fine with an existing directory when recursive. */
const ensureDirectoryFor = async (relativePath: string): Promise<void> => {
  const directory = relativePath.split('/').slice(0, -1).join('/');
  if (!directory) {
    return;
  }
  await FileSystem.makeDirectoryAsync(`${managedRoot()}${directory}/`, {
    intermediates: true,
  });
};

/**
 * Copy a file into managed storage, returning the managed URI to store.
 *
 * `sourceUri` may itself be managed (the migration re-homes files this way),
 * so it is resolved rather than assumed absolute. On web, and for a source we
 * cannot read as a file at all, the original URI is returned unchanged — a
 * remote URL is still a perfectly good thing for a record to hold.
 */
export const persistFile = async (
  sourceUri: string,
  relativePath: string
): Promise<string> => {
  if (!managedRoot() || !isLocalFileUri(sourceUri)) {
    return sourceUri;
  }
  await ensureDirectoryFor(relativePath);
  await FileSystem.copyAsync({
    from: resolveFileUri(sourceUri),
    to: `${managedRoot()}${relativePath}`,
  });
  return toManagedUri(relativePath);
};

/**
 * Copy a picked or downloaded image into `images/<collection>/`.
 *
 * The filename is a fresh uuid rather than anything derived from the source:
 * two picks of the same photo must not collide, and the archive format already
 * renames on the way out (`json/fileArchive.ts`), so nothing downstream reads
 * meaning from this name.
 */
export const persistImage = async (
  sourceUri: string,
  collection: string
): Promise<string> =>
  persistFile(
    sourceUri,
    `images/${collection}/${uuidv4()}.${safeExtension(sourceUri)}`
  );

/** Every file under a managed root, as `documentDirectory`-relative paths. */
const listUnder = async (relativeDir: string): Promise<string[]> => {
  let entries: string[];
  try {
    entries = await FileSystem.readDirectoryAsync(
      `${managedRoot()}${relativeDir}/`
    );
  } catch {
    // The directory simply does not exist yet — nothing to sweep.
    return [];
  }

  const found: string[] = [];
  for (const entry of entries) {
    const path = `${relativeDir}/${entry}`;
    const info = await FileSystem.getInfoAsync(`${managedRoot()}${path}`);
    if (info.isDirectory) {
      found.push(...(await listUnder(path)));
    } else {
      found.push(path);
    }
  }
  return found;
};

export const listManagedFiles = async (): Promise<string[]> => {
  if (!managedRoot()) {
    return [];
  }
  const found: string[] = [];
  for (const root of MANAGED_ROOTS) {
    found.push(...(await listUnder(root)));
  }
  return found;
};

export const deleteManagedFile = async (
  relativePath: string
): Promise<void> => {
  await FileSystem.deleteAsync(`${managedRoot()}${relativePath}`, {
    idempotent: true,
  }).catch(() => undefined);
};

/**
 * Delete every managed file no record refers to, returning how many went.
 *
 * This is what makes it safe to copy an image at *pick* time rather than at
 * save time: an abandoned form, a replaced portrait and a deleted character
 * all leave bytes behind, and none of them is worth a bespoke cleanup path.
 * `referenced` holds managed URIs; anything else a record carries lives
 * outside these roots by definition and cannot be swept.
 */
export const sweepOrphanFiles = async (
  referenced: ReadonlySet<string>
): Promise<number> => {
  const keep = new Set<string>();
  for (const uri of referenced) {
    const relative = managedRelativePath(uri);
    if (relative) {
      keep.add(relative);
    }
  }

  const files = await listManagedFiles();
  const orphans = files.filter(path => !keep.has(path));
  for (const path of orphans) {
    await deleteManagedFile(path);
  }
  return orphans.length;
};
