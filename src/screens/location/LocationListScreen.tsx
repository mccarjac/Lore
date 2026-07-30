import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GameCharacter, GameLocation } from '@models/types';
import { loadCharacters, loadLocations } from '@utils/characterStorage';
import {
  useNavigation,
  useFocusEffect,
  CompositeNavigationProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RootStackParamList, RootDrawerParamList } from '@/navigation/types';
import { useCommonStyles } from '@/styles/commonStyles';
import {
  BaseListScreen,
  HeaderAddButton,
  ActiveFiltersBar,
  useEntitySearch,
  type FilterFieldConfig,
} from '@/components';
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

export const LocationListScreen: React.FC = () => {
  const [locationInfos, setLocationInfos] = useState<LocationInfo[]>([]);
  const navigation = useNavigation<LocationNavigationProp>();
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
        headerButtons: {
          flexDirection: 'row',
          gap: 8,
        },
        headerMapButton: {
          ...commonStyles.headerButton.add,
          marginRight: 4,
        },
        headerMapButtonText: {
          ...commonStyles.headerButton.addText,
          fontSize: 20,
        },
      }),
    [commonStyles]
  );

  const loadData = useCallback(async () => {
    const characters = await loadCharacters();
    const locations = await loadLocations();

    // Create location info map
    const locationMap = new Map<string, LocationInfo>();

    // Initialize all locations
    locations.forEach(location => {
      locationMap.set(location.id, {
        location,
        characters: [],
        totalCount: 0,
        presentCount: 0,
      });
    });

    // Count characters at each location
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

    // Convert to array and sort alphabetically
    const locationInfosArray = Array.from(locationMap.values()).sort((a, b) =>
      a.location.name.localeCompare(b.location.name)
    );

    setLocationInfos(locationInfosArray);
  }, []);

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
    results: filteredLocations,
  } = useEntitySearch(locationInfos, {
    searchableText: item => [
      item.location.name,
      item.location.description ?? '',
    ],
    filterFields: locationFilterFields,
  });

  const handleSearchPress = useCallback(() => {
    navigation.navigate('AdvancedSearch', {
      title: 'Search Locations',
      fields: locationFilterFields,
      initialValues: filterValues,
      onApply: setFilterValues,
    });
  }, [navigation, filterValues, setFilterValues]);

  const handleLocationSelect = (locationInfo: LocationInfo) => {
    navigation.navigate('LocationDetails', {
      locationId: locationInfo.location.id,
    });
  };

  const handleCreateLocation = () => {
    navigation.navigate('LocationForm', {});
  };

  const handleViewMap = () => {
    navigation.navigate('LocationMap');
  };

  const renderLocationItem = (item: LocationInfo) => (
    <View style={styles.locationCard}>
      <TouchableOpacity
        style={styles.locationContent}
        onPress={() => handleLocationSelect(item)}
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
  );

  const renderHeaderRight = () => (
    <View style={styles.headerButtons}>
      {mapEnabled && (
        <TouchableOpacity
          style={styles.headerMapButton}
          onPress={handleViewMap}
        >
          <Text style={styles.headerMapButtonText}>🗺️</Text>
        </TouchableOpacity>
      )}
      <HeaderAddButton onPress={handleCreateLocation} />
    </View>
  );

  return (
    <BaseListScreen
      data={filteredLocations}
      renderItem={renderLocationItem}
      keyExtractor={(item: LocationInfo) => item.location.id}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search locations by name..."
      onAdvancedSearchPress={handleSearchPress}
      advancedFilterCount={activeFilterCount}
      emptyStateTitle="No locations found"
      emptyStateSubtitle="Create a location to get started"
      headerRight={renderHeaderRight()}
      ListHeaderComponent={
        <ActiveFiltersBar
          fields={locationFilterFields}
          values={filterValues}
          onRemove={key =>
            setFilterValues({ ...filterValues, [key]: undefined })
          }
        />
      }
    />
  );
};
