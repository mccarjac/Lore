import { GameCharacter, GameQuest, QuestStatus } from '@models/types';
import { calculateDerivedStats } from '@/ruleset/derived';
import { getActiveRuleset } from '@/activeRuleset';
import { getCategoryScore, getFacetIds } from '@/ruleset/facets';
import type { RulesetDefinition } from '@/ruleset/types';

export interface QuestProposal {
  questId: string;
  proposedCharacterIds: string[];
}

/** Default number of characters proposed for a quest when it has no
 * explicit `teamSize` set. */
export const DEFAULT_TEAM_SIZE = 4;

/**
 * Scores how well a character fits a quest's desirable/undesirable
 * preferences. Higher is better; the score is unbounded and only meaningful
 * relative to other characters being compared for the same quest.
 *
 * Loops every facet collection rather than four hardcoded id lists (the old
 * `SPECIES_WEIGHT`/`PERK_WEIGHT`/`DISTINCTION_WEIGHT`/`TAG_SCORE_WEIGHT`
 * constants): an exact entry match contributes `collection.matchWeight`
 * (defaulting to 5 for a `single`-selection collection, matching the old
 * species weight, or 3 otherwise, matching the old perk/distinction
 * weights), and a category-score match contributes
 * `collection.categoryMatchWeight` per point (defaulting to 1, matching the
 * old tag-score weight). Undesirable matches subtract the same weight.
 */
export const scoreCharacterForQuest = (
  character: GameCharacter,
  quest: GameQuest,
  ruleset: RulesetDefinition = getActiveRuleset()
): number => {
  const { categoryScores } = calculateDerivedStats(character, ruleset);
  const desirable = quest.desirable;
  const undesirable = quest.undesirable;
  let score = 0;

  ruleset.facets.forEach(collection => {
    const matchWeight =
      collection.matchWeight ?? (collection.selection === 'single' ? 5 : 3);
    const categoryMatchWeight = collection.categoryMatchWeight ?? 1;
    const heldIds = getFacetIds(character, collection.id);

    desirable?.entries?.[collection.id]?.forEach(id => {
      if (heldIds.includes(id)) score += matchWeight;
    });
    undesirable?.entries?.[collection.id]?.forEach(id => {
      if (heldIds.includes(id)) score -= matchWeight;
    });

    desirable?.categories?.[collection.id]?.forEach(categoryId => {
      score +=
        getCategoryScore(categoryScores, collection.id, categoryId) *
        categoryMatchWeight;
    });
    undesirable?.categories?.[collection.id]?.forEach(categoryId => {
      score -=
        getCategoryScore(categoryScores, collection.id, categoryId) *
        categoryMatchWeight;
    });
  });

  return score;
};

/** A quest is eligible for a proposal once it is unresolved and has no team
 * assigned yet. */
export const isProposalTarget = (quest: GameQuest): boolean =>
  quest.status !== QuestStatus.Successful &&
  quest.status !== QuestStatus.Failure &&
  (quest.assignedCharacterIds?.length ?? 0) === 0;

export const getProposalTargetQuests = (quests: GameQuest[]): GameQuest[] =>
  quests.filter(isProposalTarget);

/** Only non-retired characters are eligible to be proposed. */
export const getAvailableCharacters = (
  characters: GameCharacter[]
): GameCharacter[] => characters.filter(character => !character.retired);

const getTeamSize = (quest: GameQuest): number => {
  const size = quest.teamSize;
  return typeof size === 'number' && Number.isFinite(size) && size > 0
    ? Math.floor(size)
    : DEFAULT_TEAM_SIZE;
};

/**
 * Proposes teams for every un-staffed, unresolved quest, drawing only from
 * non-retired characters. Characters are only assigned to one quest each; the
 * same character may be proposed for a second quest only once every
 * available character has already been proposed for at least one quest.
 */
export const generateQuestProposals = (
  quests: GameQuest[],
  characters: GameCharacter[],
  ruleset: RulesetDefinition = getActiveRuleset()
): QuestProposal[] => {
  const targetQuests = getProposalTargetQuests(quests);
  const availableCharacters = getAvailableCharacters(characters);

  const assignments = new Map<string, string[]>(
    targetQuests.map(quest => [quest.id, []])
  );

  if (targetQuests.length === 0 || availableCharacters.length === 0) {
    return targetQuests.map(quest => ({
      questId: quest.id,
      proposedCharacterIds: [],
    }));
  }

  const scoresByQuest = new Map<string, Map<string, number>>(
    targetQuests.map(quest => [
      quest.id,
      new Map(
        availableCharacters.map(character => [
          character.id,
          scoreCharacterForQuest(character, quest, ruleset),
        ])
      ),
    ])
  );

  const usedAtLeastOnce = new Set<string>();

  // Round-robin: each pass, every quest still short of its team size claims
  // its best remaining candidate. Preferring characters unused anywhere keeps
  // duplicates out until the whole available pool has been drawn from once.
  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    for (const quest of targetQuests) {
      const assigned = assignments.get(quest.id)!;
      if (assigned.length >= getTeamSize(quest)) continue;

      let candidates = availableCharacters.filter(
        character => !assigned.includes(character.id)
      );

      const unusedCandidates = candidates.filter(
        character => !usedAtLeastOnce.has(character.id)
      );
      if (unusedCandidates.length > 0) {
        candidates = unusedCandidates;
      }

      if (candidates.length === 0) continue;

      const characterScores = scoresByQuest.get(quest.id)!;
      candidates.sort(
        (a, b) => characterScores.get(b.id)! - characterScores.get(a.id)!
      );

      const chosen = candidates[0];
      assigned.push(chosen.id);
      usedAtLeastOnce.add(chosen.id);
      madeProgress = true;
    }
  }

  return targetQuests.map(quest => ({
    questId: quest.id,
    proposedCharacterIds: assignments.get(quest.id) ?? [],
  }));
};
