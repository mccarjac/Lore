/**
 * Data-driven derived stats (issue #6).
 *
 * Replaces the hardcoded `{ maxHealth, maxLimit }` pair with a per-resource
 * record computed entirely from the ruleset, so a flavor with three
 * resources — or one, or none — needs no code change.
 *
 * Evaluation order is load-bearing and matches the pre-generalization
 * implementation exactly; `tst/utils/derivedStats.parity.test.ts` asserts
 * every case against numbers captured before the rewrite.
 *
 *   1. archetype base values
 *   2. trait value modifiers, and category scores
 *   3. category-bonus grants
 *   4. modification value/cap/category modifiers
 *   5. clamp to caps
 *
 * Two deliberate carry-overs from the old behavior, both verified by the
 * parity suite:
 *
 * - **Trait cap modifiers are ignored.** A trait may declare
 *   `resourceModifiers.caps` (Afterworlds' `smarts_20` does), but the engine
 *   has never applied them and doing so now would move real users' numbers.
 *   Correcting that is a deliberate rules change, not part of a rename.
 * - **Modification category modifiers do not feed category bonuses.** They
 *   are applied in step 4, after grants are computed in step 3, so they
 *   affect the reported score without retroactively unlocking a threshold.
 */
import type { GameCharacter } from '@models/types';
import { afterworldsRuleset } from './defaultRuleset';
import type { Archetype, RulesetDefinition, Trait } from './types';

export interface DerivedStats {
  /** resourceId -> final value, already clamped to the effective cap. */
  values: Record<string, number>;
  /** traitCategoryId -> score. */
  categoryScores: Map<string, number>;
}

/**
 * Archetype ids are free-form strings since #3, so stored data can name one
 * the active ruleset does not define. Fall back to a zeroed archetype rather
 * than throwing — a character with an unknown archetype should still render.
 */
const fallbackArchetype = (ruleset: RulesetDefinition): Archetype => ({
  id: '',
  label: '',
  groups: [],
  baseValues: Object.fromEntries(ruleset.resources.map(r => [r.id, 0])),
  caps: Object.fromEntries(ruleset.resources.map(r => [r.id, 0])),
  capabilities: {},
});

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

const addTo = (
  target: Record<string, number>,
  deltas: Record<string, number> | undefined
): void => {
  if (!deltas) return;
  Object.entries(deltas).forEach(([id, delta]) => {
    if (delta) target[id] = (target[id] ?? 0) + delta;
  });
};

export const calculateDerivedStats = (
  character: GameCharacter,
  ruleset: RulesetDefinition = afterworldsRuleset
): DerivedStats => {
  const archetype =
    ruleset.archetypes.find(a => a.id === character.archetypeId) ??
    fallbackArchetype(ruleset);

  // Copies, not references. The pre-#6 implementation applied modification
  // cap modifiers straight onto the shared archetype record, which leaked
  // the raised cap into every other character of that archetype for the
  // lifetime of the process.
  const values: Record<string, number> = { ...archetype.baseValues };
  const caps: Record<string, number> = { ...archetype.caps };

  const traits = ruleset.traits.filter(trait =>
    character.traitIds.includes(trait.id)
  );

  // 2. Trait category scores and value modifiers.
  const categoryScores = new Map<string, number>();
  traits.forEach(trait => {
    if (contributesCategoryScore(trait, character.archetypeId, ruleset)) {
      categoryScores.set(
        trait.categoryId,
        (categoryScores.get(trait.categoryId) ?? 0) + 1
      );
    }
    addTo(values, trait.resourceModifiers?.values);
  });

  // 3. Category-bonus grants.
  ruleset.categoryBonuses.forEach(bonus => {
    const score = categoryScores.get(bonus.categoryId) ?? 0;
    if (score >= bonus.requiredScore) addTo(values, bonus.grants);
  });

  // 4. Modification modifiers.
  (character.modifications ?? []).forEach(modification => {
    const modifiers = modification.resourceModifiers;
    if (!modifiers) return;

    addTo(values, modifiers.values);
    addTo(caps, modifiers.caps);

    if (modifiers.categoryModifiers) {
      Object.entries(modifiers.categoryModifiers).forEach(
        ([categoryId, delta]) => {
          categoryScores.set(
            categoryId,
            (categoryScores.get(categoryId) ?? 0) + delta
          );
        }
      );
    }
  });

  // 5. Clamp each capped resource to its effective cap.
  ruleset.resources.forEach(resource => {
    if (!resource.capped) return;
    const cap = caps[resource.id];
    if (cap === undefined) return;
    values[resource.id] = Math.min(values[resource.id] ?? 0, cap);
  });

  return { values, categoryScores };
};
