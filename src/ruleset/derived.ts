/**
 * Data-driven derived stats (#6), rebuilt on the attribute primitive (#22)
 * and generalized onto facet collections (#51).
 *
 * Every value in the pipeline is a ruleset-declared attribute, and the engine
 * dispatches on `role` (attributes) and `contributes`/`stage` (facet
 * collections) rather than on hardcoded ids or collection names. Nothing
 * here names an archetype, a trait, or health specifically.
 *
 * Evaluation order is load-bearing and reproduces the pre-generalization
 * numbers exactly; `tst/utils/derivedStats.parity.test.ts` (moved with the
 * Afterworlds flavor) and `tst/ruleset/derivedStats.test.ts` here assert
 * against it.
 *
 *   1.  `stage: 'base'` collections seed absolute attribute values, in
 *       declaration order (the old archetype)
 *   1b. character attribute overrides (absolute, not deltas)
 *   2.  `stage: 'preBonus'` collections apply deltas (gated by
 *       `contributes.deltaRoles`) and category scores (gated by
 *       `contributes.categoryScore`) — the old traits
 *   3.  every collection's `categoryBonuses` grants
 *   4.  `stage: 'postBonus'` collections apply deltas and category deltas —
 *       the old modifications
 *   5.  clamp each resource to its cap attribute
 *
 * Three behaviors are preserved deliberately, each pinned by the parity
 * suite. All three are arguably bugs; changing any of them moves real
 * users' numbers and is a rules change rather than a refactor.
 *
 * - **Traits cannot raise caps.** A `preBonus` collection's `deltaRoles`
 *   excludes `'cap'` by default (the trait-like collections here declare
 *   only `['resource']`), so a trait's cap delta is simply never applied —
 *   a consequence of the collection's declared roles, not a special case.
 * - **Modification category deltas do not feed category bonuses.** They
 *   land at step 4, after grants are computed at step 3.
 * - **Only capped resources clamp.** A resource whose definition names no
 *   `capAttributeId` is unbounded.
 */
import type { GameCharacter } from '@models/types';
import { getActiveRuleset } from '@/activeRuleset';
import {
  getNumber,
  roleOf,
  type AttributeBag,
  type AttributeDefinition,
  type AttributeRole,
} from './attributes';
import { getFacetIds, getAuthoredFacets, type FacetCollection } from './facets';
import type { Modifier, RulesetDefinition } from './types';

export interface DerivedStats {
  /** attributeId -> final numeric value, clamped where a cap applies. */
  values: Record<string, number>;
  /** collectionId -> categoryId -> score. */
  categoryScores: Record<string, Record<string, number>>;
  /**
   * The resolved attribute set (`stage: 'base'` collections overlaid with
   * the character's own values). Non-numeric attributes live only here —
   * screens and search read this for display; `values` is the numeric
   * computation result.
   */
  attributes: AttributeBag;
}

/**
 * Entry ids are free-form strings, so stored data can name one the active
 * ruleset does not define. Fall back to an empty attribute set rather than
 * throwing — a character referencing an unknown entry should still render.
 */
const EMPTY_BAG: AttributeBag = {};

const stageOf = (collection: FacetCollection) =>
  collection.contributes?.stage ?? 'preBonus';

const deltaRolesOf = (collection: FacetCollection): AttributeRole[] =>
  collection.contributes?.deltaRoles ?? [];

const contributesCategoryScore = (collection: FacetCollection): boolean =>
  collection.contributes?.categoryScore ?? false;

/**
 * True when `entry` is restricted (via `requires`) to exactly the membership
 * of `groupId` within `groupsCollectionId` — the declarative form of the old
 * `'Perfect Mutant'` carve-out, which tested whether a perk's restriction
 * matched a species group exactly.
 */
const isRestrictedToGroup = (
  entry: { requires?: Record<string, string[]> },
  groupsCollectionId: string,
  groupId: string,
  ruleset: RulesetDefinition
): boolean => {
  const allowed = entry.requires?.[groupsCollectionId];
  if (!allowed) return false;

  const groupsCollection = ruleset.facets.find(
    c => c.id === groupsCollectionId
  );
  const groupMembers = (groupsCollection?.entries ?? [])
    .filter(e => (e.groups ?? []).includes(groupId))
    .map(e => e.id);

  return (
    allowed.length === groupMembers.length &&
    groupMembers.every(id => allowed.includes(id))
  );
};

/** Whether this entry contributes category score, given the character's holdings. */
const contributesScoreForCharacter = (
  entry: FacetCollection['entries'][number],
  collection: FacetCollection,
  character: GameCharacter,
  ruleset: RulesetDefinition
): boolean =>
  !(collection.scoreExclusions ?? []).some(rule => {
    const heldId = getFacetIds(character, rule.whenCollectionId)[0];
    return (
      heldId === rule.whenEntryId &&
      isRestrictedToGroup(entry, rule.whenCollectionId, rule.groupId, ruleset)
    );
  });

/**
 * Applies a modifier's numeric deltas, but only to attributes whose role the
 * caller permits. This is where "traits cannot raise caps" actually lives.
 */
const applyDeltas = (
  target: Record<string, number>,
  modifier: Modifier | undefined,
  definitionsById: Map<string, AttributeDefinition>,
  allowedRoles: AttributeRole[]
): void => {
  Object.entries(modifier?.attributeDeltas ?? {}).forEach(([id, delta]) => {
    if (!delta) return;
    const definition = definitionsById.get(id);
    if (!definition || !allowedRoles.includes(roleOf(definition))) return;
    target[id] = (target[id] ?? 0) + delta;
  });
};

const applyCategoryDeltas = (
  scores: Record<string, Record<string, number>>,
  modifier: Modifier | undefined
): void => {
  Object.entries(modifier?.categoryDeltas ?? {}).forEach(
    ([collectionId, deltas]) => {
      const bucket = (scores[collectionId] ??= {});
      Object.entries(deltas).forEach(([categoryId, delta]) => {
        bucket[categoryId] = (bucket[categoryId] ?? 0) + delta;
      });
    }
  );
};

export const calculateDerivedStats = (
  character: GameCharacter,
  ruleset: RulesetDefinition = getActiveRuleset()
): DerivedStats => {
  const definitionsById = new Map(ruleset.attributes.map(d => [d.id, d]));

  // 1. `stage: 'base'` collections seed absolute attribute values, in
  //    declaration order, then 1b. the character's own values overlay them.
  let attributes: AttributeBag = {};
  ruleset.facets
    .filter(collection => stageOf(collection) === 'base')
    .forEach(collection => {
      const heldId = getFacetIds(character, collection.id)[0];
      const entry = collection.entries.find(e => e.id === heldId);
      attributes = { ...attributes, ...(entry?.attributes ?? EMPTY_BAG) };
    });
  attributes = { ...attributes, ...(character.attributes ?? EMPTY_BAG) };

  // Numeric attributes seed the computation; non-numeric ones ride along in
  // `attributes` untouched.
  const values: Record<string, number> = {};
  ruleset.attributes.forEach(definition => {
    if (definition.type !== 'number') return;
    values[definition.id] = getNumber(attributes, definition.id, 0);
  });

  const categoryScores: Record<string, Record<string, number>> = {};

  // 2. `preBonus` collections: deltas (gated by role) and category scores.
  ruleset.facets
    .filter(collection => stageOf(collection) === 'preBonus')
    .forEach(collection => {
      const heldIds = new Set(getFacetIds(character, collection.id));
      const entries = collection.entries.filter(e => heldIds.has(e.id));
      const deltaRoles = deltaRolesOf(collection);
      const scored = contributesCategoryScore(collection);

      entries.forEach(entry => {
        if (
          scored &&
          entry.categoryId &&
          contributesScoreForCharacter(entry, collection, character, ruleset)
        ) {
          const bucket = (categoryScores[collection.id] ??= {});
          bucket[entry.categoryId] = (bucket[entry.categoryId] ?? 0) + 1;
        }
        applyDeltas(values, entry.modifier, definitionsById, deltaRoles);
      });
    });

  // 3. Category-bonus grants, evaluated across every collection that
  //    declares them.
  ruleset.facets.forEach(collection => {
    (collection.categoryBonuses ?? []).forEach(bonus => {
      const score = categoryScores[collection.id]?.[bonus.categoryId] ?? 0;
      if (score >= bonus.requiredScore) {
        applyDeltas(values, bonus.grants, definitionsById, ['resource']);
      }
    });
  });

  // 4. `postBonus` collections: deltas (gated by role) and category deltas —
  //    these may move caps as well as values, and land after grants so they
  //    never retroactively unlock a threshold.
  ruleset.facets
    .filter(collection => stageOf(collection) === 'postBonus')
    .forEach(collection => {
      const deltaRoles = deltaRolesOf(collection);
      const heldIds = new Set(getFacetIds(character, collection.id));
      const catalogEntries = collection.entries.filter(e => heldIds.has(e.id));
      const authoredEntries = collection.authored
        ? getAuthoredFacets(character, collection.id)
        : [];

      [...catalogEntries, ...authoredEntries].forEach(entry => {
        applyDeltas(values, entry.modifier, definitionsById, deltaRoles);
        applyCategoryDeltas(categoryScores, entry.modifier);
      });
    });

  // 5. Clamp each resource to its cap attribute, where one is declared.
  ruleset.attributes.forEach(definition => {
    if (roleOf(definition) !== 'resource' || !definition.capAttributeId) {
      return;
    }
    const cap = values[definition.capAttributeId];
    if (cap === undefined) return;
    values[definition.id] = Math.min(values[definition.id] ?? 0, cap);
  });

  return { values, categoryScores, attributes };
};
