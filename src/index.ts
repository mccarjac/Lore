/**
 * The engine's public API — the only thing a consumer imports.
 *
 * Everything re-exported here is a supported surface: renaming or changing the
 * shape of any of it is a breaking change for whoever depends on this package.
 * Everything *not* here is internal and free to move. That distinction only
 * survives if consumers import `lore` rather than `lore/lib/utils/…`, so
 * `package.json`'s `exports` map deliberately publishes nothing but this
 * module.
 *
 * Exports are named rather than `export *` so adding a file cannot silently
 * widen the API.
 */

// --- Running the app --------------------------------------------------------

export { LoreApp, type LoreAppProps } from './LoreApp';
export {
  configureLore,
  getActiveRuleset,
  getActiveAssets,
  getConfiguredDataStores,
  type LoreConfig,
} from './activeRuleset';

// --- Data stores ------------------------------------------------------------
// Which backends this build can read and write its dataset through (#29).
// Omit `dataStores` from configureLore for `jsonDataStore` and `pdfDataStore`.

export {
  type DataStore,
  type DataStoreAction,
  type DataStoreActionResult,
  type DataStoreActionVariant,
  type DataStoreContext,
  type DataStoreSectionProps,
  type DataStoreAutoSync,
  type AutoSyncReason,
  type AutoSyncRunOptions,
  type AutoSyncOutcome,
  type AutoSyncConflictSummary,
  type AutoSyncResult,
} from './datastores/types';
export { jsonDataStore } from './datastores/json';
export { pdfDataStore } from './datastores/pdf';
export { githubDataStore } from './datastores/github';
export { seedDataStore } from './datastores/seed';
export { getActiveDataStores } from './datastores/registry';
export { createDataStoreContext } from './datastores/context';

// --- The ruleset layer ------------------------------------------------------

export {
  // schema
  type RulesetDefinition,
  type FeatureFlags,
  type Modifier,
  type ColorPaletteOverrides,
  type TermKey,
  type TerminologyMap,
  type AttributeBag,
  type AttributeDefinition,
  // facets (#51) — a ruleset declares however many of these it needs;
  // the engine no longer names any collection itself.
  type FacetCollection,
  type FacetEntry,
  type FacetGroup,
  type FacetCategory,
  type FacetBonusRule,
  type FacetScoreExclusion,
  type FacetSelection,
  type FacetStage,
  findFacetCollection,
  getFacetIds,
  getAuthoredFacets,
  getSingleFacetId,
  setFacetIds,
  resolveFacetEntries,
  getPrimaryFacetLabel,
  getCategoryScore,
  // assets
  type RulesetAssets,
  resolveAsset,
  // provider and lookups
  RulesetProvider,
  useRuleset,
  useLabels,
  getLabel,
  useFeature,
  isFeatureEnabled,
  FEATURE_KEYS,
  DEFAULT_TERMINOLOGY,
  // validation
  validateRuleset,
  validateCharacterAttributes,
  // computation
  calculateDerivedStats,
  type DerivedStats,
} from './ruleset';

export {
  type AttributeRole,
  type AttributeType,
  type AttributeValue,
  num,
  text,
  flag,
  ref,
  roleOf,
  getNumber,
  getText,
  getFlag,
} from './ruleset/attributes';

export { exampleRuleset } from './ruleset/exampleRuleset';
export {
  exampleSeedDataset,
  type SeedDataset,
  type SeedFaction,
  type SeedFactionRelationship,
} from './ruleset/exampleSeedData';

// --- Domain types -----------------------------------------------------------

export type {
  GameCharacter,
  GameEvent,
  GameLocation,
  GameQuest,
  // A character's facet selections — the flavor's own content transforms
  // into these, so a ruleset module needs the types even though the engine
  // owns them. `AuthoredFacetEntry` is the inline shape (the old
  // `Modification`); `FacetValue` is what `GameCharacter.facets` actually
  // stores per collection (a catalog id, or one of these).
  AuthoredFacetEntry,
  FacetValue,
  QuestFacetPreferences,
  Relationship,
  RelationshipStanding,
  QuestStatus,
} from './models/types';

// --- Storage and utilities --------------------------------------------------
// A flavor's own tests need these, and a flavor that adds a screen needs the
// same storage entry points the built-in screens use.

export {
  type StoredFaction,
  loadCharacters,
  saveCharacters,
  addCharacter,
  updateCharacter,
  deleteCharacter,
  loadFactions,
  createFaction,
  updateFaction,
  deleteFaction,
  loadLocations,
  loadEvents,
  loadQuests,
  exportDataset,
  importDataset,
  applyMergedDataset,
  migrateRulesetFields,
} from './utils/characterStorage';

export { runExclusive } from './utils/storageQueue';
export { SafeAsyncStorageJSONParser } from './utils/safeAsyncStorageJSONParser';
export { parseDateString, formatEventDate } from './utils/dateUtils';
export {
  normalizeCharacterRulesetFields,
  normalizeCharactersRulesetFields,
  normalizeQuestRulesetFields,
  normalizeQuestsRulesetFields,
} from './utils/rulesetFieldMigration';

// --- Presentation -----------------------------------------------------------
// For a flavor that wants to compose its own screens rather than only supply
// data.

export * from './components';
export {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  useTheme,
  getActiveColors,
  type ColorPalette,
  type ThemeValue,
} from './styles/theme';
export { commonStyles, useCommonStyles } from './styles/commonStyles';
export { CHART_PALETTE } from './styles/chartPalette';
