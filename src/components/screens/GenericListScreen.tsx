import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useCommonStyles } from '@/styles/commonStyles';
import { BaseListScreen } from './BaseListScreen';
import { HeaderAddButton } from '@/components/common/HeaderAddButton';
import { HeaderMenuButton } from '@/components/common/HeaderMenuButton';
import { ActiveFiltersBar } from '@/components/search/ActiveFiltersBar';
import { useEntitySearch } from '@/components/search/useEntitySearch';
import type { RootStackParamList } from '@/navigation/types';
import type { ListScreenConfig } from './listScreenConfig';

type AdvancedSearchNavigationProp = StackNavigationProp<
  RootStackParamList,
  'AdvancedSearch'
>;

export interface GenericListScreenProps<T, C = void> {
  config: ListScreenConfig<T, C>;
}

function confirmAction(
  title: string,
  message: string,
  confirmLabel: string
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise<boolean>(resolve => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}

export function GenericListScreen<T, C = void>({
  config,
}: GenericListScreenProps<T, C>) {
  const navigation = useNavigation<AdvancedSearchNavigationProp>();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRight: {
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        },
        extraHeaderButton: {
          ...commonStyles.headerButton.add,
          width: undefined,
          paddingHorizontal: 12,
        },
        extraHeaderButtonText: {
          ...commonStyles.headerButton.addText,
          fontSize: 14,
        },
        quickActionsRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 16,
        },
        quickActionButton: {
          ...commonStyles.button.base,
          flex: 1,
          marginHorizontal: 4,
        },
        quickFilterButton: commonStyles.button.outline,
        quickFilterButtonActive: commonStyles.button.outlineActive,
        bulkActionButton: commonStyles.button.warning,
        quickActionButtonText: commonStyles.button.text,
      }),
    [commonStyles]
  );

  const [items, setItems] = useState<T[]>([]);
  const [context, setContext] = useState<C>(
    () => config.initialContext ?? (undefined as C)
  );
  const [activeQuickFilters, setActiveQuickFilters] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      (config.quickFilters ?? []).map(qf => [qf.key, qf.defaultActive ?? false])
    )
  );

  const loadData = useCallback(async () => {
    const result = await config.loadData();
    setItems(result.items);
    setContext(result.context);
  }, [config]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filterFields = config.useFilterFields(context);

  const {
    searchQuery,
    setSearchQuery,
    filterValues,
    setFilterValues,
    activeFilterCount,
    results,
  } = useEntitySearch(items, {
    searchableText: config.searchableText,
    filterFields,
    initialFilterValues: config.initialFilterValues,
  });

  const displayedResults = useMemo(() => {
    const quickFilters = config.quickFilters ?? [];
    const filtered = quickFilters.length
      ? results.filter(item =>
          quickFilters.every(
            qf => !activeQuickFilters[qf.key] || qf.predicate(item)
          )
        )
      : results;
    return config.sortResults ? config.sortResults(filtered) : filtered;
  }, [results, activeQuickFilters, config]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate('AdvancedSearch', {
      title: config.advancedSearchTitle,
      fields: filterFields,
      initialValues: filterValues,
      onApply: setFilterValues,
    });
  }, [
    navigation,
    config.advancedSearchTitle,
    filterFields,
    filterValues,
    setFilterValues,
  ]);

  const handleBulkAction = useCallback(
    async (actionKey: string) => {
      const action = (config.bulkActions ?? []).find(a => a.key === actionKey);
      if (!action) return;
      const confirmed = await confirmAction(
        action.confirmTitle,
        action.confirmMessage,
        action.confirmLabel ?? 'Confirm'
      );
      if (confirmed) {
        await action.run();
        await loadData();
      }
    },
    [config, loadData]
  );

  const quickFilters = config.quickFilters ?? [];
  const bulkActions = config.bulkActions ?? [];

  const listHeaderContent =
    quickFilters.length > 0 || bulkActions.length > 0 ? (
      <>
        <View style={styles.quickActionsRow}>
          {quickFilters.map(qf => {
            const active = activeQuickFilters[qf.key] ?? false;
            return (
              <TouchableOpacity
                key={qf.key}
                style={[
                  styles.quickActionButton,
                  active
                    ? styles.quickFilterButtonActive
                    : styles.quickFilterButton,
                ]}
                onPress={() =>
                  setActiveQuickFilters(prev => ({
                    ...prev,
                    [qf.key]: !prev[qf.key],
                  }))
                }
              >
                <Text style={styles.quickActionButtonText}>
                  {qf.label(active)}
                </Text>
              </TouchableOpacity>
            );
          })}
          {bulkActions.map(action => (
            <TouchableOpacity
              key={action.key}
              style={[styles.quickActionButton, styles.bulkActionButton]}
              onPress={() => handleBulkAction(action.key)}
            >
              <Text style={styles.quickActionButtonText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ActiveFiltersBar
          fields={filterFields}
          values={filterValues}
          onRemove={key =>
            setFilterValues({ ...filterValues, [key]: undefined })
          }
        />
      </>
    ) : (
      <ActiveFiltersBar
        fields={filterFields}
        values={filterValues}
        onRemove={key => setFilterValues({ ...filterValues, [key]: undefined })}
      />
    );

  const extraHeaderButtons = (config.extraHeaderButtons ?? []).filter(
    button => button.visible !== false
  );
  const menuSections = config.menuSections ?? [];

  const headerRight =
    extraHeaderButtons.length > 0 ||
    menuSections.length > 0 ||
    config.onAddPress ? (
      <View style={styles.headerRight}>
        {extraHeaderButtons.map(button => (
          <TouchableOpacity
            key={button.key}
            style={styles.extraHeaderButton}
            onPress={button.onPress}
          >
            <Text style={styles.extraHeaderButtonText}>{button.label}</Text>
          </TouchableOpacity>
        ))}
        {menuSections.length > 0 && (
          <HeaderMenuButton sections={menuSections} />
        )}
        {config.onAddPress && <HeaderAddButton onPress={config.onAddPress} />}
      </View>
    ) : undefined;

  return (
    <BaseListScreen
      data={displayedResults}
      renderItem={config.renderItem}
      keyExtractor={config.keyExtractor}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={config.searchPlaceholder}
      onAdvancedSearchPress={handleSearchPress}
      advancedFilterCount={activeFilterCount}
      emptyStateTitle={config.emptyStateTitle}
      emptyStateSubtitle={config.emptyStateSubtitle}
      contentContainerStyle={config.contentContainerStyle}
      headerRight={headerRight}
      ListHeaderComponent={listHeaderContent}
    />
  );
}
