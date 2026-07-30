import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image } from 'react-native';
import { GameEvent } from '@models/types';
import {
  loadEvents,
  loadCharacters,
  loadLocations,
  loadFactions,
  reconcileQuestEventLinks,
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
import {
  BaseListScreen,
  HeaderAddButton,
  HeaderSearchButton,
  ActiveFiltersBar,
  useEntitySearch,
  type FilterFieldConfig,
} from '@/components';
import { formatEventDateShort, parseDateString } from '@utils/dateUtils';

type EventsNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'Events'>,
  StackNavigationProp<RootStackParamList>
>;

interface EventWithDetails extends GameEvent {
  locationName?: string;
  characterNames: string[];
}

export const EventsTimelineScreen: React.FC = () => {
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>(
    []
  );
  const [locations, setLocations] = useState<{ id: string; name: string }[]>(
    []
  );
  const [factions, setFactions] = useState<string[]>([]);
  const navigation = useNavigation<EventsNavigationProp>();
  const { colors: themeColors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRight: {
          flexDirection: 'row',
          gap: 8,
        },
        eventCard: {
          backgroundColor: themeColors.surface,
          borderWidth: 1,
          borderColor: themeColors.border,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        },
        eventHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        },
        eventTitleContainer: {
          flex: 1,
          marginRight: 12,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
        },
        eventTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: themeColors.text.primary,
          flex: 1,
        },
        eventDate: {
          fontSize: 14,
          color: themeColors.text.secondary,
        },
        eventThumbnail: {
          width: 60,
          height: 60,
          borderRadius: 8,
          backgroundColor: themeColors.elevated,
        },
        eventDescription: {
          fontSize: 14,
          color: themeColors.text.secondary,
          marginBottom: 12,
          lineHeight: 20,
        },
        eventMeta: {
          gap: 8,
        },
        metaItem: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        metaLabel: {
          fontSize: 12,
          color: themeColors.text.muted,
          fontWeight: '600',
          marginRight: 6,
          minWidth: 70,
        },
        metaValue: {
          fontSize: 12,
          color: themeColors.text.secondary,
          flex: 1,
        },
        certaintyBadge: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 8,
          alignSelf: 'flex-start',
        },
        certaintyBadgeText: {
          fontSize: 10,
          fontWeight: '600',
          color: themeColors.text.primary,
        },
        certaintyConfirmed: {
          backgroundColor: themeColors.certainty.confirmed,
        },
        certaintyUnconfirmed: {
          backgroundColor: themeColors.certainty.unconfirmed,
        },
        certaintyDisputed: {
          backgroundColor: themeColors.certainty.disputed,
        },
      }),
    [themeColors]
  );

  const loadData = useCallback(async () => {
    // Backfill/prune quest<->event back-references (idempotent operation)
    await reconcileQuestEventLinks();

    const eventsData = await loadEvents();
    const charactersData = await loadCharacters();
    const locationsData = await loadLocations();
    const factionsData = await loadFactions();

    // Create lookup maps
    const locationMap = new Map(locationsData.map(l => [l.id, l.name]));
    const characterMap = new Map(charactersData.map(c => [c.id, c.name]));

    // Enhance events with location and character names
    const eventsWithDetails: EventWithDetails[] = eventsData.map(event => ({
      ...event,
      locationName: event.locationId
        ? locationMap.get(event.locationId)
        : undefined,
      characterNames:
        event.characterIds?.map(id => characterMap.get(id) || 'Unknown') || [],
    }));

    // Sort by date descending (newest first)
    eventsWithDetails.sort(
      (a, b) =>
        parseDateString(b.date).getTime() - parseDateString(a.date).getTime()
    );

    setEvents(eventsWithDetails);

    // Set filter options
    setCharacters(
      charactersData
        .map(c => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLocations(
      locationsData
        .map(l => ({ id: l.id, name: l.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setFactions(
      factionsData.map(f => f.name).sort((a, b) => a.localeCompare(b))
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filterFields = useMemo<FilterFieldConfig[]>(
    () => [
      {
        key: 'certainty',
        type: 'select',
        label: 'Certainty',
        options: [
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'unconfirmed', label: 'Unconfirmed' },
          { value: 'disputed', label: 'Disputed' },
        ],
        matches: (item, value) =>
          ((item as EventWithDetails).certaintyLevel || 'confirmed') === value,
      },
      {
        key: 'location',
        type: 'select',
        label: 'Location',
        options: locations.map(location => ({
          value: location.id,
          label: location.name,
        })),
        matches: (item, value) =>
          (item as EventWithDetails).locationId === value,
      },
      {
        key: 'character',
        type: 'select',
        label: 'Character',
        options: characters.map(character => ({
          value: character.id,
          label: character.name,
        })),
        matches: (item, value) =>
          (item as EventWithDetails).characterIds?.includes(value) ?? false,
      },
      {
        key: 'faction',
        type: 'select',
        label: 'Faction',
        options: factions.map(faction => ({
          value: faction,
          label: faction,
        })),
        matches: (item, value) =>
          (item as EventWithDetails).factionNames?.includes(value) ?? false,
      },
    ],
    [locations, characters, factions]
  );

  const {
    searchQuery,
    setSearchQuery,
    filterValues,
    setFilterValues,
    activeFilterCount,
    results: filteredEvents,
  } = useEntitySearch(events, {
    searchableText: item => [
      item.title,
      item.description ?? '',
      item.notes ?? '',
    ],
    filterFields,
  });

  const renderEvent = (item: EventWithDetails) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => navigation.navigate('EventsDetail', { eventId: item.id })}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <View
              style={[
                styles.certaintyBadge,
                item.certaintyLevel === 'unconfirmed' &&
                  styles.certaintyUnconfirmed,
                item.certaintyLevel === 'disputed' && styles.certaintyDisputed,
                (!item.certaintyLevel || item.certaintyLevel === 'confirmed') &&
                  styles.certaintyConfirmed,
              ]}
            >
              <Text style={styles.certaintyBadgeText}>
                {item.certaintyLevel
                  ? item.certaintyLevel.charAt(0).toUpperCase() +
                    item.certaintyLevel.slice(1)
                  : 'Confirmed'}
              </Text>
            </View>
          </View>
          <Text style={styles.eventDate}>
            {formatEventDateShort(item.date, item.time)}
          </Text>
        </View>
        {item.imageUris && item.imageUris.length > 0 && (
          <Image
            source={{ uri: item.imageUris[0] }}
            style={styles.eventThumbnail}
          />
        )}
      </View>

      {item.description && (
        <Text style={styles.eventDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.eventMeta}>
        {item.locationName && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Location:</Text>
            <Text style={styles.metaValue}>{item.locationName}</Text>
          </View>
        )}

        {item.characterNames.length > 0 && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Characters:</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {item.characterNames.join(', ')}
            </Text>
          </View>
        )}

        {item.factionNames && item.factionNames.length > 0 && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Factions:</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {item.factionNames.join(', ')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const handleSearchPress = useCallback(() => {
    navigation.navigate('AdvancedSearch', {
      title: 'Search Events',
      fields: filterFields,
      initialValues: filterValues,
      onApply: setFilterValues,
    });
  }, [navigation, filterFields, filterValues, setFilterValues]);

  const renderHeaderRight = () => (
    <View style={styles.headerRight}>
      <HeaderSearchButton
        activeCount={activeFilterCount}
        onPress={handleSearchPress}
      />
      <HeaderAddButton onPress={() => navigation.navigate('EventsForm', {})} />
    </View>
  );

  return (
    <BaseListScreen
      data={filteredEvents}
      renderItem={renderEvent}
      keyExtractor={(item: EventWithDetails) => item.id}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search events..."
      emptyStateTitle="No events found"
      emptyStateSubtitle="Tap the add button to create your first event"
      headerRight={renderHeaderRight()}
      ListHeaderComponent={
        <ActiveFiltersBar
          fields={filterFields}
          values={filterValues}
          onRemove={key =>
            setFilterValues({ ...filterValues, [key]: undefined })
          }
        />
      }
    />
  );
};
