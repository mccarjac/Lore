/**
 * Typed, pluggable ruleset schema. A RulesetDefinition must stay fully
 * serializable (no functions, no require()'d assets) so it can round-trip
 * through JSON for a future in-app ruleset editor. Non-serializable assets
 * (images) are resolved separately through RulesetAssets in assets.ts.
 */
import type { AttributeBag, AttributeDefinition } from './attributes';

export type { AttributeBag, AttributeDefinition };

export type TermKey =
  | 'archetype.singular'
  | 'archetype.plural'
  | 'trait.singular'
  | 'trait.plural'
  | 'traitCategory.singular'
  | 'traitCategory.plural'
  | 'quality.singular'
  | 'quality.plural'
  | 'modification.singular'
  | 'modification.plural'
  | 'resource.singular'
  | 'resource.plural'
  | 'recipe.singular'
  | 'recipe.plural'
  | 'questSponsor.singular'
  | 'questSponsor.plural'
  | 'map.label';

export type TerminologyMap = Record<TermKey, string>;

/** A named group an archetype can belong to (e.g. organic, robotic). */
export interface ArchetypeGroup {
  id: string;
  label: string;
}

/**
 * Replaces Species + SPECIES_BASE_STATS.
 *
 * The former `baseValues` / `caps` / `capabilities` trio collapsed into one
 * attribute bag in #22 — they were three parallel maps split by value type
 * rather than by meaning. Which entries are resources, caps, or capability
 * flags is now declared once in `RulesetDefinition.attributes`.
 */
export interface Archetype {
  id: string;
  label: string;
  /** Group ids this archetype belongs to; membership may overlap. */
  groups: string[];
  /** attributeId -> base value, keyed by RulesetDefinition.attributes. */
  attributes: AttributeBag;
}

export interface TraitCategory {
  id: string;
  label: string;
  color?: string;
}

/**
 * A change applied by a trait, modification, or category bonus.
 *
 * `values` and `caps` merged into one delta map in #22 — a cap is simply
 * another numeric attribute (with `role: 'cap'`), so the split was redundant.
 * `categoryDeltas` stays separate because category scores are *derived* from
 * the traits a character holds rather than stored attributes.
 *
 * Which roles a given source actually applies is enforced in `derived.ts`,
 * not here: traits touch only `role: 'resource'`, modifications touch
 * `'resource'` and `'cap'`.
 */
export interface Modifier {
  /** attributeId -> delta. */
  attributeDeltas?: Record<string, number>;
  /** traitCategoryId -> delta applied to the derived category score. */
  categoryDeltas?: Record<string, number>;
}

/** Replaces AVAILABLE_PERKS entries. */
export interface Trait {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  modifier?: Modifier;
  allowedArchetypeIds?: string[];
  recipeIds?: string[];
}

/** Replaces AVAILABLE_DISTINCTIONS entries. */
export interface Quality {
  id: string;
  name: string;
  description: string;
  allowedArchetypeIds?: string[];
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  materials: string[];
}

/** Replaces TAG_SCORE_BONUSES. Flat list rather than a Record keyed by an enum. */
export interface CategoryBonusRule {
  categoryId: string;
  requiredScore: number;
  /** Applied when the score threshold is met. */
  grants: Modifier;
}

/** Declarative form of the 'Perfect Mutant' carve-out in derivedStats.ts. */
export interface ArchetypeRule {
  archetypeId: string;
  /**
   * This archetype accrues no category score from traits whose
   * allowedArchetypeIds is exactly the membership of this group.
   */
  kind: 'excludeCategoryScoreFromGroupRestrictedTraits';
  groupId: string;
}

export interface FeatureFlags {
  quests: boolean;
  recipes: boolean;
  discord: boolean;
  map: boolean;
  gitSync: boolean;
  modifications: boolean;
  influenceReport: boolean;
  relationshipGraph: boolean;
}

/** Ruleset-level numeric limits that today are magic numbers in screens. */
export interface RulesetLimits {
  maxQualities?: number;
}

export interface RulesetDefinition {
  id: string;
  name: string;
  version: string;
  terminology: Partial<TerminologyMap>;
  /** Every attribute any entity in this ruleset may carry. */
  attributes: AttributeDefinition[];
  groups: ArchetypeGroup[];
  archetypes: Archetype[];
  traitCategories: TraitCategory[];
  traits: Trait[];
  qualities: Quality[];
  recipes?: Recipe[];
  categoryBonuses: CategoryBonusRule[];
  archetypeRules?: ArchetypeRule[];
  features: FeatureFlags;
  limits?: RulesetLimits;
  /** Asset key resolved through RulesetAssets — never a require() result. */
  map?: { imageKey: string; label: string };
  branding: {
    appName: string;
    iconKey?: string;
    splashKey?: string;
  };
}
