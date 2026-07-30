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
export { getActiveDataStores } from './datastores/registry';
export { createDataStoreContext } from './datastores/context';

// --- The ruleset layer ------------------------------------------------------

export {
  // schema
  type RulesetDefinition,
  type Archetype,
  type ArchetypeGroup,
  type ArchetypeRule,
  type CategoryBonusRule,
  type FeatureFlags,
  type Modifier,
  type Quality,
  type Recipe,
  type RulesetLimits,
  type TermKey,
  type TerminologyMap,
  type Trait,
  type TraitCategory,
  type AttributeBag,
  type AttributeDefinition,
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
  type RefCollection,
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

// --- Domain types -----------------------------------------------------------

export type {
  GameCharacter,
  GameEvent,
  GameLocation,
  GameQuest,
  // A character's modifications — the flavor's own content transforms into
  // these, so a ruleset module needs the type even though the engine owns it.
  Modification,
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
  UNKNOWN_ARCHETYPE_ID,
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
} from './styles/theme';
export { commonStyles } from './styles/commonStyles';
export { CHART_PALETTE } from './styles/chartPalette';
