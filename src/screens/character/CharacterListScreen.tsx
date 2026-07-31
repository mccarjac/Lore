import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Text,
} from 'react-native';
import { GameCharacter } from '@models/types';
import {
  loadCharacters,
  toggleCharacterPresent,
  resetAllPresentStatus,
  migrateImageUris,
  migrateRulesetFields,
} from '@utils/characterStorage';
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
} from '@/components';
import { useLabels } from '@/ruleset';
import { useCharacterFilterFields } from './characterFilterFields';

type NavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'CharacterList'>,
  StackNavigationProp<RootStackParamList>
>;

export const CharacterListScreen: React.FC = () => {
  const [characters, setCharacters] = React.useState<GameCharacter[]>([]);
  const [showOnlyPresent, setShowOnlyPresent] = React.useState<boolean>(false);
  const navigation = useNavigation<NavigationProp>();
  const label = useLabels();
  const commonStyles = useCommonStyles();
  const filterFields = useCharacterFilterFields();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        listContentContainer: {
          paddingBottom: 100,
        },
        headerButtons: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 16,
        },
        actionButton: {
          ...commonStyles.button.base,
          flex: 1,
          marginHorizontal: 4,
        },
        filterButton: commonStyles.button.outline,
        filterButtonActive: commonStyles.button.outlineActive,
        resetButton: commonStyles.button.warning,
        buttonText: commonStyles.button.text,
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
        headerRight: {
          flexDirection: 'row',
          gap: 8,
        },
      }),
    [commonStyles]
  );

  const loadData = React.useCallback(async () => {
    // Run migrations on first load (both idempotent)
    await migrateImageUris();
    await migrateRulesetFields();

    const data = await loadCharacters();
    setCharacters(data);
  }, []);

  // Reload characters whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleTogglePresent = useCallback(
    async (id: string) => {
      await toggleCharacterPresent(id);
      await loadData();
    },
    [loadData]
  );

  const handleResetAllPresent = useCallback(async () => {
    const confirmReset = () => {
      const confirmMessage = `Are you sure you want to reset present status for all ${label('character.plural', 'lower')}?`;
      if (Platform.OS === 'web') {
        return window.confirm(confirmMessage);
      } else {
        return new Promise<boolean>(resolve => {
          Alert.alert('Reset Present Status', confirmMessage, [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Reset All',
              onPress: () => resolve(true),
            },
          ]);
        });
      }
    };

    const shouldReset = await confirmReset();
    if (shouldReset) {
      await resetAllPresentStatus();
      await loadData();
    }
  }, [loadData, label]);

  const {
    searchQuery,
    setSearchQuery,
    filterValues,
    setFilterValues,
    activeFilterCount,
    results,
  } = useEntitySearch(characters, {
    searchableText: item => [item.name],
    filterFields,
    initialFilterValues: { retiredStatus: 'active' },
  });

  const handleSearchPress = useCallback(() => {
    navigation.navigate('AdvancedSearch', {
      title: `Search ${label('character.plural')}`,
      fields: filterFields,
      initialValues: filterValues,
      onApply: setFilterValues,
    });
  }, [navigation, label, filterFields, filterValues, setFilterValues]);

  const filteredCharacters = React.useMemo(() => {
    const filtered = showOnlyPresent
      ? results.filter(c => c.present === true)
      : results;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [results, showOnlyPresent]);

  const renderItem = (item: GameCharacter) => (
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
          onPress={() => handleTogglePresent(item.id)}
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

  const renderHeaderButtons = () => (
    <>
      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            showOnlyPresent ? styles.filterButtonActive : styles.filterButton,
          ]}
          onPress={() => setShowOnlyPresent(!showOnlyPresent)}
        >
          <Text style={styles.buttonText}>
            {showOnlyPresent ? 'Show All' : 'Present Only'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.resetButton]}
          onPress={handleResetAllPresent}
        >
          <Text style={styles.buttonText}>Reset Present</Text>
        </TouchableOpacity>
      </View>
      <ActiveFiltersBar
        fields={filterFields}
        values={filterValues}
        onRemove={key => setFilterValues({ ...filterValues, [key]: undefined })}
      />
    </>
  );

  const renderHeaderRight = () => (
    <View style={styles.headerRight}>
      <HeaderAddButton
        onPress={() => navigation.navigate('CharacterForm', {})}
      />
    </View>
  );

  return (
    <BaseListScreen
      data={filteredCharacters}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={`Search ${label('character.plural', 'lower')} by name...`}
      onAdvancedSearchPress={handleSearchPress}
      advancedFilterCount={activeFilterCount}
      ListHeaderComponent={renderHeaderButtons()}
      headerRight={renderHeaderRight()}
      emptyStateTitle={`No ${label('character.plural', 'lower')} found`}
      emptyStateSubtitle={`Create a ${label('character.singular', 'lower')} to get started`}
      contentContainerStyle={styles.listContentContainer}
    />
  );
};
