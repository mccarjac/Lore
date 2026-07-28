import { GameCharacter } from '../models/types';
import { getLabel, type RulesetDefinition } from '../ruleset';
import { getActiveRuleset } from '@/activeRuleset';

export interface CharacterStats {
  totalCharacters: number;
  archetypeDistribution: Record<string, number>;
  factionDistribution: Record<string, number>;
  commonPerks: { name: string; count: number }[];
  commonDistinctions: { name: string; count: number }[];
  factionStandings: Record<string, Record<string, number>>;
}

/**
 * `ruleset` defaults to the active ruleset so existing callers are
 * unaffected; pass the active ruleset explicitly from a screen that has one.
 */
export const calculateCharacterStats = (
  characters: GameCharacter[],
  ruleset: RulesetDefinition = getActiveRuleset()
): CharacterStats => {
  if (!characters.length) {
    throw new Error('No characters available for statistics calculation');
  }

  const totalCharacters = characters.length;

  // Calculate species distribution
  const archetypeDistribution = characters.reduce(
    (acc, char) => {
      acc[char.archetypeId] = (acc[char.archetypeId] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate faction distribution
  const factionDistribution = characters.reduce(
    (acc, char) => {
      char.factions.forEach(faction => {
        acc[faction.name] = (acc[faction.name] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate faction standings distribution
  const factionStandings: Record<string, Record<string, number>> = {};
  characters.forEach(char => {
    char.factions.forEach(faction => {
      if (!factionStandings[faction.name]) {
        factionStandings[faction.name] = {};
      }
      factionStandings[faction.name][faction.standing] =
        (factionStandings[faction.name][faction.standing] || 0) + 1;
    });
  });

  // Calculate most common perks
  const perkCount: Record<string, number> = {};
  characters.forEach(char => {
    char.traitIds.forEach(perkId => {
      perkCount[perkId] = (perkCount[perkId] || 0) + 1;
    });
  });

  const commonPerks = Object.entries(perkCount)
    .map(([id, count]) => ({
      name:
        ruleset.traits.find(trait => trait.id === id)?.name ||
        `Unknown ${getLabel(ruleset, 'trait.singular')}`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate most common distinctions
  const distinctionCount: Record<string, number> = {};
  characters.forEach(char => {
    char.qualityIds.forEach(distinctionId => {
      distinctionCount[distinctionId] =
        (distinctionCount[distinctionId] || 0) + 1;
    });
  });

  const commonDistinctions = Object.entries(distinctionCount)
    .map(([id, count]) => ({
      name:
        ruleset.qualities.find(quality => quality.id === id)?.name ||
        `Unknown ${getLabel(ruleset, 'quality.singular')}`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalCharacters,
    archetypeDistribution,
    factionDistribution,
    commonPerks,
    commonDistinctions,
    factionStandings,
  };
};
