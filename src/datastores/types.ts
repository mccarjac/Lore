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
}
