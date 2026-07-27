/**
 * Data-driven derived stats (#6), rebuilt on the attribute primitive (#22).
 *
 * Every value in the pipeline is a ruleset-declared attribute, and the engine
 * dispatches on `role` rather than on hardcoded resource ids. Nothing here
 * names health or limit.
 *
 * Evaluation order is load-bearing and reproduces the pre-generalization
 * numbers exactly; `tst/utils/derivedStats.parity.test.ts` asserts all 26
 * cases against a baseline captured before any of this existed.
 *
 *   1.  archetype base attributes
 *   1b. character attribute overrides (absolute, not deltas)
 *   2.  trait deltas (role 'resource' only) and category scores
 *   3.  category-bonus grants (role 'resource')
 *   4.  modification deltas (roles 'resource' and 'cap')
 *   5.  clamp each resource to its cap attribute
 *
 * Three behaviors are preserved deliberately, each pinned by the parity suite.
 * All three are arguably bugs; changing any of them moves real users' numbers
 * and is a rules change rather than a refactor.
 *
 * - **Traits cannot raise caps.** Afterworlds' `smarts_20` declares
 *   `limitCap: +1` and the engine has never applied it. Rather than a special
 *   case, this now falls out of the role rule at step 2.
 * - **Modification category deltas do not feed category bonuses.** They land
 *   at step 4, after grants are computed at step 3, so they change the
 *   reported score without retroactively unlocking a threshold.
 * - **Only capped resources clamp.** A resource whose definition names no
 *   `capAttributeId` is unbounded.
 */
import type { GameCharacter } from '@models/types';
import { activeRuleset } from '@/activeRuleset';
import {
  getNumber,
  roleOf,
  type AttributeBag,
  type AttributeDefinition,
  type AttributeRole,
} from './attributes';
import type { Modifier, RulesetDefinition, Trait } from './types';

export interface DerivedStats {
  /** attributeId -> final numeric value, clamped where a cap applies. */
  values: Record<string, number>;
  /** traitCategoryId -> score. */
  categoryScores: Map<string, number>;
  /**
   * The resolved attribute set (archetype base overlaid with the character's
   * own values). Non-numeric attributes live only here — screens and search
   * read this for display; `values` is the numeric computation result.
   */
  attributes: AttributeBag;
}

/**
 * Archetype ids are free-form strings since #3, so stored data can name one
 * the active ruleset does not define. Fall back to an empty attribute set
 * rather than throwing — a character with an unknown archetype should still
 * render.
 */
const EMPTY_BAG: AttributeBag = {};

/**
 * True when `trait` is restricted to exactly the membership of `groupId` —
 * the declarative form of the old `'Perfect Mutant'` carve-out, which tested
 * whether a perk's `allowedSpecies` matched MUTANT_SPECIES exactly.
 */
const isRestrictedToGroup = (
  trait: Trait,
  groupId: string,
  ruleset: RulesetDefinition
): boolean => {
  const allowed = trait.allowedArchetypeIds;
  if (!allowed) return false;

  const groupMembers = ruleset.archetypes
    .filter(archetype => archetype.groups.includes(groupId))
    .map(archetype => archetype.id);

  return (
    allowed.length === groupMembers.length &&
    groupMembers.every(id => allowed.includes(id))
  );
};

/** Whether this trait contributes category score for this archetype. */
const contributesCategoryScore = (
  trait: Trait,
  archetypeId: string,
  ruleset: RulesetDefinition
): boolean =>
  !(ruleset.archetypeRules ?? []).some(
    rule =>
      rule.archetypeId === archetypeId &&
      rule.kind === 'excludeCategoryScoreFromGroupRestrictedTraits' &&
      isRestrictedToGroup(trait, rule.groupId, ruleset)
  );

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
  scores: Map<string, number>,
  modifier: Modifier | undefined
): void => {
  Object.entries(modifier?.categoryDeltas ?? {}).forEach(([id, delta]) => {
    scores.set(id, (scores.get(id) ?? 0) + delta);
  });
};

export const calculateDerivedStats = (
  character: GameCharacter,
  ruleset: RulesetDefinition = activeRuleset
): DerivedStats => {
  const definitionsById = new Map(ruleset.attributes.map(d => [d.id, d]));
  const archetype = ruleset.archetypes.find(
    a => a.id === character.archetypeId
  );

  // 1 + 1b. Base attributes, overlaid with the character's own values.
  // Character attributes are absolute overrides, not deltas — "this character
  // has Corruption 3" and "this character's base Health is 3" both read as
  // assignments. Deltas are what traits and modifications are for.
  const attributes: AttributeBag = {
    ...(archetype?.attributes ?? EMPTY_BAG),
    ...(character.attributes ?? EMPTY_BAG),
  };

  // Numeric attributes seed the computation; non-numeric ones ride along in
  // `attributes` untouched.
  const values: Record<string, number> = {};
  ruleset.attributes.forEach(definition => {
    if (definition.type !== 'number') return;
    values[definition.id] = getNumber(attributes, definition.id, 0);
  });

  const traits = ruleset.traits.filter(trait =>
    character.traitIds.includes(trait.id)
  );

  // 2. Trait deltas and category scores. Resource role only: a trait may not
  //    raise a cap (see the module comment).
  const categoryScores = new Map<string, number>();
  traits.forEach(trait => {
    if (contributesCategoryScore(trait, character.archetypeId, ruleset)) {
      categoryScores.set(
        trait.categoryId,
        (categoryScores.get(trait.categoryId) ?? 0) + 1
      );
    }
    applyDeltas(values, trait.modifier, definitionsById, ['resource']);
  });

  // 3. Category-bonus grants.
  ruleset.categoryBonuses.forEach(bonus => {
    const score = categoryScores.get(bonus.categoryId) ?? 0;
    if (score >= bonus.requiredScore) {
      applyDeltas(values, bonus.grants, definitionsById, ['resource']);
    }
  });

  // 4. Modification deltas — these may move caps as well as values.
  (character.modifications ?? []).forEach(modification => {
    applyDeltas(values, modification.modifier, definitionsById, [
      'resource',
      'cap',
    ]);
    applyCategoryDeltas(categoryScores, modification.modifier);
  });

  // 5. Clamp each resource to its cap attribute, where one is declared.
  ruleset.attributes.forEach(definition => {
    if (roleOf(definition) !== 'resource' || !definition.capAttributeId) return;
    const cap = values[definition.capAttributeId];
    if (cap === undefined) return;
    values[definition.id] = Math.min(values[definition.id] ?? 0, cap);
  });

  return { values, categoryScores, attributes };
};
