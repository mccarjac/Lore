import { SafeAsyncStorageJSONParser } from './safeAsyncStorageJSONParser';
import { runExclusive } from './storageQueue';
import type { AutoSyncOutcome } from '@/datastores/types';
import type { SyncErrorKind } from './syncErrors';

const AUTO_SYNC_PREFS_KEY = 'gameCharacterManager_autosync_prefs';

export const DEFAULT_AUTO_SYNC_INTERVAL_MS = 60_000;
export const MIN_AUTO_SYNC_INTERVAL_MS = 30_000;
export const MAX_AUTO_SYNC_INTERVAL_MS = 60 * 60_000;

/** Why a store's auto-sync schedule stopped rescheduling itself. */
export type AutoSyncPauseReason =
  | 'auth'
  | 'forbidden'
  | 'notFound'
  | 'conflicts';

export interface AutoSyncStorePreferences {
  enabled: boolean;
  intervalMs: number;
}

export interface AutoSyncStoreState {
  lastRunAt?: string;
  lastOutcome?: AutoSyncOutcome;
  lastMessage?: string;
  lastErrorKind?: SyncErrorKind;
  /** Consecutive failures, for backoff. Reset on any non-`failed` outcome. */
  consecutiveFailures?: number;
  conflictsPending?: number;
  conflictLabels?: string[];
  pausedReason?: AutoSyncPauseReason;
  /**
   * The dataset fingerprint (`datasetFingerprint()`) as of the last run that
   * concluded cleanly (`'upToDate'` or `'synced'`). Compared against the
   * current fingerprint to decide whether a run should treat local data as
   * changed — store-agnostic, so the scheduler never needs to know any
   * particular store's own notion of a merge base.
   */
  lastSyncedFingerprint?: string;
}

export interface AutoSyncPreferences {
  /** Keyed by `DataStore.id`, so enabling one store says nothing about another. */
  stores: Record<string, AutoSyncStorePreferences>;
  state: Record<string, AutoSyncStoreState>;
}

export const DEFAULT_AUTO_SYNC_PREFERENCES: AutoSyncPreferences = {
  stores: {},
  state: {},
};

const DEFAULT_STORE_PREFERENCES: AutoSyncStorePreferences = {
  enabled: false,
  intervalMs: DEFAULT_AUTO_SYNC_INTERVAL_MS,
};

const clampInterval = (intervalMs: number): number =>
  Math.min(
    MAX_AUTO_SYNC_INTERVAL_MS,
    Math.max(MIN_AUTO_SYNC_INTERVAL_MS, intervalMs)
  );

const clampPreferences = (prefs: AutoSyncPreferences): AutoSyncPreferences => ({
  stores: Object.fromEntries(
    Object.entries(prefs.stores ?? {}).map(([storeId, storePrefs]) => [
      storeId,
      {
        enabled: storePrefs.enabled === true,
        intervalMs: clampInterval(
          storePrefs.intervalMs ?? DEFAULT_AUTO_SYNC_INTERVAL_MS
        ),
      },
    ])
  ),
  state: prefs.state ?? {},
});

/**
 * NOTE: intentionally NOT wrapped in `runExclusive` — it is called from
 * inside every mutator below, which already holds the key's lock (same-key
 * nesting deadlocks; see AGENTS.md and the `getGraphPreferences` precedent).
 * Merging a Partial over the defaults keeps stored data from older app
 * versions forward-compatible when fields are added.
 */
export const getAutoSyncPreferences =
  async (): Promise<AutoSyncPreferences> => {
    const stored =
      await SafeAsyncStorageJSONParser.getItem<Partial<AutoSyncPreferences>>(
        AUTO_SYNC_PREFS_KEY
      );
    return clampPreferences({
      ...DEFAULT_AUTO_SYNC_PREFERENCES,
      ...stored,
      stores: { ...(stored?.stores ?? {}) },
      state: { ...(stored?.state ?? {}) },
    });
  };

export const getAutoSyncStorePreferences = async (
  storeId: string
): Promise<AutoSyncStorePreferences> => {
  const prefs = await getAutoSyncPreferences();
  return prefs.stores[storeId] ?? DEFAULT_STORE_PREFERENCES;
};

export const setAutoSyncEnabled = (
  storeId: string,
  enabled: boolean
): Promise<AutoSyncPreferences> =>
  runExclusive(AUTO_SYNC_PREFS_KEY, async () => {
    const current = await getAutoSyncPreferences();
    const next: AutoSyncPreferences = {
      ...current,
      stores: {
        ...current.stores,
        [storeId]: {
          ...(current.stores[storeId] ?? DEFAULT_STORE_PREFERENCES),
          enabled,
        },
      },
    };
    await SafeAsyncStorageJSONParser.setItem(AUTO_SYNC_PREFS_KEY, next);
    return next;
  });

export const setAutoSyncInterval = (
  storeId: string,
  intervalMs: number
): Promise<AutoSyncPreferences> =>
  runExclusive(AUTO_SYNC_PREFS_KEY, async () => {
    const current = await getAutoSyncPreferences();
    const next: AutoSyncPreferences = {
      ...current,
      stores: {
        ...current.stores,
        [storeId]: {
          ...(current.stores[storeId] ?? DEFAULT_STORE_PREFERENCES),
          intervalMs: clampInterval(intervalMs),
        },
      },
    };
    await SafeAsyncStorageJSONParser.setItem(AUTO_SYNC_PREFS_KEY, next);
    return next;
  });

/** Record the outcome of a completed run, merging over any prior state. */
export const recordAutoSyncRun = (
  storeId: string,
  state: Partial<AutoSyncStoreState>
): Promise<AutoSyncPreferences> =>
  runExclusive(AUTO_SYNC_PREFS_KEY, async () => {
    const current = await getAutoSyncPreferences();
    const next: AutoSyncPreferences = {
      ...current,
      state: {
        ...current.state,
        [storeId]: {
          ...(current.state[storeId] ?? {}),
          ...state,
        },
      },
    };
    await SafeAsyncStorageJSONParser.setItem(AUTO_SYNC_PREFS_KEY, next);
    return next;
  });

/** Clear a store's pending-conflicts state, e.g. after a manual merge. */
export const clearAutoSyncConflicts = (
  storeId: string
): Promise<AutoSyncPreferences> =>
  runExclusive(AUTO_SYNC_PREFS_KEY, async () => {
    const current = await getAutoSyncPreferences();
    const existing = current.state[storeId] ?? {};
    const next: AutoSyncPreferences = {
      ...current,
      state: {
        ...current.state,
        [storeId]: {
          ...existing,
          conflictsPending: undefined,
          conflictLabels: undefined,
          pausedReason:
            existing.pausedReason === 'conflicts'
              ? undefined
              : existing.pausedReason,
        },
      },
    };
    await SafeAsyncStorageJSONParser.setItem(AUTO_SYNC_PREFS_KEY, next);
    return next;
  });

export const resetAutoSyncPreferences = (): Promise<AutoSyncPreferences> =>
  runExclusive(AUTO_SYNC_PREFS_KEY, async () => {
    await SafeAsyncStorageJSONParser.setItem(
      AUTO_SYNC_PREFS_KEY,
      DEFAULT_AUTO_SYNC_PREFERENCES
    );
    return DEFAULT_AUTO_SYNC_PREFERENCES;
  });
