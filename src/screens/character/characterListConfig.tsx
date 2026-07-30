import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GameCharacter } from '@models/types';
import {
  loadCharacters,
  toggleCharacterPresent,
  resetAllPresentStatus,
  migrateImageUris,
  migrateRulesetFields,
} from '@utils/characterStorage';
import {
  CompositeNavigationProp,
  useNavigation,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RootStackParamList, RootDrawerParamList } from '@/navigation/types';
import { useCommonStyles } from '@/styles/commonStyles';
import type {
  ListScreenConfig,
  ListItemHelpers,
} from '@/components/screens/listScreenConfig';
import { useLabels } from '@/ruleset';
import { useCharacterFilterFields } from './characterFilterFields';

type NavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'CharacterList'>,
  StackNavigationProp<RootStackParamList>
>;

export function useCharacterListConfig(): ListScreenConfig<GameCharacter> {
  const navigation = useNavigation<NavigationProp>();
  const label = useLabels();
  const commonStyles = useCommonStyles();
  const filterFields = useCharacterFilterFields();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: commonStyles.card.base,
        cardPresent: commonStyles.card.present,
        cardHeader: commonStyles.card.header,
        name: {
          ...commonStyles.text.h3,
          flex: 1,
        },
        factions: {
          ...commonStyles.text.caption,
          marginTop: 8,
          fontStyle: 'italic',
        },
        presentButton: {
          ...commonStyles.badge.base,
          ...commonStyles.badge.absent,
          minWidth: 70,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
        },
        presentButtonActive: commonStyles.badge.present,
        presentText: commonStyles.badge.textMuted,
        presentTextActive: commonStyles.badge.text,
      }),
    [commonStyles]
  );

  const loadData = useCallback(async () => {
    await migrateImageUris();
    await migrateRulesetFields();

    const items = await loadCharacters();
    return { items, context: undefined };
  }, []);

  const renderItem = useCallback(
    (item: GameCharacter, helpers: ListItemHelpers) => {
      const handleTogglePresent = async () => {
        await toggleCharacterPresent(item.id);
        await helpers.reload();
      };

      return (
        <TouchableOpacity
          style={[styles.card, item.present && styles.cardPresent]}
          onPress={() =>
            navigation.navigate('CharacterDetail', { character: item })
          }
        >
          <View style={styles.cardHeader}>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {item.name}
            </Text>
            <TouchableOpacity
              style={[
                styles.presentButton,
                item.present && styles.presentButtonActive,
              ]}
              onPress={handleTogglePresent}
            >
              <Text
                style={[
                  styles.presentText,
                  item.present && styles.presentTextActive,
                ]}
              >
                {item.present ? 'Present' : 'Absent'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.factions}>
            {(item.factions || []).map(f => f.name).join(', ') || 'No factions'}
          </Text>
        </TouchableOpacity>
      );
    },
    [navigation, styles]
  );

  return {
    loadData,
    keyExtractor: item => item.id,
    renderItem,
    searchableText: item => [item.name],
    useFilterFields: () => filterFields,
    initialFilterValues: { retiredStatus: 'active' },
    advancedSearchTitle: `Search ${label('character.plural')}`,
    searchPlaceholder: `Search ${label('character.plural', 'lower')} by name...`,
    emptyStateTitle: `No ${label('character.plural', 'lower')} found`,
    emptyStateSubtitle: `Create a ${label('character.singular', 'lower')} to get started`,
    contentContainerStyle: { paddingBottom: 100 },
    onAddPress: () => navigation.navigate('CharacterForm', {}),
    quickFilters: [
      {
        key: 'present',
        label: active => (active ? 'Show All' : 'Present Only'),
        predicate: item => item.present === true,
        defaultActive: false,
      },
    ],
    sortResults: items =>
      [...items].sort((a, b) => a.name.localeCompare(b.name)),
    bulkActions: [
      {
        key: 'resetPresent',
        label: 'Reset Present',
        confirmTitle: 'Reset Present Status',
        confirmMessage: `Are you sure you want to reset present status for all ${label('character.plural', 'lower')}?`,
        confirmLabel: 'Reset All',
        run: () => resetAllPresentStatus(),
      },
    ],
    menuSections: [
      {
        title: 'Statistics',
        items: [
          {
            label: `${label('character.singular')} Statistics`,
            onPress: () => navigation.navigate('CharacterStats'),
          },
        ],
      },
    ],
  };
}
