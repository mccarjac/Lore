/**
 * The data-store plugin contract (#29).
 *
 * A **data store** is a backend that a campaign's dataset can be written to and
 * read back from: a local file, a GitHub repository, an S3 bucket, a Drive
 * folder, a database. The engine ships two implementations and publishes this
 * interface so a consumer can write its own and register it through
 * `configureLore({ dataStores })`.
 *
 * Two rules keep the seam honest:
 *
 * - **A store never touches AsyncStorage.** Everything it needs to read or
 *   write local data arrives on `DataStoreContext`, whose entry points are the
 *   `runExclusive`-wrapped mutators in `characterStorage.ts`. A store that
 *   reached past this would reintroduce the lost-update bug those wrappers
 *   exist to prevent.
 * - **React is a type-only import here.** `LoreConfig` names `DataStore`, and
 *   `LoreConfig` is re-exported from `src/headless.ts` — the entry that
 *   deliberately pulls in no React Native. A value import of React would put
 *   it there.
 */

import type React from 'react';
import type { RulesetDefinition } from '@/ruleset/types';
import type { MergeResult } from '@utils/characterStorage';
import type { SyncErrorKind } from '@utils/syncErrors';

/**
 * Everything a store is handed to do its job. Passing these in rather than
 * letting a store import storage directly is what keeps a consumer-authored
 * store from having to know about `@/utils/characterStorage` — which is not on
 * the public API surface for storage *internals*, only for these entry points.
 */
export interface DataStoreContext {
  /** The active ruleset. The GitHub store embeds its id/version in exports. */
  ruleset: RulesetDefinition;
  /** Serialize all local game data to a JSON string. */
  exportDataset: () => Promise<string>;
  /** Replace all local game data from a JSON string. */
  importDataset: (json: string) => Promise<boolean>;
  /** Merge a JSON string into local data, reporting per-record conflicts. */
  mergeDataset: (json: string) => Promise<MergeResult>;
}

export interface DataStoreActionResult {
  success: boolean;
  /** User-facing prose for the success alert. Omit for a silent success. */
  message?: string;
  /** User-facing prose for the failure alert. */
  error?: string;
  /**
   * The action already showed its own UI (a picker cancelled, a conflict
   * dialog ran to completion), so the screen should stay quiet. A cancelled
   * document picker is `{ success: false, handled: true }` — not an error.
   */
  handled?: boolean;
}

/** Which of the shared button styles an action renders with. */
export type DataStoreActionVariant =
  | 'primary'
  | 'secondary'
  | 'warning'
  | 'danger';

export interface DataStoreAction {
  /** Unique within the store; used as a React key and a test handle. */
  id: string;
  /** Button text. */
  label: string;
  /** Shown in the progress modal while `run` is in flight. */
  progressMessage: string;
  variant?: DataStoreActionVariant;
  run: (ctx: DataStoreContext) => Promise<DataStoreActionResult>;
}

/**
 * Props handed to a store that renders its own section. The progress modal
 * belongs to the screen so that a custom section does not grow a second
 * spinner of its own.
 */
export interface DataStoreSectionProps {
  ctx: DataStoreContext;
  showProgress: (message: string) => void;
  hideProgress: () => void;
}

export interface DataStore {
  /** Stable identifier — `'json'`, `'github'`, or a consumer's own. */
  id: string;
  /** Section heading on the Data Management screen. */
  label: string;
  /** Sentence under the heading explaining what this store does. */
  description?: string;
  /**
   * The common case: a row of buttons, rendered by the engine. A store that
   * needs nothing more should declare only these.
   */
  actions?: DataStoreAction[];
  /**
   * Escape hatch for a store whose UI is more than a row of buttons — the
   * built-in GitHub store needs a token dialog, a configured/unconfigured
   * split, a last-synced line and a conflict modal. Generalizing all of that
   * into `actions` would produce a worse interface than simply letting the
   * store render itself. When present, this replaces `actions` entirely.
   */
  Section?: React.ComponentType<DataStoreSectionProps>;
  /**
   * Opt-in background sync (#31). **Absence means the store does not support
   * it** — there is no `autoSync: false`; `jsonDataStore` and `pdfDataStore`
   * simply omit the field. Declaring it is what makes the Data Management
   * screen render a toggle and status row for this store, and what makes the
   * engine's scheduler poll it.
   */
  autoSync?: DataStoreAutoSync;
}

/** Why an auto-sync run fired. A store may take a cheaper path on a poll. */
export type AutoSyncReason =
  | 'interval'
  | 'localChange'
  | 'foreground'
  | 'manual';

export interface AutoSyncRunOptions {
  reason: AutoSyncReason;
  /**
   * The engine's answer to "has local data changed since this store last
   * synced" — a dataset fingerprint comparison computed by the scheduler, not
   * a network call. A store should use this to skip its expensive remote
   * fetch entirely when nothing moved on either side.
   */
  localChanged: boolean;
}

export type AutoSyncOutcome =
  | 'upToDate'
  | 'synced'
  | 'conflicts'
  | 'skipped'
  | 'failed';

/** One conflicting record, for the status line. Not the full diff. */
export interface AutoSyncConflictSummary {
  /** `${collection}:${key}` — the same shape a resolution map is keyed by. */
  key: string;
  label: string;
}

export interface AutoSyncResult {
  outcome: AutoSyncOutcome;
  /** For `'synced'`. Counts, not datasets. */
  stats?: { pulled: number; pushed: number };
  /** For `'conflicts'`. */
  conflicts?: AutoSyncConflictSummary[];
  /** User-facing prose for `'skipped'` / `'failed'`, or extra `'synced'` detail. */
  message?: string;
  /** For `'failed'` — the engine's backoff is keyed on this. */
  errorKind?: SyncErrorKind;
  /** True when this run wrote local data, so screens know to reload. */
  localDataChanged?: boolean;
}

export interface DataStoreAutoSync {
  /** Sentence under the toggle. */
  description?: string;
  /** Poll interval in milliseconds. The engine clamps it to a sane minimum. */
  defaultIntervalMs?: number;
  /**
   * One sync pass: pull, merge, push. **Must never resolve a genuine
   * conflict** — return `{ outcome: 'conflicts' }` with nothing written and
   * let a human resolve it through the store's own UI. Must not throw;
   * classify the failure and return `{ outcome: 'failed', errorKind }`
   * instead. The engine owns scheduling, the in-flight guard, backoff and
   * status persistence — this function only needs to run once and report
   * what happened.
   */
  run: (
    ctx: DataStoreContext,
    options: AutoSyncRunOptions
  ) => Promise<AutoSyncResult>;
}
