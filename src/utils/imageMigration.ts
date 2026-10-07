/**
 * Repairing image references written before managed storage existed.
 *
 * Data already on devices holds absolute paths of two kinds, and they fail
 * differently:
 *
 * - **Cache-container paths**, straight from `expo-image-picker`. Clearing the
 *   app cache deletes the file, so these are the blank placeholders users
 *   reported. Nothing local can bring those bytes back — the reference is
 *   dropped so the empty slot goes with it.
 * - **Documents-container paths**, written by archive-restore and GitHub-pull.
 *   The file is still there; only the absolute prefix is fragile (iOS rotates
 *   the container uuid on reinstall). These are rewritten to managed URIs in
 *   place, no copying.
 *
 * A file that is still readable but lives somewhere unmanaged is copied in
 * before its reference is rewritten, so a cache clear cannot reach it again.
 *
 * `data:` payloads and remote `http(s)` URLs are left exactly as they are:
 * neither depends on the filesystem, and the export paths already know how to
 * read both.
 *
 * Every helper returns the **same array reference** when nothing needed
 * changing — the same trick `rulesetFieldMigration.ts` uses so a steady-state
 * app pays reads and no writes.
 */

import {
  fileExists,
  isManagedUri,
  managedRoot,
  persistImage,
  toManagedUri,
} from './fileStore';

/** A record we only ever touch the image field of. */
export interface ImageBearingRecord {
  imageUris?: string[];
}

/**
 * The managed URI a stored reference should become, or `null` to drop it.
 *
 * `undefined` means "leave this string alone" — a `data:` or remote URI, which
 * has nothing to do with the filesystem.
 */
const migrateOne = async (
  uri: string,
  collection: string
): Promise<string | null | undefined> => {
  if (uri.startsWith('data:') || /^https?:\/\//i.test(uri)) {
    return undefined;
  }

  if (isManagedUri(uri)) {
    return (await fileExists(uri)) ? undefined : null;
  }

  if (!uri.startsWith('file://') && !uri.startsWith('/')) {
    // Not a shape this app has ever written; leave it for someone who knows.
    return undefined;
  }

  const root = managedRoot();
  if (root && uri.startsWith(root)) {
    // Already durable — only the address needs replacing.
    const managed = toManagedUri(uri.slice(root.length));
    return (await fileExists(managed)) ? managed : null;
  }

  if (!(await fileExists(uri))) {
    // The cache-clear casualty. The bytes are gone; the reference goes too.
    return null;
  }

  const persisted = await persistImage(uri, collection);
  return persisted === uri ? undefined : persisted;
};

/**
 * Migrate one record's `imageUris`, or return the input untouched.
 *
 * Returns the same reference when nothing changed, so a caller can skip a
 * write with `if (migrated === original)`.
 *
 * Not to be confused with `characterStorage.migrateImageUris()`, which folds
 * the deprecated singular `imageUri` field into this one. That runs first;
 * this decides what each resulting reference should become.
 */
export const migrateImageReferences = async (
  uris: string[] | undefined,
  collection: string
): Promise<string[] | undefined> => {
  if (!uris?.length) {
    return uris;
  }

  const migrated: string[] = [];
  let changed = false;

  for (const uri of uris) {
    const result = await migrateOne(uri, collection);
    if (result === undefined) {
      migrated.push(uri);
    } else if (result === null) {
      changed = true;
    } else {
      migrated.push(result);
      changed = true;
    }
  }

  return changed ? migrated : uris;
};

/**
 * Migrate a whole collection in place, returning `true` when anything changed.
 *
 * Mutates the records — every caller owns a freshly parsed dataset rather than
 * anything live, the same contract `json/fileArchive.ts` works under.
 */
export const migrateRecordImages = async (
  records: ImageBearingRecord[],
  collection: string
): Promise<boolean> => {
  let changed = false;
  for (const record of records) {
    const migrated = await migrateImageReferences(record.imageUris, collection);
    if (migrated !== record.imageUris) {
      record.imageUris = migrated;
      changed = true;
    }
  }
  return changed;
};

/** Every managed URI a set of records refers to — the sweep's keep-list. */
export const collectManagedUris = (
  records: ImageBearingRecord[],
  into: Set<string>
): void => {
  for (const record of records) {
    for (const uri of record.imageUris ?? []) {
      if (isManagedUri(uri)) {
        into.add(uri);
      }
    }
  }
};
