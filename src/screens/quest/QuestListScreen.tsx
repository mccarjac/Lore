import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GameQuest, QuestStatus } from '@models/types';
import {
  loadQuests,
  migrateRulesetFields,
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
import { colors as themeColors } from '@/styles/theme';
import { commonStyles } from '@/styles/commonStyles';
import {
  BaseListScreen,
  HeaderAddButton,
  HeaderSearchButton,
  ActiveFiltersBar,
  useEntitySearch,
  type FilterFieldConfig,
} from '@/components';
import { formatEventDateShort } from '@utils/dateUtils';
import { useLabels } from '@/ruleset';

type QuestListNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'Quests'>,
  StackNavigationProp<RootStackParamList>
>;

const STATUS_LABELS: Record<QuestStatus, string> = {
  [QuestStatus.NotStarted]: 'Not Started',
  [QuestStatus.Assigned]: 'Assigned',
  [QuestStatus.InProgress]: 'In Progress',
  [QuestStatus.Successful]: 'Successful',
  [QuestStatus.Failure]: 'Failure',
};

const STATUS_COLORS: Record<QuestStatus, string> = {
  [QuestStatus.NotStarted]: themeColors.text.muted,
  [QuestStatus.Assigned]: themeColors.accent.info,
  [QuestStatus.InProgress]: themeColors.accent.warning,
  [QuestStatus.Successful]: themeColors.accent.success,
  [QuestStatus.Failure]: themeColors.accent.danger,
};

const materialsProgress = (quest: GameQuest): string | null => {
  const materials = quest.requiredMaterials;
  if (!materials || materials.length === 0) return null;

  const complete = materials.filter(
    m => m.quantityProvided >= m.quantityRequired
  ).length;
  return `${complete}/${materials.length} materials`;
};

const questFilterFields: FilterFieldConfig[] = [
  {
    key: 'status',
    type: 'select',
    label: 'Status',
    options: Object.values(QuestStatus).map(status => ({
      value: status,
      label: STATUS_LABELS[status],
    })),
    matches: (item, value) => (item as GameQuest).status === value,
  },
];

export const QuestListScreen: React.FC = () => {
  const [quests, setQuests] = useState<GameQuest[]>([]);
  const navigation = useNavigation<QuestListNavigationProp>();
  const label = useLabels();

  const loadData = useCallback(async () => {
    // Backfill/prune quest<->event back-references (idempotent operation)
    await reconcileQuestEventLinks();
    // Rename pre-Phase-1 ruleset fields in place (idempotent)
    await migrateRulesetFields();

    const questsData = await loadQuests();
    setQuests([...questsData].sort((a, b) => a.name.localeCompare(b.name)));
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
    results: filteredQuests,
  } = useEntitySearch(quests, {
    searchableText: item => [item.name, item.details ?? ''],
    filterFields: questFilterFields,
  });

  const handleQuestSelect = (quest: GameQuest) => {
    navigation.navigate('QuestsDetail', { questId: quest.id });
  };

  const handleCreateQuest = () => {
    navigation.navigate('QuestsForm', {});
  };

  const handleGenerateProposals = () => {
    navigation.navigate('QuestProposals');
  };

  const handleSearchPress = useCallback(() => {
    navigation.navigate('AdvancedSearch', {
      title: `Search ${label('quest.plural')}`,
      fields: questFilterFields,
      initialValues: filterValues,
      onApply: setFilterValues,
    });
  }, [navigation, label, filterValues, setFilterValues]);

  const renderQuestItem = (quest: GameQuest) => {
    const materials = materialsProgress(quest);
    const teamCount = quest.assignedCharacterIds?.length ?? 0;

    return (
      <TouchableOpacity
        style={styles.questCard}
        onPress={() => handleQuestSelect(quest)}
      >
        <View style={styles.questHeader}>
          <Text style={styles.questName}>{quest.name}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: STATUS_COLORS[quest.status] },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {STATUS_LABELS[quest.status]}
            </Text>
          </View>
        </View>

        {quest.date && (
          <Text style={styles.questMeta}>
            {formatEventDateShort(quest.date, quest.time)}
          </Text>
        )}

        <View style={styles.questFooter}>
          <Text style={styles.questMeta}>
            {teamCount} character{teamCount !== 1 ? 's' : ''} assigned
          </Text>
          {materials && <Text style={styles.questMeta}>{materials}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeaderRight = () => (
    <View style={styles.headerButtons}>
      <TouchableOpacity
        style={styles.headerProposalsButton}
        onPress={handleGenerateProposals}
      >
        <Text style={styles.headerProposalsButtonText}>Propose</Text>
      </TouchableOpacity>
      <HeaderSearchButton
        activeCount={activeFilterCount}
        onPress={handleSearchPress}
      />
      <HeaderAddButton onPress={handleCreateQuest} />
    </View>
  );

  return (
    <BaseListScreen
      data={filteredQuests}
      renderItem={renderQuestItem}
      keyExtractor={(item: GameQuest) => item.id}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={`Search ${label('quest.plural', 'lower')} by name...`}
      emptyStateTitle={`No ${label('quest.plural', 'lower')} found`}
      emptyStateSubtitle={`Create a ${label('quest.singular', 'lower')} to get started`}
      headerRight={renderHeaderRight()}
      ListHeaderComponent={
        <ActiveFiltersBar
          fields={questFilterFields}
          values={filterValues}
          onRemove={key =>
            setFilterValues({ ...filterValues, [key]: undefined })
          }
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  questCard: commonStyles.card.base,
  questHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  questName: {
    ...commonStyles.text.h3,
    flex: 1,
  },
  statusBadge: {
    ...commonStyles.badge.small,
  },
  statusBadgeText: {
    ...commonStyles.badge.text,
    fontSize: 11,
  },
  questFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  questMeta: commonStyles.text.caption,
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerProposalsButton: {
    ...commonStyles.headerButton.add,
    width: undefined,
    paddingHorizontal: 12,
  },
  headerProposalsButtonText: {
    ...commonStyles.headerButton.addText,
    fontSize: 13,
  },
});
