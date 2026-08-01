/**
 * Report definitions (issue: statistics nav grouping + ruleset-driven
 * reports). Before this, `characterStats`/`factionStats`/`influenceReport`/
 * `relationshipGraph` were fixed booleans on `FeatureFlags` — a ruleset could
 * only flip each on or off, never choose which reports exist, retitle them,
 * or control their order.
 *
 * `ReportDefinition` generalizes that the same way `FacetCollection` and
 * `RelationshipTypeCollection` generalized their subsystems: the engine
 * still implements a fixed vocabulary of report *kinds* (the screens and
 * their computations differ too much to fold into `facets`), but a ruleset
 * declares which kinds it wants, in what order, and under what title via
 * `RulesetDefinition.reports`.
 */
import { useRuleset } from './context';

export type ReportKind =
  | 'characterStats'
  | 'factionStats'
  | 'influenceReport'
  | 'relationshipGraph';

/**
 * Declared as data rather than derived from the `ReportKind` union so
 * `validate.ts` can iterate it — a union type has no runtime representation.
 */
export const REPORT_KINDS: readonly ReportKind[] = [
  'characterStats',
  'factionStats',
  'influenceReport',
  'relationshipGraph',
];

export interface ReportDefinition {
  kind: ReportKind;
  /** Overrides the engine's default title/drawer label for this kind. */
  title?: string;
}

/** Hook form, mirroring `useFeature`. */
export function useReports(): ReportDefinition[] {
  const { ruleset } = useRuleset();
  return ruleset.reports;
}
