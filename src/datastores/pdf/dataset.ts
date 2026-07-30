/**
 * What a campaign dataset looks like to the PDF store, and how to walk its
 * images (#28).
 *
 * This module is deliberately **free of native imports** so that both the
 * renderer (`campaignHtml.ts`) and the resolver (`images.ts`) can share it —
 * the renderer's whole testing story is that it reaches no Expo module, and a
 * shared helper that imported `expo-file-system` would take that away.
 */

import type { DiscordDataset } from '@models/types';
import type { SyncDataset } from '@utils/syncMerge';

/**
 * The shape `DataStoreContext.exportDataset()` serializes, with Discord typed.
 *
 * `SyncDataset` is reused rather than redeclared — it already names exactly the
 * five collections `characterStorage.exportDataset()` emits, and it types
 * `factions` as `StoredFaction` (no `id`, keyed by name), which is the detail
 * most easily got wrong. Every collection is optional here even though the
 * exporter always writes all five: a store is also handed hand-edited and
 * older datasets, and a missing key must render an empty chapter rather than
 * throw.
 */
export interface CampaignDataset extends Partial<Omit<SyncDataset, 'discord'>> {
  discord?: DiscordDataset;
}

/** Original image URI -> an inline `data:` URI safe to embed in the document. */
export type ResolvedImages = Map<string, string>;

/** A record we only ever read the image fields of. */
interface ImageBearingRecord {
  imageUris?: string[];
  /** Predates the `imageUris` migration; tolerated on read, as everywhere. */
  imageUri?: string;
}

/**
 * Every image on one record, newest field first.
 *
 * The legacy single `imageUri` is read only when `imageUris` is empty, which
 * matches `json/fileArchive.ts`'s treatment: data written before the migration
 * still has it, and dropping it would silently lose pictures from the document.
 */
export const imageUrisOf = (record: ImageBearingRecord): string[] => {
  if (record.imageUris && record.imageUris.length > 0) {
    return record.imageUris.filter(Boolean);
  }
  return record.imageUri ? [record.imageUri] : [];
};

/**
 * Every distinct image URI in the dataset, in the order the document renders
 * them.
 *
 * Quests are included here even though `json/fileArchive.ts`'s
 * `IMAGE_COLLECTIONS` omits them: `GameQuest` declares `imageUris`, so a quest
 * photo exists on device and belongs in a document claiming to hold all
 * campaign data. (That the `.zip` export drops it is a separate gap, not one
 * to reproduce.)
 */
export const collectImageUris = (dataset: CampaignDataset): string[] => {
  const uris = new Set<string>();

  const add = (records: ImageBearingRecord[] | undefined): void => {
    records?.forEach(record =>
      imageUrisOf(record).forEach(uri => uris.add(uri))
    );
  };

  add(dataset.characters);
  add(dataset.factions);
  add(dataset.locations);
  add(dataset.events);
  add(dataset.quests);
  add(dataset.discord?.messages);

  return [...uris];
};
