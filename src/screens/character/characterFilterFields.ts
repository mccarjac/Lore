import { useMemo } from 'react';
import { GameCharacter } from '@/models/types';
import { useRuleset } from '@/ruleset';
import { getFacetIds } from '@/ruleset/facets';
import { FilterFieldConfig } from '@/components/search/filterFieldTypes';

/**
 * Generates one filter field per facet collection the ruleset declares,
 * rather than the old hardcoded `perkId`/`distinctionId`/`traitCategory`/
 * `minTagScore`/`recipeId` set. A collection with `categories` gets a paired
 * category + min-score field (the old trait-category pair, generalized); a
 * `selection: 'catalog'` collection gets a filter only if some other
 * collection's entries actually `links` into it (the old `recipes` feature
 * gate, generalized into "is this catalog reachable at all"). An `authored`
 * collection (the old `modifications`) has no catalog ids to filter on and
 * is skipped, matching the pre-#51 behavior of never filtering on it either.
 *
 * Note this also, for the first time, gives a `single`-selection collection
 * (the old archetype) a filter field — it never had one before, despite
 * being a stored facet like any other.
 */
export function useCharacterFilterFields(): FilterFieldConfig[] {
  const { ruleset } = useRuleset();

  return useMemo(() => {
    const fields: FilterFieldConfig[] = [];

    ruleset.facets
      .filter(
        collection => collection.selection !== 'catalog' && !collection.authored
      )
      .forEach(collection => {
        fields.push({
          key: `facet:${collection.id}`,
          type: 'select',
          label: collection.singular,
          options: collection.entries.map(entry => ({
            value: entry.id,
            label: entry.label,
          })),
          matches: (item, value) =>
            getFacetIds(item as GameCharacter, collection.id).includes(value),
        });

        if (collection.categories && collection.categories.length > 0) {
          const categoryFilterKey = `facetCategory:${collection.id}`;

          fields.push({
            key: categoryFilterKey,
            type: 'select',
            label: `${collection.categorySingular ?? 'Category'} (for min score)`,
            options: collection.categories.map(category => ({
              value: category.id,
              label: category.label,
            })),
            // Filtering happens in the paired min-score field below.
            matches: () => true,
          });
          fields.push({
            key: `facetMinScore:${collection.id}`,
            type: 'number',
            label: `${collection.categorySingular ?? 'Category'} Min Score`,
            placeholder: 'Min Score',
            matches: (item, value, allValues) => {
              const categoryId = allValues[categoryFilterKey] as
                | string
                | undefined;
              if (!categoryId) return true;
              const heldIds = new Set(
                getFacetIds(item as GameCharacter, collection.id)
              );
              const score = collection.entries.filter(
                entry =>
                  heldIds.has(entry.id) && entry.categoryId === categoryId
              ).length;
              return score >= value;
            },
          });
        }
      });

    ruleset.facets
      .filter(collection => collection.selection === 'catalog')
      .forEach(catalogCollection => {
        const linkingCollections = ruleset.facets.filter(collection =>
          collection.entries.some(
            entry => (entry.links?.[catalogCollection.id]?.length ?? 0) > 0
          )
        );
        if (linkingCollections.length === 0) return;

        fields.push({
          key: `facetLink:${catalogCollection.id}`,
          type: 'select',
          label: catalogCollection.singular,
          options: catalogCollection.entries.map(entry => ({
            value: entry.id,
            label: entry.label,
          })),
          matches: (item, value) => {
            const character = item as GameCharacter;
            return linkingCollections.some(collection => {
              const heldIds = new Set(getFacetIds(character, collection.id));
              return collection.entries.some(
                entry =>
                  heldIds.has(entry.id) &&
                  entry.links?.[catalogCollection.id]?.includes(value)
              );
            });
          },
        });
      });

    fields.push(
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
      }
    );

    return fields;
  }, [ruleset]);
}
