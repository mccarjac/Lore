/**
 * The facet collection primitive (issue #51).
 *
 * Before this, the ruleset schema named six collections outright —
 * `archetypes`, `traits`, `traitCategories`, `qualities`, `modifications`
 * (character-only), `recipes` — each its own field with its own element
 * type, its own feature flag, its own TermKeys, and its own hand-written
 * validation, computation and rendering code. A ruleset needing four
 * tag-like categories instead of two trait categories, or a second
 * archetype-like axis (Species *and* Calling), or no notion of "quality" at
 * all, could not say so without an engine change.
 *
 * A `FacetCollection` is the generalization: a ruleset declares as many as
 * its game needs, and the engine — `derived.ts`'s computation, `validate.ts`'s
 * checks, the character screens, the stats screens, the PDF export and quest
 * matching — walks `RulesetDefinition.facets` rather than naming any of them.
 *
 * The six retired collections all express as one shape:
 *
 *   archetypes    -> selection: 'single', contributes.stage: 'base'
 *   traits        -> selection: 'multi', categories + categoryBonuses,
 *                    contributes: { deltaRoles: ['resource'], categoryScore: true }
 *   qualities     -> selection: 'multi', maxSelections, no `contributes`
 *   modifications -> selection: 'multi', authored: true,
 *                    contributes: { stage: 'postBonus', deltaRoles: ['resource','cap'] }
 *   recipes       -> selection: 'catalog' (referenced via `links`, never held)
 *
 * Issue #56 folded a seventh thing in: the builtin `GameCharacter.present`
 * boolean, which was never a ruleset's to have. A game that tracks attendance
 * declares a `selection: 'single'` collection for it (see the example
 * ruleset's `attendance`); one that does not simply declares nothing.
 *
 * Every behavior the engine used to hardcode now falls out of a collection's
 * declaration, including the three deliberately-preserved quirks pinned by
 * the parity suite: traits cannot raise caps (`deltaRoles` excludes `'cap'`),
 * modification category deltas do not retroactively unlock category bonuses
 * (`stage: 'postBonus'` runs after bonuses are computed), and only capped
 * resources clamp (unchanged — a `derived.ts` rule, not a facet one).
 */
import type { AttributeBag, AttributeRole } from './attributes';
import type { AuthoredFacetEntry, GameCharacter } from '@models/types';
import type { Modifier, RulesetDefinition } from './types';

export type FacetSelection = 'single' | 'multi' | 'catalog';

/**
 * When a collection's deltas apply, relative to category-bonus grants.
 * `'base'` collections don't apply deltas at all — they seed absolute
 * attribute values instead (see `FacetEntry.attributes`).
 */
export type FacetStage = 'base' | 'preBonus' | 'postBonus';

/** A named group an entry can belong to (e.g. organic, robotic). */
export interface FacetGroup {
  id: string;
  label: string;
}

export interface FacetCategory {
  id: string;
  label: string;
  color?: string;
}

/** "Hold `requiredScore` entries in `categoryId` and receive `grants`." */
export interface FacetBonusRule {
  categoryId: string;
  requiredScore: number;
  grants: Modifier;
}

export interface FacetEntry {
  id: string;
  label: string;
  description?: string;
  /** Which of the collection's `categories` this entry belongs to. */
  categoryId?: string;
  /** Group ids this entry belongs to; membership may overlap. */
  groups?: string[];
  /**
   * Absolute attribute values this entry seeds, keyed by
   * `RulesetDefinition.attributes[].id`. Meaningful only for a
   * `contributes.stage: 'base'` collection (the old `Archetype.attributes`).
   */
  attributes?: AttributeBag;
  /** Deltas applied while a character holds this entry. */
  modifier?: Modifier;
  /**
   * Free-form list of components/requirements this entry names — the old
   * `Recipe.materials`, generalized. Meaningful for any collection whose
   * entries are things to display a list against; unused otherwise.
   */
  materials?: string[];
  /**
   * collectionId -> entry ids this entry points at — the generalized form of
   * `Trait.recipeIds`. Typically points into a `selection: 'catalog'`
   * collection.
   */
  links?: Record<string, string[]>;
  /**
   * collectionId -> entry ids; this entry is only offered to a character
   * already holding one of the named entries in that collection — the
   * generalized form of `Trait.allowedArchetypeIds`/`Quality.allowedArchetypeIds`.
   */
  requires?: Record<string, string[]>;
  /**
   * The pre-migration stored value this entry replaces, for a collection that
   * declares `legacyField`. Read by `rulesetFieldMigration.ts`; the same
   * mechanism `RelationshipTypeEntry.legacyValue` uses, widened to `boolean`
   * because the pre-#56 `present` field was a boolean rather than an enum
   * member. Meaningless on a collection whose `legacyField` names an id-valued
   * field (`archetypeId`, `traitIds`, ...) — those ids carried over as-is.
   */
  legacyValue?: string | boolean;
}

/**
 * Suppresses category score — the declarative form of the old
 * `ArchetypeRule`'s one kind (`excludeCategoryScoreFromGroupRestrictedTraits`).
 * When the character holds `whenEntryId` in `whenCollectionId`, an entry in
 * *this* collection contributes no category score if it is restricted
 * (via `requires`) to exactly the membership of `groupId`.
 */
export interface FacetScoreExclusion {
  whenCollectionId: string;
  whenEntryId: string;
  groupId: string;
}

export interface FacetCollection {
  id: string;
  singular: string;
  plural: string;
  /**
   * `'single'` — a character holds at most one (the old archetype).
   * `'multi'` — a character holds any number (traits, qualities, modifications).
   * `'catalog'` — never held directly; only reachable through another
   * entry's `links` (the old recipes).
   */
  selection: FacetSelection;
  /** Caps how many entries a character may hold (the old `limits.maxQualities`). */
  maxSelections?: number;
  /** What a new character starts with, for a `'single'` collection. */
  defaultEntryId?: string;
  /**
   * Entries are authored per character rather than picked from `entries`
   * (the old free-text `Modification`). `entries` is empty for an authored
   * collection; validation requires the reverse too.
   */
  authored?: boolean;
  groups?: FacetGroup[];
  categories?: FacetCategory[];
  categorySingular?: string;
  categoryPlural?: string;
  categoryBonuses?: FacetBonusRule[];
  /** Catalog entries. Empty for an `authored` collection. */
  entries: FacetEntry[];
  /**
   * How this collection feeds `calculateDerivedStats`. Omit entirely for a
   * collection that is purely descriptive (the old `Quality`) or a catalog
   * that is never held (the old `Recipe`).
   */
  contributes?: {
    /** Default `'preBonus'`. */
    stage?: FacetStage;
    /** Default `[]` — no arithmetic, i.e. a purely descriptive collection. */
    deltaRoles?: AttributeRole[];
    /** Default `false`. Whether holding an entry adds 1 to its category's score. */
    categoryScore?: boolean;
  };
  scoreExclusions?: FacetScoreExclusion[];
  /**
   * Quest-match weight (see `questProposal.ts`). Defaults to 5 for
   * `'single'` collections and 3 for `'multi'` — the old
   * `SPECIES_WEIGHT`/`PERK_WEIGHT` constants, generalized.
   */
  matchWeight?: number;
  /** Weight for a category-level quest preference. Defaults to 1. */
  categoryMatchWeight?: number;
  /**
   * Which retired `GameCharacter` field this collection's stored selections
   * migrate in from, if any. Read by `rulesetFieldMigration.ts`; absent for
   * a collection with no legacy counterpart. The first four are the pre-#51
   * facet fields; `'present'` is the pre-#56 attendance boolean, whose two
   * values map through each entry's `legacyValue`.
   */
  legacyField?:
    | 'archetypeId'
    | 'traitIds'
    | 'qualityIds'
    | 'modifications'
    | 'present';
}

// --- Accessors ---------------------------------------------------------
// Reused everywhere a screen or util used to reach for `archetypeId`,
// `traitIds`, `qualityIds` or `modifications` directly.

export const findFacetCollection = (
  ruleset: RulesetDefinition,
  collectionId: string
): FacetCollection | undefined =>
  ruleset.facets.find(c => c.id === collectionId);

/** The collection this ruleset declared for a given legacy field, if any. */
export const findFacetCollectionByLegacyField = (
  ruleset: RulesetDefinition,
  legacyField: NonNullable<FacetCollection['legacyField']>
): FacetCollection | undefined =>
  ruleset.facets.find(c => c.legacyField === legacyField);

/** The entry replacing a pre-migration stored value (see `legacyValue`). */
export const findFacetEntryByLegacyValue = (
  collection: FacetCollection | undefined,
  legacyValue: string | boolean
): FacetEntry | undefined =>
  collection?.entries.find(entry => entry.legacyValue === legacyValue);

/** Every catalog-entry id a character holds in `collectionId`. */
export const getFacetIds = (
  character: GameCharacter,
  collectionId: string
): string[] =>
  (character.facets?.[collectionId] ?? []).filter(
    (v): v is string => typeof v === 'string'
  );

/** Every authored (inline) entry a character holds in `collectionId`. */
export const getAuthoredFacets = (
  character: GameCharacter,
  collectionId: string
): AuthoredFacetEntry[] =>
  (character.facets?.[collectionId] ?? []).filter(
    (v): v is AuthoredFacetEntry => typeof v !== 'string'
  );

/** The single entry id held in a `selection: 'single'` collection, if any. */
export const getSingleFacetId = (
  character: GameCharacter,
  collectionId: string
): string | undefined => getFacetIds(character, collectionId)[0];

/**
 * The character's held entry label in the ruleset's first `single`-selection
 * collection, if it has one — the generalized form of showing "Drifter" or
 * "Warden" next to a character's name. A ruleset with no `single` collection
 * (or a character with none selected) has nothing to show here.
 */
export const getPrimaryFacetLabel = (
  character: GameCharacter,
  ruleset: RulesetDefinition
): string | undefined => {
  const collection = ruleset.facets.find(c => c.selection === 'single');
  if (!collection) return undefined;
  const heldId = getSingleFacetId(character, collection.id);
  return collection.entries.find(e => e.id === heldId)?.label;
};

/** Returns a new character with `collectionId`'s catalog ids replaced. */
export const setFacetIds = (
  character: GameCharacter,
  collectionId: string,
  ids: string[]
): GameCharacter => ({
  ...character,
  facets: { ...character.facets, [collectionId]: ids },
});

/** Resolves a character's held ids in `collection` to their `FacetEntry`s. */
export const resolveFacetEntries = (
  character: GameCharacter,
  collection: FacetCollection
): FacetEntry[] => {
  const held = new Set(getFacetIds(character, collection.id));
  return collection.entries.filter(entry => held.has(entry.id));
};

/**
 * Reads a collection's score for one of its categories out of
 * `DerivedStats.categoryScores` (`collectionId -> categoryId -> score`),
 * defaulting to 0 rather than `undefined` for a category nobody has scored.
 */
export const getCategoryScore = (
  categoryScores: Record<string, Record<string, number>>,
  collectionId: string,
  categoryId: string
): number => categoryScores[collectionId]?.[categoryId] ?? 0;
