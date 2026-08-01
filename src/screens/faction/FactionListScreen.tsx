import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GameCharacter, FactionMembership } from '@models/types';
import {
  loadCharacters,
  getFactionDescription,
  migrateFactionDescriptions,
  loadFactions,
} from '@utils/characterStorage';
import {
  useNavigation,
  useFocusEffect,
  CompositeNavigationProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RootStackParamList, RootDrawerParamList } from '@/navigation/types';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import {
  BaseListScreen,
  HeaderAddButton,
  ActiveFiltersBar,
  useEntitySearch,
  type FilterFieldConfig,
} from '@/components';
import { useLabels, useRuleset } from '@/ruleset';
import {
  findRelationshipCollectionForPair,
  findRelationshipEntry,
  isPositiveRelationship,
  relationshipLabel,
  resolveRelationshipColor,
  type RelationshipTypeCollection,
} from '@/ruleset/relationships';

type FactionNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'Factions'>,
  StackNavigationProp<RootStackParamList>
>;

interface FactionInfo {
  faction: FactionMembership;
  characters: GameCharacter[];
  totalCount: number;
  standingCounts: Record<string, number>;
  retired?: boolean;
}

const buildFactionFilterFields = (
  characterFactionStanding: RelationshipTypeCollection | undefined
): FilterFieldConfig[] => [
  {
    key: 'standing',
    type: 'select',
    label: 'Standing',
    options: (characterFactionStanding?.entries ?? []).map(entry => ({
      value: entry.id,
      label: relationshipLabel(entry),
    })),
    matches: (item, value) =>
      ((item as FactionInfo).standingCounts[value] ?? 0) > 0,
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
      const isRetired = (item as FactionInfo).retired === true;
      return value === 'retired' ? isRetired : !isRetired;
    },
  },
];

export const FactionListScreen: React.FC = () => {
  const [factionInfos, setFactionInfos] = useState<FactionInfo[]>([]);
  const navigation = useNavigation<FactionNavigationProp>();
  const label = useLabels();
  const { ruleset } = useRuleset();
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();

  const characterFactionStanding = useMemo(
    () => findRelationshipCollectionForPair(ruleset, ['character', 'faction']),
    [ruleset]
  );
  const factionFilterFields = useMemo(
    () => buildFactionFilterFields(characterFactionStanding),
    [characterFactionStanding]
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRight: {
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        },
        factionCard: commonStyles.card.base,
        factionContent: {
          flex: 1,
        },
        factionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        },
        factionName: {
          ...commonStyles.text.h3,
          flex: 1,
        },
        factionCounts: {
          alignItems: 'flex-end',
        },
        countText: {
          ...commonStyles.text.body,
          fontWeight: '500',
        },
        standingsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        standingBadge: {
          ...commonStyles.badge.base,
          minWidth: 60,
        },
        standingText: commonStyles.badge.text,
      }),
    [commonStyles, themeColors]
  );

  const loadData = useCallback(async () => {
    // Run migration on first load (idempotent operation)
    await migrateFactionDescriptions();

    const data = await loadCharacters();

    // Process factions
    const factionMap = new Map<
      string,
      {
        faction: FactionMembership;
        characters: GameCharacter[];
        standings: Record<string, number>;
      }
    >();

    const defaultRelationshipTypeId =
      characterFactionStanding?.defaultEntryId ??
      characterFactionStanding?.entries[0]?.id ??
      '';

    // First, load centralized factions to ensure all created factions appear
    const storedFactions = await loadFactions();
    const factionRetiredMap = new Map<string, boolean>();
    storedFactions.forEach(storedFaction => {
      factionRetiredMap.set(storedFaction.name, storedFaction.retired ?? false);
      if (!factionMap.has(storedFaction.name)) {
        factionMap.set(storedFaction.name, {
          faction: {
            name: storedFaction.name,
            relationshipTypeId: defaultRelationshipTypeId,
            description: storedFaction.description,
          },
          characters: [],
          standings: {},
        });
      }
    });

    // Collect all factions from all characters
    data.forEach(character => {
      character.factions.forEach(faction => {
        if (!factionMap.has(faction.name)) {
          factionMap.set(faction.name, {
            faction,
            characters: [],
            standings: {},
          });
        }

        const factionData = factionMap.get(faction.name)!;

        // Only count positive relationship standings as actual members
        if (
          isPositiveRelationship(
            findRelationshipEntry(
              characterFactionStanding,
              faction.relationshipTypeId
            )
          )
        ) {
          factionData.characters.push(character);
        }

        // Count all standings for display purposes
        factionData.standings[faction.relationshipTypeId] =
          (factionData.standings[faction.relationshipTypeId] || 0) + 1;
      });
    });

    // Convert to FactionInfo array and get centralized descriptions
    const factionInfosArray = await Promise.all(
      Array.from(factionMap.entries()).map(async ([name, data]) => {
        // Get the centralized faction description
        const centralDescription = await getFactionDescription(name);

        return {
          faction: {
            ...data.faction,
            description: centralDescription, // Use centralized description
          },
          characters: data.characters,
          totalCount: data.characters.length,
          standingCounts: data.standings,
          retired: factionRetiredMap.get(name) ?? false,
        };
      })
    );

    // Sort alphabetically by faction name
    factionInfosArray.sort((a, b) =>
      a.faction.name.localeCompare(b.faction.name)
    );

    setFactionInfos(factionInfosArray);
  }, [characterFactionStanding]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const {
    searchQuery,
    setSearchQuery,
    filterValues,
    setFilterValues,
    activeFilterCount,
    results,
  } = useEntitySearch(factionInfos, {
    searchableText: item => [item.faction.name, item.faction.description ?? ''],
    filterFields: factionFilterFields,
    initialFilterValues: { retiredStatus: 'active' },
  });

  const handleSearchPress = useCallback(() => {
    navigation.navigate('AdvancedSearch', {
      title: `Search ${label('faction.plural')}`,
      fields: factionFilterFields,
      initialValues: filterValues,
      onApply: setFilterValues,
    });
  }, [navigation, label, filterValues, setFilterValues, factionFilterFields]);

  const handleFactionSelect = (factionInfo: FactionInfo) => {
    navigation.navigate('FactionDetails', {
      factionName: factionInfo.faction.name,
    });
  };

  const renderFactionItem = (item: FactionInfo) => (
    <View style={styles.factionCard}>
      <TouchableOpacity
        style={styles.factionContent}
        onPress={() => handleFactionSelect(item)}
      >
        <View style={styles.factionHeader}>
          <Text style={styles.factionName}>{item.faction.name}</Text>
          <View style={styles.factionCounts}>
            <Text style={styles.countText}>
              {item.totalCount} member{item.totalCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.standingsContainer}>
          {Object.entries(item.standingCounts).map(
            ([relationshipTypeId, count]) => {
              const entry = findRelationshipEntry(
                characterFactionStanding,
                relationshipTypeId
              );
              return (
                <View
                  key={relationshipTypeId}
                  style={[
                    styles.standingBadge,
                    {
                      backgroundColor: resolveRelationshipColor(
                        entry,
                        themeColors
                      ),
                    },
                  ]}
                >
                  <Text style={styles.standingText}>
                    {entry ? relationshipLabel(entry) : relationshipTypeId}:{' '}
                    {count}
                  </Text>
                </View>
              );
            }
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderHeaderRight = () => (
    <View style={styles.headerRight}>
      <HeaderAddButton onPress={() => navigation.navigate('FactionForm', {})} />
    </View>
  );

  return (
    <BaseListScreen
      data={results}
      renderItem={renderFactionItem}
      keyExtractor={(item: FactionInfo) => item.faction.name}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={`Search ${label('faction.plural', 'lower')} by name...`}
      onAdvancedSearchPress={handleSearchPress}
      advancedFilterCount={activeFilterCount}
      emptyStateTitle={`No ${label('faction.plural', 'lower')} found`}
      headerRight={renderHeaderRight()}
      ListHeaderComponent={
        <ActiveFiltersBar
          fields={factionFilterFields}
          values={filterValues}
          onRemove={key =>
            setFilterValues({ ...filterValues, [key]: undefined })
          }
        />
      }
    />
  );
};
