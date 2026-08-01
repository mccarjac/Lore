import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GameCharacter } from '@models/types';
import {
  loadCharacters,
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
        card: commonStyles.card.base,
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

  const filteredCharacters = React.useMemo(
    () => [...results].sort((a, b) => a.name.localeCompare(b.name)),
    [results]
  );

  const renderItem = (item: GameCharacter) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('CharacterDetail', { character: item })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
      </View>
      <Text style={styles.factions}>
        {(item.factions || []).map(f => f.name).join(', ') || 'No factions'}
      </Text>
    </TouchableOpacity>
  );

  const renderHeaderButtons = () => (
    <ActiveFiltersBar
      fields={filterFields}
      values={filterValues}
      onRemove={key => setFilterValues({ ...filterValues, [key]: undefined })}
    />
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
