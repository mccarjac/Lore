import { GameCharacter } from '@/models/types';
import {
  SPECIES_BASE_STATS,
  MUTANT_SPECIES,
  type Species,
} from '@/models/speciesTypes';
import { AVAILABLE_PERKS, PerkTag, TAG_SCORE_BONUSES } from '@/models/gameData';

export interface CharacterDerivedStats {
  maxHealth: number;
  maxLimit: number;
  tagScores?: Map<PerkTag, number>;
}

export const calculateDerivedStats = (
  character: GameCharacter
): CharacterDerivedStats => {
  // Archetype ids are free-form strings since #3, so a record written by an
  // older build or a hand-edited import can name one this ruleset does not
  // define. Fall back rather than dereferencing undefined — the closed
  // `Species` union used to make that unrepresentable.
  const baseStats =
    SPECIES_BASE_STATS[character.archetypeId as Species] ??
    SPECIES_BASE_STATS.Unknown;

  // Initialize with base values
  let maxHealth = baseStats.baseHealth;
  let maxLimit = baseStats.baseLimit;

  // Get all perks the character has
  const characterPerks = AVAILABLE_PERKS.filter(perk =>
    character.traitIds.includes(perk.id)
  );

  // Calculate tag scores
  const tagScores = new Map<PerkTag, number>();
  characterPerks.forEach(perk => {
    // Perfect Mutants don't get tag score bonuses from MUTANT_SPECIES restricted perks
    if (
      character.archetypeId !== 'Perfect Mutant' ||
      !perk.allowedSpecies ||
      !(
        perk.allowedSpecies.length === MUTANT_SPECIES.length &&
        MUTANT_SPECIES.every(species => perk.allowedSpecies!.includes(species))
      )
    ) {
      const currentScore = tagScores.get(perk.tag) || 0;
      tagScores.set(perk.tag, currentScore + 1);
    }

    // Apply perk modifiers
    if (perk.statModifiers) {
      if (perk.statModifiers.health) {
        maxHealth += perk.statModifiers.health;
      }
      if (perk.statModifiers.limit) {
        maxLimit += perk.statModifiers.limit;
      }
    }
  });

  // Apply tag score bonuses
  tagScores.forEach((score, tag) => {
    const tagBonuses = TAG_SCORE_BONUSES[tag];
    tagBonuses.forEach(bonus => {
      if (score >= bonus.requiredScore) {
        if (bonus.health) {
          maxHealth += bonus.health;
        }
        if (bonus.limit) {
          maxLimit += bonus.limit;
        }
      }
    });
  });

  // Apply modifications modifiers
  if (character.modifications && character.modifications.length > 0) {
    character.modifications.forEach(modification => {
      const modifiers = modification.resourceModifiers;
      if (modifiers) {
        if (modifiers.values?.health) {
          maxHealth += modifiers.values.health;
        }
        if (modifiers.values?.limit) {
          maxLimit += modifiers.values.limit;
        }
        if (modifiers.caps?.health) {
          baseStats.healthCap += modifiers.caps.health;
        }
        if (modifiers.caps?.limit) {
          baseStats.limitCap += modifiers.caps.limit;
        }
        // Category modifiers can be added to tag scores if needed
        if (modifiers.categoryModifiers) {
          Object.entries(modifiers.categoryModifiers).forEach(
            ([tag, modifier]) => {
              const currentScore = tagScores.get(tag as PerkTag) || 0;
              tagScores.set(tag as PerkTag, currentScore + modifier);
            }
          );
        }
      }
    });
  }

  // Apply species caps
  maxHealth = Math.min(maxHealth, baseStats.healthCap);
  maxLimit = Math.min(maxLimit, baseStats.limitCap);

  return {
    maxHealth,
    maxLimit,
    tagScores,
  };
};
