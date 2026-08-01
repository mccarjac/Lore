/**
 * The relationship-type primitive (issue #50).
 *
 * Before this, `RelationshipStanding` was a single engine-hardcoded five-value
 * enum (`Ally|Friend|Neutral|Hostile|Enemy`) reused for three unrelated pairs
 * — character-character, character-faction ("standing"), and faction-faction
 * — with positive/negative polarity baked into two module-level arrays
 * (`POSITIVE_RELATIONSHIP_TYPE`/`NEGATIVE_RELATIONSHIP_TYPE`) rather than
 * declared by a ruleset. A ruleset needing a different vocabulary (a
 * hierarchy of "Parent of"/"Child of", an alliance-membership relationship
 * with no natural reciprocal, or simply different words) could not say so.
 *
 * `RelationshipTypeCollection` is the generalization, following the same
 * shape `FacetCollection` (#51) already established: a ruleset declares as
 * many collections as it needs, one per semantically distinct entity pairing,
 * and the engine walks `RulesetDefinition.relationshipTypes` rather than
 * naming any of them.
 *
 * `RelationshipRole` replaces the two hardcoded polarity arrays — the
 * "role, not identity" pattern `AttributeRole` (attributes.ts) already uses:
 * downstream code dispatches on `entry.role`, never on a literal id or label.
 *
 * `symmetric`/`inverseLabel` generalize "standing" (always mirrored, one
 * label) into also expressing directional/compositional relationships like
 * "Faction C is an alliance of Faction A and Faction B" (asymmetric, distinct
 * forward/inverse labels).
 */
import type { ColorPalette, ColorToken, RulesetDefinition } from './types';

export type RelationshipEntityKind =
  | 'character'
  | 'faction'
  | 'event'
  | 'quest'
  | 'location';

export type RelationshipRole = 'positive' | 'neutral' | 'negative';

export interface RelationshipTypeEntry {
  id: string;
  /** Shown from the "forward" (authored) side. */
  label: string;
  /**
   * Shown from the other side of a directional relationship. Required when
   * `symmetric` is `false` — a symmetric entry has only one label because
   * both sides read the same (the old `Ally`/`Hostile`/etc.).
   */
  inverseLabel?: string;
  /**
   * `true` (the default) — the relationship reads the same from both sides
   * and storage mirrors it onto both entities, matching every relationship
   * in the app today. `false` — directional/compositional (hierarchy,
   * alliance-membership); the authored side and its reciprocal are stored
   * with opposite `direction` and rendered via `label`/`inverseLabel`.
   */
  symmetric?: boolean;
  role: RelationshipRole;
  description?: string;
  /** Overrides the role-based default color from `resolveRelationshipColor`. */
  color?: ColorToken;
  /**
   * The pre-generalization `RelationshipStanding` member name (e.g. `'Ally'`)
   * this entry replaces. Read by `rulesetFieldMigration.ts` to upgrade
   * stored data; meaningful only when the owning collection declares
   * `legacyField`.
   */
  legacyValue?: string;
}

export interface RelationshipTypeCollection {
  id: string;
  singular: string;
  plural: string;
  /** Which two entity kinds this collection's entries relate. */
  appliesTo: [RelationshipEntityKind, RelationshipEntityKind];
  entries: RelationshipTypeEntry[];
  defaultEntryId?: string;
  /**
   * Which pre-#50 stored field this collection's values migrate in from, if
   * any. Read by `rulesetFieldMigration.ts`; absent for a collection with no
   * legacy counterpart (e.g. a net-new pair like character-event).
   */
  legacyField?:
    | 'characterStanding'
    | 'characterFactionStanding'
    | 'factionStanding';
}

// --- Accessors ---------------------------------------------------------
// Reused everywhere a screen or util used to reach for RelationshipStanding
// directly.

export const isSymmetric = (entry: RelationshipTypeEntry): boolean =>
  entry.symmetric ?? true;

export const findRelationshipCollection = (
  ruleset: RulesetDefinition,
  collectionId: string
): RelationshipTypeCollection | undefined =>
  ruleset.relationshipTypes.find(c => c.id === collectionId);

export const findRelationshipEntry = (
  collection: RelationshipTypeCollection | undefined,
  entryId: string | undefined
): RelationshipTypeEntry | undefined =>
  entryId === undefined
    ? undefined
    : collection?.entries.find(e => e.id === entryId);

/**
 * The first collection the ruleset declares for a given entity pairing —
 * what a screen's picker enumerates (e.g. every character-faction standing
 * option to choose from). Distinct from `findRelationshipEntryForPair`,
 * which searches every matching collection to resolve one stored id; a
 * picker instead needs one concrete list of options to render.
 */
export const findRelationshipCollectionForPair = (
  ruleset: RulesetDefinition,
  appliesTo: [RelationshipEntityKind, RelationshipEntityKind]
): RelationshipTypeCollection | undefined =>
  ruleset.relationshipTypes.find(
    c => c.appliesTo[0] === appliesTo[0] && c.appliesTo[1] === appliesTo[1]
  );

/**
 * Resolves a relationship-type entry by id, searching every collection the
 * ruleset declares for the given entity pairing. Storage records only a bare
 * `relationshipTypeId`, never which collection it came from, so this is the
 * generic lookup every read site needs (a faction-faction sync, a stats
 * calculation, a screen rendering a badge) rather than each hand-rolling its
 * own scan over `ruleset.relationshipTypes`.
 */
export const findRelationshipEntryForPair = (
  ruleset: RulesetDefinition,
  appliesTo: [RelationshipEntityKind, RelationshipEntityKind],
  relationshipTypeId: string | undefined
): RelationshipTypeEntry | undefined =>
  ruleset.relationshipTypes
    .filter(
      c => c.appliesTo[0] === appliesTo[0] && c.appliesTo[1] === appliesTo[1]
    )
    .map(c => findRelationshipEntry(c, relationshipTypeId))
    .find((entry): entry is RelationshipTypeEntry => entry !== undefined);

export const relationshipCollectionForLegacyField = (
  ruleset: RulesetDefinition,
  legacyField: NonNullable<RelationshipTypeCollection['legacyField']>
): RelationshipTypeCollection | undefined =>
  ruleset.relationshipTypes.find(c => c.legacyField === legacyField);

export const findRelationshipEntryByLegacyValue = (
  collection: RelationshipTypeCollection | undefined,
  legacyValue: string
): RelationshipTypeEntry | undefined =>
  collection?.entries.find(e => e.legacyValue === legacyValue);

export type RelationshipDirection = 'forward' | 'inverse';

/** The stored side's opposite — the reciprocal write for a mirrored pair. */
export const flipDirection = (
  direction: RelationshipDirection
): RelationshipDirection => (direction === 'forward' ? 'inverse' : 'forward');

/**
 * The label to render for one side of a relationship. `direction` defaults
 * to `'forward'` (the authored side, or any symmetric entry, which has no
 * `inverseLabel` to fall back from).
 */
export const relationshipLabel = (
  entry: RelationshipTypeEntry,
  direction: RelationshipDirection = 'forward'
): string =>
  direction === 'inverse' ? (entry.inverseLabel ?? entry.label) : entry.label;

export const isPositiveRelationship = (
  entry: RelationshipTypeEntry | undefined
): boolean => entry?.role === 'positive';

export const isNegativeRelationship = (
  entry: RelationshipTypeEntry | undefined
): boolean => entry?.role === 'negative';

/**
 * The role-based default color, drawn from `ColorPalette.standing` (so a
 * ruleset that declares no per-entry `color` still gets a sensible
 * positive/neutral/negative tint, and `branding.colors.standing` overrides
 * keep working unchanged). Exposed separately from `resolveRelationshipColor`
 * for callers — like the relationship graph — that only have a role to work
 * with, not a full entry.
 */
export const roleColor = (
  role: RelationshipRole | undefined,
  colors: Pick<ColorPalette, 'standing'>
): ColorToken => {
  switch (role) {
    case 'positive':
      return colors.standing.allied;
    case 'negative':
      return colors.standing.hostile;
    default:
      return colors.standing.neutral;
  }
};

/** The color to render a relationship as: an entry's own override, else `roleColor`. */
export const resolveRelationshipColor = (
  entry: RelationshipTypeEntry | undefined,
  colors: Pick<ColorPalette, 'standing'>
): ColorToken => entry?.color ?? roleColor(entry?.role, colors);
