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
import { pdfDataStore } from './pdf';
import type { DataStore } from './types';

/**
 * The stores this build offers, in the order they render.
 *
 * Omitting `dataStores` from `configureLore` yields the two stores that need no
 * configuration of any kind: the local JSON archive and the PDF campaign wiki
 * (#28). Backup comes before the readable copy because that is the order they
 * matter in when something has gone wrong. GitHub needs a token and a
 * repository, so it — like any consumer-authored store — is an opt-in
 * registration.
 */
export const getActiveDataStores = (): DataStore[] =>
  getConfiguredDataStores() ?? [jsonDataStore, pdfDataStore];
