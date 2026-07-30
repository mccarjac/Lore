import type {
  DataStore,
  DataStoreContext,
  AutoSyncReason,
  AutoSyncResult,
  AutoSyncOutcome,
} from '../types';
import {
  getAutoSyncPreferences,
  recordAutoSyncRun,
  DEFAULT_AUTO_SYNC_INTERVAL_MS,
  MIN_AUTO_SYNC_INTERVAL_MS,
  MAX_AUTO_SYNC_INTERVAL_MS,
  type AutoSyncPauseReason,
} from '@utils/autoSyncPreferences';
import { onLocalDataChanged } from '@utils/dataChangeSignal';
import type { SyncErrorKind } from '@utils/syncErrors';
import { datasetFingerprint } from './fingerprint';
import {
  getAppStateStatus,
  subscribeAppState,
  type AppStateStatus,
} from './appState';

/**
 * The engine-owned auto-sync scheduler (#31).
 *
 * A module-level singleton controller, not a React context — there is
 * nothing here a component needs to provide (unlike `RulesetProvider`, which
 * holds a value a consumer passes in), and a plain module means the
 * scheduler is testable without rendering anything. `useAutoSyncStatus`
 * reads it through `subscribe`.
 *
 * **Timers are a self-rescheduling `setTimeout` chain per store, never
 * `setInterval`.** With `setInterval`, a run that takes longer than the
 * interval queues an overlapping tick, and backoff needs a second mechanism
 * on top. With a chain, "run again in N ms" is the only scheduling
 * primitive there is, and backoff is just a different N.
 */

const LOCAL_CHANGE_DEBOUNCE_MS = 5_000;
const FOREGROUND_SETTLE_MS = 1_000;

const RATE_LIMIT_BACKOFF_MS = 15 * 60_000;
const OFFLINE_BASE_BACKOFF_MS = 60_000;
const UNKNOWN_BASE_BACKOFF_MS = 2 * 60_000;
const MAX_BACKOFF_MS = 15 * 60_000;

// A rejected token or an inaccessible repository will not fix itself by
// retrying — pause the schedule entirely rather than backing off forever.
// 'conflicts' is not a SyncErrorKind; it is this module's own reason a store
// gets suspended rather than backed off (re-polling recomputes the same
// conflict every tick for nothing).
const PAUSING_ERROR_KINDS: ReadonlySet<SyncErrorKind> = new Set([
  'auth',
  'forbidden',
  'notFound',
]);

export interface AutoSyncStatus {
  enabled: boolean;
  intervalMs: number;
  running: boolean;
  lastRunAt?: string;
  lastOutcome?: AutoSyncOutcome;
  lastMessage?: string;
  lastErrorKind?: SyncErrorKind;
  conflictsPending?: number;
  conflictLabels?: string[];
  pausedReason?: AutoSyncPauseReason;
}

interface ArmedStore {
  store: DataStore;
  timer?: ReturnType<typeof setTimeout>;
  debounceTimer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;
  consecutiveFailures: number;
  suspended: boolean;
}

let ctx: DataStoreContext | undefined;
let started = false;
let generation = 0;

const armed = new Map<string, ArmedStore>();
const statusCache = new Map<string, AutoSyncStatus>();
const listeners = new Set<() => void>();

let appStateUnsubscribe: (() => void) | undefined;
let localChangeUnsubscribe: (() => void) | undefined;

const notifyListeners = (): void => {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A subscriber's problem is not the scheduler's problem.
    }
  }
};

const clampInterval = (intervalMs: number): number =>
  Math.min(
    MAX_AUTO_SYNC_INTERVAL_MS,
    Math.max(MIN_AUTO_SYNC_INTERVAL_MS, intervalMs)
  );

const clearStoreTimer = (storeId: string): void => {
  const entry = armed.get(storeId);
  if (entry?.timer) {
    clearTimeout(entry.timer);
    entry.timer = undefined;
  }
};

const clearDebounceTimer = (storeId: string): void => {
  const entry = armed.get(storeId);
  if (entry?.debounceTimer) {
    clearTimeout(entry.debounceTimer);
    entry.debounceTimer = undefined;
  }
};

const updateStatus = (
  storeId: string,
  patch: Partial<AutoSyncStatus>
): void => {
  const current = statusCache.get(storeId);
  if (!current) return;
  statusCache.set(storeId, { ...current, ...patch });
  notifyListeners();
};

const backoffDelayMs = (
  entry: ArmedStore,
  errorKind: SyncErrorKind | undefined,
  baseIntervalMs: number
): number => {
  if (entry.consecutiveFailures === 0) return baseIntervalMs;
  if (errorKind === 'rateLimit') return RATE_LIMIT_BACKOFF_MS;

  const base =
    errorKind === 'offline'
      ? OFFLINE_BASE_BACKOFF_MS
      : errorKind === 'conflict'
        ? baseIntervalMs
        : UNKNOWN_BASE_BACKOFF_MS;

  return Math.min(base * 2 ** (entry.consecutiveFailures - 1), MAX_BACKOFF_MS);
};

const scheduleNext = (storeId: string, delayMs: number): void => {
  const entry = armed.get(storeId);
  if (!entry) return;
  clearStoreTimer(storeId);
  entry.timer = setTimeout(() => {
    void runStore(storeId, 'interval');
  }, delayMs);
};

const rescheduleAfterRun = (storeId: string): void => {
  const entry = armed.get(storeId);
  if (!entry) return;
  if (entry.suspended) return; // paused: only a refresh re-arms this store
  if (getAppStateStatus() !== 'active') return; // backgrounded: foreground re-arms

  const status = statusCache.get(storeId);
  const baseIntervalMs = status?.intervalMs ?? DEFAULT_AUTO_SYNC_INTERVAL_MS;
  const delayMs = backoffDelayMs(entry, status?.lastErrorKind, baseIntervalMs);
  scheduleNext(storeId, delayMs);
};

const applyRunResult = async (
  storeId: string,
  entry: ArmedStore,
  result: AutoSyncResult,
  fingerprint: string | undefined
): Promise<void> => {
  const now = new Date().toISOString();
  const isFailure = result.outcome === 'failed';
  const isConflict = result.outcome === 'conflicts';
  const concludedCleanly =
    result.outcome === 'upToDate' || result.outcome === 'synced';

  entry.consecutiveFailures = isFailure ? entry.consecutiveFailures + 1 : 0;
  entry.suspended =
    isConflict ||
    (isFailure &&
      !!result.errorKind &&
      PAUSING_ERROR_KINDS.has(result.errorKind));

  const statePatch: Parameters<typeof recordAutoSyncRun>[1] = {
    lastRunAt: now,
    lastOutcome: result.outcome,
    lastMessage: result.message,
    lastErrorKind: result.errorKind,
    consecutiveFailures: entry.consecutiveFailures,
  };

  if (isConflict) {
    statePatch.conflictsPending = result.conflicts?.length;
    statePatch.conflictLabels = result.conflicts?.map(c => c.label);
    statePatch.pausedReason = 'conflicts';
  } else if (concludedCleanly) {
    // A clean run means nothing is pending any more, and — since it
    // genuinely synchronized — this is the new baseline to compare against.
    statePatch.conflictsPending = undefined;
    statePatch.conflictLabels = undefined;
    statePatch.pausedReason = undefined;
    if (fingerprint !== undefined) {
      statePatch.lastSyncedFingerprint = fingerprint;
    }
  } else if (
    isFailure &&
    result.errorKind &&
    PAUSING_ERROR_KINDS.has(result.errorKind)
  ) {
    statePatch.pausedReason = result.errorKind as AutoSyncPauseReason;
  }
  // Any other failure (offline/rateLimit/unknown) or a 'skipped' outcome
  // leaves conflict state and the fingerprint baseline untouched by
  // omission — recordAutoSyncRun merges over the prior state, so an absent
  // key here means "no opinion", not "clear it".

  await recordAutoSyncRun(storeId, statePatch);

  updateStatus(storeId, {
    lastRunAt: now,
    lastOutcome: result.outcome,
    lastMessage: result.message,
    lastErrorKind: result.errorKind,
    conflictsPending: isConflict ? result.conflicts?.length : undefined,
    conflictLabels: isConflict
      ? result.conflicts?.map(c => c.label)
      : undefined,
    pausedReason: statePatch.pausedReason,
  });
};

const runStore = async (
  storeId: string,
  reason: AutoSyncReason
): Promise<AutoSyncResult | undefined> => {
  const entry = armed.get(storeId);
  if (!entry || entry.inFlight) return undefined;
  if (!ctx) return undefined;
  if (getAppStateStatus() !== 'active') return undefined;

  const autoSync = entry.store.autoSync;
  if (!autoSync) return undefined;

  entry.inFlight = true;
  updateStatus(storeId, { running: true });

  let result: AutoSyncResult;
  let fingerprintAfter: string | undefined;

  try {
    const fingerprintBefore = datasetFingerprint(await ctx.exportDataset());
    const prefs = await getAutoSyncPreferences();
    const priorFingerprint = prefs.state[storeId]?.lastSyncedFingerprint;
    const localChanged =
      priorFingerprint === undefined || priorFingerprint !== fingerprintBefore;

    result = await autoSync.run(ctx, { reason, localChanged });

    // Recomputed *after* `run` rather than reusing `fingerprintBefore`: a
    // pull writes local storage mid-run, so the pre-run fingerprint no
    // longer describes what's on disk. Recording a stale baseline here would
    // make every following tick see "local changed" forever and re-push a
    // dataset that never actually diverged.
    if (result.outcome === 'upToDate' || result.outcome === 'synced') {
      fingerprintAfter = datasetFingerprint(await ctx.exportDataset());
    }
  } catch {
    // A store's `run` must classify its own failures and never throw, but
    // guard anyway rather than letting an uncaught rejection kill the chain.
    result = { outcome: 'failed', errorKind: 'unknown' };
  }

  await applyRunResult(storeId, entry, result, fingerprintAfter);

  entry.inFlight = false;
  updateStatus(storeId, { running: false });
  rescheduleAfterRun(storeId);

  return result;
};

const armStore = async (store: DataStore, gen: number): Promise<void> => {
  if (!store.autoSync) return;

  const prefs = await getAutoSyncPreferences();
  if (gen !== generation) return; // a stop()/start() happened while awaiting

  const storePrefs = prefs.stores[store.id];
  const persistedState = prefs.state[store.id] ?? {};

  const intervalMs = clampInterval(
    storePrefs?.intervalMs ??
      store.autoSync.defaultIntervalMs ??
      DEFAULT_AUTO_SYNC_INTERVAL_MS
  );
  const enabled = storePrefs?.enabled === true;

  const entry: ArmedStore = armed.get(store.id) ?? {
    store,
    inFlight: false,
    consecutiveFailures: 0,
    suspended: false,
  };
  entry.store = store;
  entry.consecutiveFailures = persistedState.consecutiveFailures ?? 0;
  entry.suspended = !!persistedState.pausedReason;
  armed.set(store.id, entry);

  statusCache.set(store.id, {
    enabled,
    intervalMs,
    running: entry.inFlight,
    lastRunAt: persistedState.lastRunAt,
    lastOutcome: persistedState.lastOutcome,
    lastMessage: persistedState.lastMessage,
    lastErrorKind: persistedState.lastErrorKind,
    conflictsPending: persistedState.conflictsPending,
    conflictLabels: persistedState.conflictLabels,
    pausedReason: persistedState.pausedReason,
  });
  notifyListeners();

  clearStoreTimer(store.id);
  if (
    enabled &&
    !entry.suspended &&
    !entry.inFlight &&
    getAppStateStatus() === 'active'
  ) {
    scheduleNext(store.id, intervalMs);
  }
};

const handleLocalDataChanged = (): void => {
  for (const [storeId, entry] of armed) {
    const status = statusCache.get(storeId);
    if (!status?.enabled || entry.suspended) continue;
    if (getAppStateStatus() !== 'active') continue;

    clearDebounceTimer(storeId);
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = undefined;
      void runStore(storeId, 'localChange');
    }, LOCAL_CHANGE_DEBOUNCE_MS);
  }
};

const handleAppStateChange = (status: AppStateStatus): void => {
  if (status === 'active') {
    for (const [storeId, entry] of armed) {
      const st = statusCache.get(storeId);
      if (!st?.enabled || entry.suspended) continue;
      clearStoreTimer(storeId);
      entry.timer = setTimeout(() => {
        void runStore(storeId, 'foreground');
      }, FOREGROUND_SETTLE_MS);
    }
    return;
  }

  // background / inactive: stop scheduling. An in-flight run is not
  // cancelled — there is no abort path through Octokit — but
  // `rescheduleAfterRun` checks `getAppStateStatus()` and will not rearm it.
  for (const storeId of armed.keys()) {
    clearStoreTimer(storeId);
    clearDebounceTimer(storeId);
  }
};

const stop = (): void => {
  generation += 1;
  for (const storeId of armed.keys()) {
    clearStoreTimer(storeId);
    clearDebounceTimer(storeId);
  }
  armed.clear();
  statusCache.clear();
  appStateUnsubscribe?.();
  appStateUnsubscribe = undefined;
  localChangeUnsubscribe?.();
  localChangeUnsubscribe = undefined;
  ctx = undefined;
  started = false;
  notifyListeners();
};

const start = (options: {
  stores: DataStore[];
  ctx: DataStoreContext;
}): void => {
  stop();
  const gen = generation;

  ctx = options.ctx;
  started = true;

  for (const store of options.stores) {
    if (store.autoSync) void armStore(store, gen);
  }

  appStateUnsubscribe = subscribeAppState(handleAppStateChange);
  localChangeUnsubscribe = onLocalDataChanged(handleLocalDataChanged);
};

const refreshPreferences = async (): Promise<void> => {
  if (!started) return;
  const gen = generation;
  const stores = [...armed.values()].map(entry => entry.store);
  for (const store of stores) {
    await armStore(store, gen);
  }
};

const runNow = (
  storeId: string,
  reason: AutoSyncReason = 'manual'
): Promise<AutoSyncResult | undefined> => runStore(storeId, reason);

const getStatus = (storeId: string): AutoSyncStatus | undefined =>
  statusCache.get(storeId);

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const autoSyncController = {
  start,
  stop,
  runNow,
  refreshPreferences,
  getStatus,
  subscribe,
};

/** Test-only: tear everything down and drop every subscriber. */
export const resetAutoSyncController = (): void => {
  stop();
  listeners.clear();
};
