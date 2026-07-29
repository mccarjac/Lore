/**
 * `lore/ruleset` — the engine without the app.
 *
 * The main entry (`lore`) re-exports `LoreApp`, which pulls the whole screen
 * tree behind it, and screens import native modules: `react-native-gesture-
 * handler` resolves its native module at import time, so anything that loads
 * the main entry under Jest needs the full React Native mock surface.
 *
 * That is the wrong price for testing a ruleset. A flavor's own module and its
 * tests want the schema, the attribute primitive and `calculateDerivedStats` —
 * all pure, none of it touching React Native. This entry is that subset, and
 * it is why the `exports` map publishes two paths rather than one.
 *
 * The rule stays the same otherwise: these two files are the public API, and
 * anything not re-exported here or from `index.ts` is internal.
 */

// --- The ruleset layer ------------------------------------------------------

export {
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
  type RulesetAssets,
  resolveAsset,
  getLabel,
  isFeatureEnabled,
  FEATURE_KEYS,
  DEFAULT_TERMINOLOGY,
  validateRuleset,
  validateCharacterAttributes,
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

export {
  configureLore,
  getActiveRuleset,
  getActiveAssets,
  getConfiguredDataStores,
  isLoreConfigured,
  resetLoreConfig,
  type LoreConfig,
} from './activeRuleset';

// `LoreConfig` names `DataStore`, so the type has to be reachable from here.
// Types only — the store *implementations* import React Native, which is
// exactly what this entry point exists to keep out.
export type {
  DataStore,
  DataStoreAction,
  DataStoreActionResult,
  DataStoreActionVariant,
  DataStoreContext,
  DataStoreSectionProps,
} from './datastores/types';

// --- Domain types -----------------------------------------------------------

export type {
  GameCharacter,
  GameEvent,
  GameLocation,
  GameQuest,
  Modification,
  Relationship,
  RelationshipStanding,
  QuestStatus,
} from './models/types';

// --- Pure utilities ---------------------------------------------------------
// Included because they are computation, not presentation: a flavor's tests
// reach for these, and none of them import React Native.

export {
  normalizeCharacterRulesetFields,
  normalizeCharactersRulesetFields,
  normalizeQuestRulesetFields,
  normalizeQuestsRulesetFields,
  UNKNOWN_ARCHETYPE_ID,
} from './utils/rulesetFieldMigration';

export { parseDateString, formatEventDate } from './utils/dateUtils';
