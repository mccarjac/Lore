import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useFocusEffect } from '@react-navigation/native';
import { loadCharacters } from '../utils/characterStorage';
import {
  calculateCharacterStats,
  CharacterStats,
} from '../utils/characterStats';
import { GameCharacter } from '@/models/types';
import { colors as themeColors } from '@/styles/theme';
import { commonStyles } from '@/styles/commonStyles';
import { useLabels, useRuleset } from '@/ruleset';
import { colorsForKeys } from '@/styles/chartPalette';

/** How many entries a "Most Common" list shows, per collection. */
const TOP_ENTRIES_LIMIT = 5;

export const CharacterStatsScreen = () => {
  const label = useLabels();
  const { ruleset } = useRuleset();
  const [stats, setStats] = useState<CharacterStats | null>(null);
  const [selectedSlices, setSelectedSlices] = useState<
    Record<string, string | null>
  >({});
  const [showOnlyPresent, setShowOnlyPresent] = useState<boolean>(false);
  const [includeRetired, setIncludeRetired] = useState<boolean>(false);
  const [allCharacters, setAllCharacters] = useState<GameCharacter[]>([]);

  const calculateStats = useCallback(
    (characters: GameCharacter[]): CharacterStats => {
      return calculateCharacterStats(characters, ruleset);
    },
    [ruleset]
  );

  // Calculate stats whenever characters or filter changes
  React.useEffect(() => {
    if (allCharacters.length > 0) {
      // Filter out retired characters and optionally filter to only present
      const filteredCharacters = allCharacters.filter(
        c =>
          (includeRetired || !c.retired) &&
          (!showOnlyPresent || c.present === true)
      );

      const newStats =
        filteredCharacters.length === 0
          ? null
          : calculateStats(filteredCharacters);
      setStats(newStats);
    }
  }, [showOnlyPresent, includeRetired, allCharacters, calculateStats]);

  const loadStats = useCallback(async () => {
    const characters = await loadCharacters();
    setAllCharacters(characters);

    if (!characters.length) {
      setStats(null);
      return;
    }

    // Filter out retired characters and optionally filter to only present
    const filteredCharacters = characters.filter(
      c =>
        (includeRetired || !c.retired) &&
        (!showOnlyPresent || c.present === true)
    );

    if (filteredCharacters.length === 0) {
      setStats(null);
    } else {
      const stats = calculateStats(filteredCharacters);
      setStats(stats);
    }
  }, [showOnlyPresent, includeRetired, calculateStats]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const handleSlicePress = (collectionId: string, entryId: string) => {
    const isSame = selectedSlices[collectionId] === entryId;
    setSelectedSlices(prev => ({
      ...prev,
      [collectionId]: isSame ? null : entryId,
    }));

    // Show a temporary alert or tooltip-like behavior
    if (!isSame) {
      setTimeout(() => {
        setSelectedSlices(prev => ({ ...prev, [collectionId]: null }));
      }, 3000); // Auto-hide after 3 seconds
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.header}>
          {label('character.singular')} Statistics
        </Text>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              showOnlyPresent && styles.filterButtonActive,
            ]}
            onPress={() => setShowOnlyPresent(!showOnlyPresent)}
          >
            <Text
              style={[
                styles.filterButtonText,
                showOnlyPresent && styles.filterButtonTextActive,
              ]}
            >
              {showOnlyPresent ? 'Present Only ✓' : 'Show Present Only'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              includeRetired && styles.filterButtonActive,
            ]}
            onPress={() => setIncludeRetired(!includeRetired)}
          >
            <Text
              style={[
                styles.filterButtonText,
                includeRetired && styles.filterButtonTextActive,
              ]}
            >
              {includeRetired ? 'Include Retired ✓' : 'Include Retired'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.filterInfo}>
            {showOnlyPresent
              ? `Showing ${stats?.totalCharacters || 0} present characters`
              : `Showing all ${stats?.totalCharacters || 0} characters`}
          </Text>
        </View>

        {!stats ? (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>
              {showOnlyPresent
                ? 'No present characters found. Try toggling the filter to see all characters.'
                : 'No character data available'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>General Stats</Text>
              <Text style={styles.listItemText}>
                Total Characters: {stats.totalCharacters}
              </Text>
            </View>

            {/*
              One section per facet collection — a pie chart for a
              `single`-selection collection (the old hardcoded archetype
              chart) and a "Most Common" list for a `multi` one (the old
              hardcoded commonPerks/commonDistinctions blocks). A ruleset
              with more or fewer collections renders more or fewer sections;
              nothing here names a specific collection.
            */}
            {stats.facetCollections.map(collectionStats => {
              const selectedSlice =
                selectedSlices[collectionStats.collectionId] ?? null;

              if (collectionStats.selection === 'single') {
                const colorMap = colorsForKeys(
                  collectionStats.entries.map(entry => entry.id)
                );
                const pieData = collectionStats.entries.map(entry => ({
                  value: entry.count,
                  color: colorMap[entry.id],
                  text: `${entry.count}`,
                  label: entry.label,
                  onPress: () =>
                    handleSlicePress(collectionStats.collectionId, entry.id),
                }));
                const selectedEntry = collectionStats.entries.find(
                  entry => entry.id === selectedSlice
                );

                return (
                  <View
                    key={collectionStats.collectionId}
                    style={styles.section}
                  >
                    <Text style={styles.sectionHeader}>
                      {collectionStats.plural} Distribution
                    </Text>
                    {pieData.length > 0 && (
                      <View style={styles.chartContainer}>
                        <PieChart
                          data={pieData}
                          donut
                          showText
                          textColor="white"
                          textSize={14}
                          fontWeight="bold"
                          radius={100}
                          innerRadius={40}
                          innerCircleColor={themeColors.surface}
                          strokeColor={themeColors.border}
                          strokeWidth={2}
                          sectionAutoFocus
                          focusOnPress
                          toggleFocusOnPress
                          centerLabelComponent={() => {
                            if (selectedEntry) {
                              const percentage = (
                                (selectedEntry.count / stats.totalCharacters) *
                                100
                              ).toFixed(1);
                              return (
                                <View style={styles.centerLabel}>
                                  <Text style={styles.centerLabelArchetype}>
                                    {selectedEntry.label}
                                  </Text>
                                  <Text style={styles.centerLabelNumber}>
                                    {selectedEntry.count}
                                  </Text>
                                  <Text style={styles.centerLabelText}>
                                    {percentage}%
                                  </Text>
                                </View>
                              );
                            }
                            return (
                              <View style={styles.centerLabel}>
                                <Text style={styles.centerLabelNumber}>
                                  {stats.totalCharacters}
                                </Text>
                                <Text style={styles.centerLabelText}>
                                  Characters
                                </Text>
                              </View>
                            );
                          }}
                        />
                        {selectedEntry && (
                          <View style={styles.tooltip}>
                            <Text style={styles.tooltipText}>
                              Tap slice again or wait to return to overview
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    <View style={styles.archetypeLegend}>
                      {collectionStats.entries.map(entry => {
                        const percentage = (
                          (entry.count / stats.totalCharacters) *
                          100
                        ).toFixed(1);
                        const isSelected = selectedSlice === entry.id;
                        return (
                          <View
                            key={entry.id}
                            style={[
                              styles.legendItem,
                              isSelected && styles.legendItemSelected,
                            ]}
                          >
                            <View
                              style={[
                                styles.legendColorBox,
                                { backgroundColor: colorMap[entry.id] },
                                isSelected && styles.legendColorBoxSelected,
                              ]}
                            />
                            <Text
                              style={[
                                styles.legendText,
                                isSelected && styles.legendTextSelected,
                              ]}
                            >
                              {entry.label}: {entry.count} ({percentage}%)
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              }

              return (
                <View key={collectionStats.collectionId} style={styles.section}>
                  <Text style={styles.sectionHeader}>
                    Most Common {collectionStats.plural}
                  </Text>
                  {collectionStats.entries
                    .slice(0, TOP_ENTRIES_LIMIT)
                    .map(entry => (
                      <Text key={entry.id} style={styles.listItemText}>
                        {entry.label}: {entry.count} characters
                      </Text>
                    ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.primary,
  },
  scrollView: {
    backgroundColor: themeColors.primary,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    ...commonStyles.text.h1,
    marginBottom: 24,
  },
  filterContainer: {
    marginBottom: 24,
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  filterButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: themeColors.elevated,
    borderWidth: 1,
    borderColor: themeColors.border,
    marginBottom: 8,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonActive: {
    backgroundColor: themeColors.accent.success,
    borderColor: themeColors.accent.success,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: themeColors.text.muted,
    letterSpacing: 0.3,
  },
  filterButtonTextActive: {
    color: themeColors.text.primary,
  },
  filterInfo: {
    fontSize: 12,
    color: themeColors.text.secondary,
    fontStyle: 'italic',
  },
  section: {
    ...commonStyles.card.elevated,
    marginBottom: 32,
  },
  sectionHeader: {
    ...commonStyles.text.h2,
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  centerLabel: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabelNumber: {
    fontSize: 24,
    color: themeColors.text.primary,
    fontWeight: '700',
  },
  centerLabelText: {
    fontSize: 12,
    color: themeColors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  centerLabelArchetype: {
    fontSize: 16,
    color: themeColors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  tooltip: {
    position: 'absolute',
    bottom: -30,
    backgroundColor: themeColors.elevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: themeColors.border,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipText: {
    color: themeColors.text.primary,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  archetypeLegend: {
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: themeColors.elevated,
  },
  legendColorBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  legendText: {
    fontSize: 15,
    color: themeColors.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  legendItemSelected: {
    backgroundColor: themeColors.accent.secondary,
    borderWidth: 1,
    borderColor: themeColors.accent.primary,
  },
  legendColorBoxSelected: {
    borderWidth: 2,
    borderColor: themeColors.accent.primary,
    transform: [{ scale: 1.1 }],
  },
  legendTextSelected: {
    fontWeight: '600',
    color: themeColors.text.primary,
  },
  listItemText: {
    fontSize: 15,
    color: themeColors.text.primary,
    marginVertical: 4,
    fontWeight: '500',
  },
  noDataContainer: {
    backgroundColor: themeColors.surface,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themeColors.border,
    alignItems: 'center',
    marginVertical: 20,
  },
  noDataText: {
    fontSize: 16,
    color: themeColors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
