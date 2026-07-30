/**
 * Typed, pluggable ruleset schema. A RulesetDefinition must stay fully
 * serializable (no functions, no require()'d assets) so it can round-trip
 * through JSON for a future in-app ruleset editor. Non-serializable assets
 * (images) are resolved separately through RulesetAssets in assets.ts.
 */
import type { AttributeBag, AttributeDefinition } from './attributes';

export type { AttributeBag, AttributeDefinition };

export type TermKey =
  | 'character.singular'
  | 'character.plural'
  | 'faction.singular'
  | 'faction.plural'
  | 'quest.singular'
  | 'quest.plural'
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
  modifications: boolean;
  influenceReport: boolean;
  relationshipGraph: boolean;
  characterStats: boolean;
  factionStats: boolean;
}

/** Ruleset-level numeric limits that today are magic numbers in screens. */
export interface RulesetLimits {
  maxQualities?: number;
}

/**
 * A single brand color — any valid CSS/React-Native color string (hex,
 * `rgba(...)`, a named color). Kept as a plain string rather than a
 * branded type so the ruleset stays JSON-serializable.
 */
export type ColorToken = string;

/**
 * The engine's full color vocabulary. `src/styles/theme.ts` owns the
 * default values; this interface is the shape a ruleset's `branding.colors`
 * may override, declared here (not in `styles/`) so the engine schema has
 * no dependency on the styling layer — `theme.ts` depends on this type,
 * never the other way round.
 */
export interface ColorPalette {
  primary: ColorToken;
  secondary: ColorToken;
  surface: ColorToken;
  elevated: ColorToken;
  text: {
    primary: ColorToken;
    secondary: ColorToken;
    muted: ColorToken;
    accent: ColorToken;
  };
  accent: {
    primary: ColorToken;
    secondary: ColorToken;
    success: ColorToken;
    warning: ColorToken;
    danger: ColorToken;
    info: ColorToken;
  };
  status: {
    success: ColorToken;
    warning: ColorToken;
    error: ColorToken;
    info: ColorToken;
    present: ColorToken;
    absent: ColorToken;
  };
  standing: {
    allied: ColorToken;
    friendly: ColorToken;
    neutral: ColorToken;
    hostile: ColorToken;
    enemy: ColorToken;
  };
  certainty: {
    confirmed: ColorToken;
    unconfirmed: ColorToken;
    disputed: ColorToken;
  };
  interactive: {
    hover: ColorToken;
    pressed: ColorToken;
    disabled: ColorToken;
  };
  border: ColorToken;
  borderLight: ColorToken;
  shadow: ColorToken;
}

/**
 * What a ruleset may override — every leaf is optional, so
 * `branding.colors: {}` (or omitting it entirely) is a complete, valid
 * choice that changes nothing.
 */
export type ColorPaletteOverrides = {
  [K in keyof ColorPalette]?: ColorPalette[K] extends ColorToken
    ? ColorToken
    : Partial<ColorPalette[K]>;
};

export interface RulesetDefinition {
  id: string;
  name: string;
  version: string;
  terminology: Partial<TerminologyMap>;
  /** Every attribute any entity in this ruleset may carry. */
  attributes: AttributeDefinition[];
  groups: ArchetypeGroup[];
  archetypes: Archetype[];
  /**
   * Archetype a newly created character starts on. Without it the character
   * form would have to fall back to `archetypes[0]`, which is declaration
   * order rather than an authored choice.
   */
  defaultArchetypeId?: string;
  traitCategories: TraitCategory[];
  traits: Trait[];
  qualities: Quality[];
  recipes?: Recipe[];
  categoryBonuses: CategoryBonusRule[];
  archetypeRules?: ArchetypeRule[];
  features: FeatureFlags;
  limits?: RulesetLimits;
  /**
   * Asset key resolved through RulesetAssets — never a require() result.
   * The map's display name is `terminology['map.label']`, not a field here:
   * two sources for one string only drift.
   */
  map?: { imageKey: string };
  branding: {
    appName: string;
    iconKey?: string;
    splashKey?: string;
    /**
     * Brand color overrides, merged over `styles/theme.ts`'s defaults.
     * Omit entirely (or `{}`) to use the engine's default dark theme —
     * that is what every ruleset gets today, and stays true for any
     * ruleset that never sets this.
     */
    colors?: ColorPaletteOverrides;
  };
}
