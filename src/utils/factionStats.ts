import { GameCharacter, RelationshipStanding } from '../models/types';
import { FactionRelationship } from './characterStorage';
import { type RulesetDefinition } from '../ruleset';
import { getActiveRuleset } from '@/activeRuleset';
import { getFacetIds } from '@/ruleset/facets';

/** A category's member count within one facet collection, plus its share. */
export interface FactionFacetCategoryStats {
  categoryId: string;
  label: string;
  count: number;
  percentage: number;
}

/** Distribution over one facet collection's held entries, faction-scoped. */
export interface FactionFacetStats {
  collectionId: string;
  singular: string;
  plural: string;
  categorySingular?: string;
  categoryPlural?: string;
  selection: 'single' | 'multi' | 'catalog';
  /**
   * categoryId -> member count, initialized to 0 for every category the
   * *collection* declares (rather than a hardcoded enum) — this is what
   * lets a collection with a different number of categories render at all.
   * Empty for a collection with no `categories`.
   */
  categoryCounts: Record<string, number>;
  topCategories: FactionFacetCategoryStats[];
  /** Most commonly held entries in this collection, resolved to labels. */
  topEntries: {
    id: string;
    label: string;
    count: number;
    percentage: number;
  }[];
}

export interface FactionStats {
  factionName: string;
  totalMembers: number;
  presentMembers: number;

  /** One entry per non-catalog facet collection the ruleset declares. */
  facetCollections: FactionFacetStats[];

  // Relationships
  relationships: FactionRelationship[];
  alliedFactions: string[];
  enemyFactions: string[];

  // Combined strength (with allies)
  combinedMemberCount?: number;
  /** collectionId -> categoryId -> count, combined across allies. */
  combinedCategoryCounts?: Record<string, Record<string, number>>;
}

export interface CombinedFactionAnalysis {
  factionName: string;
  directMembers: number;
  alliedFactions: string[];
  combinedMembers: number;
  /** collectionId -> categoryId -> count, combined across allies. */
  combinedCategoryCounts: Record<string, Record<string, number>>;
  strengthMultiplier: number; // Combined vs direct member ratio
}

/**
 * Calculate statistics for a single faction based on its members.
 * `ruleset` defaults to the active ruleset so existing callers are
 * unaffected; pass the active ruleset explicitly from a screen that has one.
 */
export const calculateFactionStats = (
  factionName: string,
  allCharacters: GameCharacter[],
  factionRelationships: FactionRelationship[] = [],
  ruleset: RulesetDefinition = getActiveRuleset()
): FactionStats => {
  // Get faction members (only positive relationships count as members)
  const members = allCharacters.filter(char => {
    const faction = char.factions.find(f => f.name === factionName);
    return (
      faction &&
      (faction.standing === RelationshipStanding.Ally ||
        faction.standing === RelationshipStanding.Friend)
    );
  });

  // Analyze relationships
  const alliedFactions = factionRelationships
    .filter(
      rel =>
        rel.relationshipType === RelationshipStanding.Ally ||
        rel.relationshipType === RelationshipStanding.Friend
    )
    .map(rel => rel.factionName);

  const enemyFactions = factionRelationships
    .filter(
      rel =>
        rel.relationshipType === RelationshipStanding.Enemy ||
        rel.relationshipType === RelationshipStanding.Hostile
    )
    .map(rel => rel.factionName);

  if (members.length === 0) {
    // Return empty stats for factions with no members
    return {
      factionName,
      totalMembers: 0,
      presentMembers: 0,
      facetCollections: [],
      relationships: factionRelationships,
      alliedFactions,
      enemyFactions,
    };
  }

  const totalMembers = members.length;
  const presentMembers = members.filter(m => m.present === true).length;

  // One distribution per facet collection — the generalized form of the old
  // perkTagCounts/topPerkTags/commonPerks/commonDistinctions/
  // archetypeDistribution, which hardcoded exactly three collections plus
  // one collection's categories. A catalog collection (recipes) is
  // excluded: it's never held directly, so it has nothing to count.
  const facetCollections: FactionFacetStats[] = ruleset.facets
    .filter(collection => collection.selection !== 'catalog')
    .map(collection => {
      const categoryCounts: Record<string, number> = Object.fromEntries(
        (collection.categories ?? []).map(category => [category.id, 0])
      );
      const entryCounts: Record<string, number> = {};

      members.forEach(member => {
        getFacetIds(member, collection.id).forEach(id => {
          entryCounts[id] = (entryCounts[id] ?? 0) + 1;
          const entry = collection.entries.find(e => e.id === id);
          if (entry?.categoryId) {
            categoryCounts[entry.categoryId] =
              (categoryCounts[entry.categoryId] ?? 0) + 1;
          }
        });
      });

      const topCategories = Object.entries(categoryCounts)
        .map(([categoryId, count]) => ({
          categoryId,
          label:
            collection.categories?.find(c => c.id === categoryId)?.label ??
            categoryId,
          count,
          percentage: (count / totalMembers) * 100,
        }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const topEntries = Object.entries(entryCounts)
        .map(([id, count]) => ({
          id,
          label:
            collection.entries.find(entry => entry.id === id)?.label ??
            `Unknown ${collection.singular}`,
          count,
          percentage: (count / totalMembers) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        collectionId: collection.id,
        singular: collection.singular,
        plural: collection.plural,
        categorySingular: collection.categorySingular,
        categoryPlural: collection.categoryPlural,
        selection: collection.selection,
        categoryCounts,
        topCategories,
        topEntries,
      };
    });

  return {
    factionName,
    totalMembers,
    presentMembers,
    facetCollections,
    relationships: factionRelationships,
    alliedFactions,
    enemyFactions,
  };
};

/**
 * Calculate combined statistics for a faction including its allies
 */
export const calculateCombinedFactionStats = (
  factionName: string,
  allCharacters: GameCharacter[],
  allFactionRelationships: Map<string, FactionRelationship[]>,
  ruleset: RulesetDefinition = getActiveRuleset()
): CombinedFactionAnalysis => {
  // Get base stats for the main faction
  const mainFactionRelationships =
    allFactionRelationships.get(factionName) || [];
  const baseStats = calculateFactionStats(
    factionName,
    allCharacters,
    mainFactionRelationships,
    ruleset
  );

  // Get allied factions
  const alliedFactions = baseStats.alliedFactions;

  // Calculate combined member count and category counts including allies
  let combinedMembers = baseStats.totalMembers;
  const combinedCategoryCounts: Record<string, Record<string, number>> = {};
  baseStats.facetCollections.forEach(collection => {
    combinedCategoryCounts[collection.collectionId] = {
      ...collection.categoryCounts,
    };
  });

  alliedFactions.forEach(allyName => {
    const allyRelationships = allFactionRelationships.get(allyName) || [];
    const allyStats = calculateFactionStats(
      allyName,
      allCharacters,
      allyRelationships,
      ruleset
    );
    combinedMembers += allyStats.totalMembers;

    // Add ally category counts to combined totals, per collection.
    allyStats.facetCollections.forEach(collection => {
      const bucket = (combinedCategoryCounts[collection.collectionId] ??= {});
      Object.entries(collection.categoryCounts).forEach(
        ([categoryId, count]) => {
          bucket[categoryId] = (bucket[categoryId] ?? 0) + count;
        }
      );
    });
  });

  const strengthMultiplier =
    baseStats.totalMembers > 0 ? combinedMembers / baseStats.totalMembers : 1;

  return {
    factionName,
    directMembers: baseStats.totalMembers,
    alliedFactions,
    combinedMembers,
    combinedCategoryCounts,
    strengthMultiplier,
  };
};

/**
 * Get all faction statistics for display
 *
 * Note: This is a convenience function for getting stats for factions from a relationships map.
 * In practice, you may want to load factions from storage directly to ensure all factions
 * are included, not just those with relationships defined.
 *
 * @deprecated Consider using calculateFactionStats directly with faction list from loadFactions()
 */
export const getAllFactionStats = (
  allCharacters: GameCharacter[],
  allFactionRelationships: Map<string, FactionRelationship[]>,
  ruleset: RulesetDefinition = getActiveRuleset()
): FactionStats[] => {
  const factionNames = Array.from(allFactionRelationships.keys());

  return factionNames.map(factionName =>
    calculateFactionStats(
      factionName,
      allCharacters,
      allFactionRelationships.get(factionName) || [],
      ruleset
    )
  );
};
