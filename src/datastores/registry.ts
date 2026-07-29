/**
 * Which data stores this build offers.
 *
 * **The default lives here, not in `activeRuleset.ts`, for two reasons.**
 *
 * *Cycle.* `characterStorage.ts` imports `rulesetFieldMigration.ts`, which
 * imports `getActiveRuleset` from `activeRuleset.ts`. The JSON store imports
 * `characterStorage`. If `activeRuleset.ts` named `jsonDataStore` to supply
 * its own default it would close that loop; keeping the configured array raw
 * there and resolving the default here — in a module only the screen imports
 * — avoids it.
 *
 * *`undefined` is not `[]`.* Storing what the consumer passed, unmodified, is
 * what lets an omitted `dataStores` mean "the default store is on" while an
 * explicit `dataStores: []` means "no store at all". Collapsing the two in the
 * registry would make the second unexpressible.
 */

import { getConfiguredDataStores } from '@/activeRuleset';
import { jsonDataStore } from './json';
import type { DataStore } from './types';

/**
 * The stores this build offers, in the order they render.
 *
 * Omitting `dataStores` from `configureLore` yields the local JSON store
 * alone; GitHub and any consumer-authored store are opt-in registrations.
 */
export const getActiveDataStores = (): DataStore[] =>
  getConfiguredDataStores() ?? [jsonDataStore];
