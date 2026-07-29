/**
 * Builds the `DataStoreContext` every store operation is handed.
 *
 * Deliberately a function rather than a module-level constant: the active
 * ruleset is mutable state (`configureLore` writes it), so capturing it at
 * module load would hand every store the pre-configuration default.
 *
 * The ruleset is a parameter defaulting to the active one, matching the
 * convention in `derived.ts` and `rulesetFieldMigration.ts` — a component
 * builds the context from `useRuleset()` so a `RulesetProvider` above it is
 * honored, while non-component code gets the registry for free.
 */

import {
  exportDataset,
  importDataset,
  mergeDatasetWithConflictResolution,
} from '@utils/characterStorage';
import { getActiveRuleset } from '@/activeRuleset';
import type { RulesetDefinition } from '@/ruleset/types';
import type { DataStoreContext } from './types';

export const createDataStoreContext = (
  ruleset: RulesetDefinition = getActiveRuleset()
): DataStoreContext => ({
  ruleset,
  exportDataset,
  importDataset,
  mergeDataset: mergeDatasetWithConflictResolution,
});
