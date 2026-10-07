import React, { useEffect } from 'react';
import { migrateStoredImages } from '@utils/characterStorage';

/**
 * Guarded at module scope rather than with a ref, so a remount — a fast
 * refresh, a ruleset swap, `LoreApp` rendered twice in a test — cannot start a
 * second pass. A second pass would be *correct* (the migration is idempotent),
 * but it would run the orphan sweep concurrently with the first pass's writes,
 * and a sweep racing a half-written keep-list is exactly the thing that must
 * not happen.
 */
let started: Promise<void> | null = null;

/**
 * Runs the one-time image-storage migration for the lifetime of the app.
 *
 * Records written before managed storage existed hold absolute paths — into
 * the OS cache for anything picked in a form, which is why clearing the cache
 * emptied every image slot. `migrateStoredImages()` re-homes what survives,
 * drops what did not, and reclaims files nothing points at.
 *
 * Mounted app-wide rather than per screen: the existing per-list-screen
 * `migrateRulesetFields()` calls only ever cover the collection whose list you
 * opened, and locations, events and factions all carry images too.
 */
export const StoredImageMigrationHost: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  useEffect(() => {
    started ??= migrateStoredImages().catch(error => {
      console.error('Image storage migration failed:', error);
    });
  }, []);

  return <>{children}</>;
};
