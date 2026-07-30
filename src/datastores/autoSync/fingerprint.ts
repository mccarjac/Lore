import type { SyncDataset } from '@utils/syncMerge';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const fnv1a = (input: string): string => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(36);
};

/**
 * A stable fingerprint of the sync-relevant portion of a locally exported
 * dataset. The auto-sync scheduler uses this to cheaply detect "did local
 * data change since the last successful sync" without a network call and
 * without needing to know any store's own notion of a merge base.
 *
 * Hashes only `characters`/`factions`/`locations`/`events`/`quests`,
 * deliberately excluding:
 *
 * - the dataset's top-level `lastUpdated` — `exportDataset()` stamps a fresh
 *   one on every single call (see `characterStorage.ts`), so a fingerprint
 *   over the raw JSON string would report "changed" on every check and never
 *   settle. Hashing only the collections sidesteps that entirely.
 * - `discord` — a Discord ingest has its own merge path and must not, on its
 *   own, be treated as a reason to push game data.
 *
 * This relies on `exportDataset()` already running
 * `sortDatasetDeterministically()` — without a stable array/key order the
 * same underlying data could hash differently between two calls.
 */
export const datasetFingerprint = (exportedJson: string): string => {
  const dataset = JSON.parse(exportedJson) as Partial<SyncDataset>;
  const relevant = JSON.stringify([
    dataset.characters ?? [],
    dataset.factions ?? [],
    dataset.locations ?? [],
    dataset.events ?? [],
    dataset.quests ?? [],
  ]);
  return fnv1a(relevant);
};
