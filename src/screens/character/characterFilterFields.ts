import { useMemo } from 'react';
import { GameCharacter } from '@/models/types';
import { useLabels, useRuleset, useFeature } from '@/ruleset';
import { FilterFieldConfig } from '@/components/search/filterFieldTypes';

export function useCharacterFilterFields(): FilterFieldConfig[] {
  const label = useLabels();
  const { ruleset } = useRuleset();
  const recipesEnabled = useFeature('recipes');

  return useMemo(() => {
    const fields: FilterFieldConfig[] = [
      {
        key: 'perkId',
        type: 'select',
        label: label('trait.singular'),
        options: ruleset.traits.map(trait => ({
          value: trait.id,
          label: trait.name,
        })),
        matches: (item, value) =>
          (item as GameCharacter).traitIds.includes(value),
      },
      {
        key: 'distinctionId',
        type: 'select',
        label: label('quality.singular'),
        options: ruleset.qualities.map(quality => ({
          value: quality.id,
          label: quality.name,
        })),
        matches: (item, value) =>
          (item as GameCharacter).qualityIds.includes(value),
      },
      {
        key: 'traitCategory',
        type: 'select',
        label: `${label('traitCategory.singular')} (for min score)`,
        options: ruleset.traitCategories.map(category => ({
          value: category.id,
          label: category.label,
        })),
        // Filtering happens in the paired minTagScore field below.
        matches: () => true,
      },
      {
        key: 'minTagScore',
        type: 'number',
        label: `${label('traitCategory.singular')} Min Score`,
        placeholder: 'Min Score',
        matches: (item, value, allValues) => {
          const categoryId = allValues.traitCategory as string | undefined;
          if (!categoryId) {
            return true;
          }
          const character = item as GameCharacter;
          const score = ruleset.traits.filter(
            trait =>
              character.traitIds.includes(trait.id) &&
              trait.categoryId === categoryId
          ).length;
          return score >= value;
        },
      },
      {
        key: 'presentStatus',
        type: 'select',
        label: 'Present Status',
        options: [
          { value: 'present', label: 'Present' },
          { value: 'absent', label: 'Absent' },
        ],
        matches: (item, value) => {
          const isPresent = (item as GameCharacter).present === true;
          return value === 'present' ? isPresent : !isPresent;
        },
      },
      {
        key: 'retiredStatus',
        type: 'select',
        label: 'Retired Status',
        defaultValue: 'active',
        options: [
          { value: 'active', label: 'Active Only' },
          { value: 'retired', label: 'Retired Only' },
        ],
        matches: (item, value) => {
          const isRetired = (item as GameCharacter).retired === true;
          return value === 'retired' ? isRetired : !isRetired;
        },
      },
    ];

    if (recipesEnabled) {
      fields.push({
        key: 'recipeId',
        type: 'select',
        label: label('recipe.singular'),
        options: (ruleset.recipes ?? []).map(recipe => ({
          value: recipe.id,
          label: recipe.name,
        })),
        matches: (item, value) => {
          const character = item as GameCharacter;
          const characterTraits = ruleset.traits.filter(
            trait => character.traitIds.includes(trait.id) && trait.recipeIds
          );
          return characterTraits.some(trait =>
            trait.recipeIds?.includes(value)
          );
        },
      });
    }

    return fields;
  }, [label, ruleset, recipesEnabled]);
}
