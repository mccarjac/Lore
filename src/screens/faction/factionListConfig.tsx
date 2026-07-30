import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import {
  GameCharacter,
  Faction,
  RelationshipStanding,
  POSITIVE_RELATIONSHIP_TYPE,
} from '@models/types';
import {
  loadCharacters,
  getFactionDescription,
  migrateFactionDescriptions,
  loadFactions,
} from '@utils/characterStorage';
import {
  CompositeNavigationProp,
  useNavigation,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RootStackParamList, RootDrawerParamList } from '@/navigation/types';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import type { FilterFieldConfig } from '@/components/search/filterFieldTypes';
import type { ListScreenConfig } from '@/components/screens/listScreenConfig';
import { useLabels } from '@/ruleset';

type FactionNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'Factions'>,
  StackNavigationProp<RootStackParamList>
>;

interface FactionInfo {
  faction: Faction;
  characters: GameCharacter[];
  totalCount: number;
  presentCount: number;
  standingCounts: Record<string, number>;
  retired?: boolean;
}

const factionFilterFields: FilterFieldConfig[] = [
  {
    key: 'standing',
    type: 'select',
    label: 'Standing',
    options: Object.values(RelationshipStanding).map(standing => ({
      value: standing,
      label: standing,
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

async function loadFactionInfos(): Promise<FactionInfo[]> {
  await migrateFactionDescriptions();

  const data = await loadCharacters();

  const factionMap = new Map<
    string,
    {
      faction: Faction;
      characters: GameCharacter[];
      standings: Record<string, number>;
    }
  >();

  const storedFactions = await loadFactions();
  const factionRetiredMap = new Map<string, boolean>();
  storedFactions.forEach(storedFaction => {
    factionRetiredMap.set(storedFaction.name, storedFaction.retired ?? false);
    if (!factionMap.has(storedFaction.name)) {
      factionMap.set(storedFaction.name, {
        faction: {
          name: storedFaction.name,
          standing: RelationshipStanding.Neutral,
          description: storedFaction.description,
        },
        characters: [],
        standings: {},
      });
    }
  });

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

      const standingValue = faction.standing as string;
      if (
        POSITIVE_RELATIONSHIP_TYPE.includes(faction.standing) ||
        standingValue === 'Allied' ||
        standingValue === 'Friendly'
      ) {
        factionData.characters.push(character);
      }

      factionData.standings[faction.standing] =
        (factionData.standings[faction.standing] || 0) + 1;
    });
  });

  const factionInfosArray = await Promise.all(
    Array.from(factionMap.entries()).map(async ([name, data]) => {
      const centralDescription = await getFactionDescription(name);

      return {
        faction: {
          ...data.faction,
          description: centralDescription,
        },
        characters: data.characters,
        totalCount: data.characters.length,
        presentCount: data.characters.filter(c => c.present === true).length,
        standingCounts: data.standings,
        retired: factionRetiredMap.get(name) ?? false,
      };
    })
  );

  factionInfosArray.sort((a, b) =>
    a.faction.name.localeCompare(b.faction.name)
  );

  return factionInfosArray;
}

const getStandingStyle = (
  standing: string,
  styles: ReturnType<typeof useCommonStyles>['badge']
) => {
  switch (standing) {
    case RelationshipStanding.Ally:
      return styles.allied;
    case RelationshipStanding.Friend:
      return styles.friendly;
    case RelationshipStanding.Neutral:
      return styles.neutral;
    case RelationshipStanding.Hostile:
      return styles.hostile;
    case RelationshipStanding.Enemy:
      return styles.enemy;
    case 'Allied':
      return styles.allied;
    case 'Friendly':
      return styles.friendly;
    default:
      return styles.neutral;
  }
};

export function useFactionListConfig(): ListScreenConfig<FactionInfo> {
  const navigation = useNavigation<FactionNavigationProp>();
  const label = useLabels();
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        presentText: commonStyles.text.caption,
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
    const items = await loadFactionInfos();
    return { items, context: undefined };
  }, []);

  const renderItem = useCallback(
    (item: FactionInfo) => (
      <View style={styles.factionCard}>
        <TouchableOpacity
          style={styles.factionContent}
          onPress={() =>
            navigation.navigate('FactionDetails', {
              factionName: item.faction.name,
            })
          }
        >
          <View style={styles.factionHeader}>
            <Text style={styles.factionName}>{item.faction.name}</Text>
            <View style={styles.factionCounts}>
              <Text style={styles.countText}>
                {item.totalCount} member{item.totalCount !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.presentText}>
                {item.presentCount} present
              </Text>
            </View>
          </View>

          <View style={styles.standingsContainer}>
            {Object.entries(item.standingCounts).map(([standing, count]) => (
              <View
                key={standing}
                style={[
                  styles.standingBadge,
                  getStandingStyle(standing, commonStyles.badge),
                ]}
              >
                <Text style={styles.standingText}>
                  {standing}: {count}
                </Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </View>
    ),
    [navigation, styles, commonStyles.badge]
  );

  return {
    loadData,
    keyExtractor: (item: FactionInfo) => item.faction.name,
    renderItem,
    searchableText: item => [item.faction.name, item.faction.description ?? ''],
    useFilterFields: () => factionFilterFields,
    initialFilterValues: { retiredStatus: 'active' },
    advancedSearchTitle: `Search ${label('faction.plural')}`,
    searchPlaceholder: `Search ${label('faction.plural', 'lower')} by name...`,
    emptyStateTitle: `No ${label('faction.plural', 'lower')} found`,
    onAddPress: () => navigation.navigate('FactionForm', {}),
    menuSections: [
      {
        title: 'Statistics',
        items: [
          {
            label: `${label('faction.singular')} Statistics`,
            onPress: () => navigation.navigate('FactionStats'),
          },
        ],
      },
    ],
  };
}
