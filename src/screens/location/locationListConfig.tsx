import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GameCharacter, GameLocation } from '@models/types';
import { loadCharacters, loadLocations } from '@utils/characterStorage';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RootStackParamList, RootDrawerParamList } from '@/navigation/types';
import { useCommonStyles } from '@/styles/commonStyles';
import type { FilterFieldConfig } from '@/components/search/filterFieldTypes';
import type { ListScreenConfig } from '@/components/screens/listScreenConfig';
import { useFeature } from '@/ruleset';

type LocationNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'Locations'>,
  StackNavigationProp<RootStackParamList>
>;

interface LocationInfo {
  location: GameLocation;
  characters: GameCharacter[];
  totalCount: number;
  presentCount: number;
}

const locationFilterFields: FilterFieldConfig[] = [
  {
    key: 'occupancy',
    type: 'select',
    label: 'Occupancy',
    options: [
      { value: 'occupied', label: 'Has present characters' },
      { value: 'empty', label: 'No present characters' },
    ],
    matches: (item, value) => {
      const info = item as LocationInfo;
      return value === 'occupied'
        ? info.presentCount > 0
        : info.presentCount === 0;
    },
  },
];

async function loadLocationInfos(): Promise<LocationInfo[]> {
  const characters = await loadCharacters();
  const locations = await loadLocations();

  const locationMap = new Map<string, LocationInfo>();

  locations.forEach(location => {
    locationMap.set(location.id, {
      location,
      characters: [],
      totalCount: 0,
      presentCount: 0,
    });
  });

  characters.forEach(character => {
    if (character.locationId) {
      const locationInfo = locationMap.get(character.locationId);
      if (locationInfo) {
        locationInfo.characters.push(character);
        locationInfo.totalCount++;
        if (character.present) {
          locationInfo.presentCount++;
        }
      }
    }
  });

  return Array.from(locationMap.values()).sort((a, b) =>
    a.location.name.localeCompare(b.location.name)
  );
}

export function useLocationListConfig(
  navigation: LocationNavigationProp
): ListScreenConfig<LocationInfo> {
  const mapEnabled = useFeature('map');
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        locationCard: commonStyles.card.base,
        locationContent: {
          flex: 1,
          flexDirection: 'row',
          gap: 12,
        },
        locationTextContent: {
          flex: 1,
        },
        locationHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        },
        locationName: {
          ...commonStyles.text.h3,
          flex: 1,
        },
        locationCounts: {
          alignItems: 'flex-end',
        },
        countText: {
          ...commonStyles.text.body,
          fontWeight: '500',
        },
        presentText: commonStyles.text.caption,
        locationDescription: {
          ...commonStyles.text.body,
          lineHeight: 20,
        },
      }),
    [commonStyles]
  );

  const loadData = useCallback(async () => {
    const items = await loadLocationInfos();
    return { items, context: undefined };
  }, []);

  const renderItem = useCallback(
    (item: LocationInfo) => (
      <View style={styles.locationCard}>
        <TouchableOpacity
          style={styles.locationContent}
          onPress={() =>
            navigation.navigate('LocationDetails', {
              locationId: item.location.id,
            })
          }
        >
          <View style={styles.locationTextContent}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationName}>{item.location.name}</Text>
              <View style={styles.locationCounts}>
                <Text style={styles.countText}>
                  {item.totalCount} character{item.totalCount !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.presentText}>
                  {item.presentCount} present
                </Text>
              </View>
            </View>

            {item.location.description && (
              <Text style={styles.locationDescription} numberOfLines={2}>
                {item.location.description}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    ),
    [navigation, styles]
  );

  return {
    loadData,
    keyExtractor: item => item.location.id,
    renderItem,
    searchableText: item => [
      item.location.name,
      item.location.description ?? '',
    ],
    useFilterFields: () => locationFilterFields,
    advancedSearchTitle: 'Search Locations',
    searchPlaceholder: 'Search locations by name...',
    emptyStateTitle: 'No locations found',
    emptyStateSubtitle: 'Create a location to get started',
    onAddPress: () => navigation.navigate('LocationForm', {}),
    extraHeaderButtons: [
      {
        key: 'map',
        label: '🗺️',
        onPress: () => navigation.navigate('LocationMap'),
        visible: mapEnabled,
      },
    ],
  };
}
