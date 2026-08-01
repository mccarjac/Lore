import { GameCharacter } from '../models/types';
import { type RulesetDefinition } from '../ruleset';
import { getActiveRuleset } from '@/activeRuleset';
import { getFacetIds } from '@/ruleset/facets';

/** Distribution over one facet collection's held entries, across characters. */
export interface FacetCollectionStats {
  collectionId: string;
  singular: string;
  plural: string;
  selection: 'single' | 'multi' | 'catalog';
  /** entryId -> number of characters holding it. */
  counts: Record<string, number>;
  /** Same counts, resolved to labels and sorted by count descending. */
  entries: { id: string; label: string; count: number }[];
}

export interface CharacterStats {
  totalCharacters: number;
  /** One entry per non-catalog facet collection the ruleset declares. */
  facetCollections: FacetCollectionStats[];
  factionDistribution: Record<string, number>;
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
      factionStandings[faction.name][faction.relationshipTypeId] =
        (factionStandings[faction.name][faction.relationshipTypeId] || 0) + 1;
    });
  });

  // One distribution per facet collection — the generalized form of the old
  // archetypeDistribution/commonPerks/commonDistinctions, which hardcoded
  // exactly three collections. A catalog collection (recipes) is excluded:
  // it's never held directly, so it has nothing to count.
  const facetCollections: FacetCollectionStats[] = ruleset.facets
    .filter(collection => collection.selection !== 'catalog')
    .map(collection => {
      const counts: Record<string, number> = {};
      characters.forEach(character => {
        getFacetIds(character, collection.id).forEach(id => {
          counts[id] = (counts[id] ?? 0) + 1;
        });
      });

      const entries = Object.entries(counts)
        .map(([id, count]) => ({
          id,
          label:
            collection.entries.find(entry => entry.id === id)?.label ??
            `Unknown ${collection.singular}`,
          count,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        collectionId: collection.id,
        singular: collection.singular,
        plural: collection.plural,
        selection: collection.selection,
        counts,
        entries,
      };
    });

  return {
    totalCharacters,
    facetCollections,
    factionDistribution,
    factionStandings,
  };
};
