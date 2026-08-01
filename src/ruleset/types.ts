/**
 * Typed, pluggable ruleset schema. A RulesetDefinition must stay fully
 * serializable (no functions, no require()'d assets) so it can round-trip
 * through JSON for a future in-app ruleset editor. Non-serializable assets
 * (images) are resolved separately through RulesetAssets in assets.ts.
 */
import type { AttributeBag, AttributeDefinition } from './attributes';
import type { FacetCollection } from './facets';
import type { RelationshipTypeCollection } from './relationships';
import type { ReportDefinition } from './reports';

export type { AttributeBag, AttributeDefinition };

/**
 * The engine's own core domain nouns — everything else a ruleset renames is
 * a facet collection (`FacetCollection.singular`/`plural`/`categorySingular`/
 * `categoryPlural`), not a TermKey. `location`/`event` are not yet here;
 * they're always "Location"/"Event".
 */
export type TermKey =
  | 'character.singular'
  | 'character.plural'
  | 'faction.singular'
  | 'faction.plural'
  | 'quest.singular'
  | 'quest.plural'
  | 'resource.singular'
  | 'resource.plural'
  | 'questSponsor.singular'
  | 'questSponsor.plural'
  | 'map.label';

export type TerminologyMap = Record<TermKey, string>;

/**
 * A change applied by a facet entry or a category-bonus grant.
 *
 * `categoryDeltas` is keyed by *collection id* first, then by category id
 * within that collection — category ids are scoped per collection, so two
 * collections may each declare a category called `body` without colliding.
 *
 * Which roles a given source actually applies is enforced in `derived.ts` via
 * each collection's `contributes.deltaRoles`, not here.
 */
export interface Modifier {
  /** attributeId -> delta. */
  attributeDeltas?: Record<string, number>;
  /** collectionId -> categoryId -> delta applied to that category's score. */
  categoryDeltas?: Record<string, Record<string, number>>;
}

export interface FeatureFlags {
  quests: boolean;
  discord: boolean;
  map: boolean;
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
  /**
   * Every facet collection this ruleset declares — archetypes, traits,
   * qualities, modifications, recipes and anything else a flavor invents are
   * all facet collections; the engine no longer names any of them. A
   * ruleset may declare as few or as many as its game needs.
   */
  facets: FacetCollection[];
  /**
   * Every relationship-type collection this ruleset declares — the
   * generalized form of `RelationshipStanding` (#50). A ruleset declares one
   * collection per entity pairing that carries a typed relationship
   * (character-character, character-faction, faction-faction, or any other
   * pairing it invents); the engine no longer hardcodes any of them.
   */
  relationshipTypes: RelationshipTypeCollection[];
  features: FeatureFlags;
  /**
   * Which analytics/reporting screens this ruleset enables, in drawer order.
   * They're grouped under a collapsible "Statistics" drawer section; an
   * empty array (the default) renders no such section. See `reports.ts`.
   */
  reports: ReportDefinition[];
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
