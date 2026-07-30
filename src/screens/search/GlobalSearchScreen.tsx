import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  useNavigation,
  useFocusEffect,
  CompositeNavigationProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RootStackParamList, RootDrawerParamList } from '@/navigation/types';
import {
  loadCharacters,
  loadFactions,
  loadLocations,
  loadEvents,
  loadQuests,
} from '@utils/characterStorage';
import {
  GlobalSearchData,
  GlobalSearchResult,
  SearchDomain,
  SEARCH_DOMAIN_ORDER,
  MIN_QUERY_LENGTH,
  searchAllDomains,
} from '@utils/globalSearch';
import { useCommonStyles } from '@/styles/commonStyles';
import { spacing } from '@/styles/theme';
import { BaseListScreen } from '@/components';
import { useRuleset, getLabel, type RulesetDefinition } from '@/ruleset';

type NavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<RootDrawerParamList, 'GlobalSearch'>,
  StackNavigationProp<RootStackParamList>
>;

const domainLabels = (
  ruleset: RulesetDefinition
): Record<SearchDomain, string> => ({
  character: getLabel(ruleset, 'character.plural'),
  faction: getLabel(ruleset, 'faction.plural'),
  location: 'Locations',
  event: 'Events',
  quest: getLabel(ruleset, 'quest.plural'),
});

const domainBadges = (
  ruleset: RulesetDefinition
): Record<SearchDomain, string> => ({
  character: getLabel(ruleset, 'character.singular'),
  faction: getLabel(ruleset, 'faction.singular'),
  location: 'Location',
  event: 'Event',
  quest: getLabel(ruleset, 'quest.singular'),
});

type SearchRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'result'; key: string; result: GlobalSearchResult };

const EMPTY_DATA: GlobalSearchData = {
  characters: [],
  factions: [],
  locations: [],
  events: [],
  quests: [],
};

export const GlobalSearchScreen: React.FC = () => {
  const [data, setData] = useState<GlobalSearchData>(EMPTY_DATA);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const navigation = useNavigation<NavigationProp>();
  const { ruleset } = useRuleset();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        sectionHeader: {
          ...commonStyles.text.h3,
          marginTop: spacing.base,
          marginBottom: spacing.xs,
        },
        card: commonStyles.card.base,
        cardHeader: commonStyles.card.header,
        title: {
          ...commonStyles.text.h3,
          flex: 1,
        },
        badge: {
          ...commonStyles.badge.base,
          ...commonStyles.badge.small,
          ...commonStyles.badge.tag,
        },
        badgeText: commonStyles.badge.text,
        subtitle: {
          ...commonStyles.text.caption,
          marginTop: spacing.sm,
        },
      }),
    [commonStyles]
  );

  const loadData = useCallback(async () => {
    const [characters, factions, locations, events, quests] = await Promise.all(
      [
        loadCharacters(),
        loadFactions(),
        loadLocations(),
        loadEvents(),
        loadQuests(),
      ]
    );
    setData({ characters, factions, locations, events, quests });
  }, []);

  // Reload all domains whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const rows = useMemo<SearchRow[]>(() => {
    const results = searchAllDomains(data, searchQuery, ruleset);
    const labels = domainLabels(ruleset);
    const grouped: SearchRow[] = [];
    for (const domain of SEARCH_DOMAIN_ORDER) {
      const domainResults = results.filter(result => result.domain === domain);
      if (domainResults.length === 0) {
        continue;
      }
      grouped.push({
        kind: 'header',
        key: `header:${domain}`,
        label: `${labels[domain]} (${domainResults.length})`,
      });
      for (const result of domainResults) {
        grouped.push({ kind: 'result', key: result.key, result });
      }
    }
    return grouped;
  }, [data, searchQuery, ruleset]);

  const handleResultPress = useCallback(
    (result: GlobalSearchResult) => {
      switch (result.domain) {
        case 'character':
          navigation.navigate('CharacterDetail', {
            character: result.character,
          });
          break;
        case 'faction':
          navigation.navigate('FactionDetails', {
            factionName: result.factionName,
          });
          break;
        case 'location':
          navigation.navigate('LocationDetails', {
            locationId: result.locationId,
          });
          break;
        case 'event':
          navigation.navigate('EventsDetail', { eventId: result.eventId });
          break;
        case 'quest':
          navigation.navigate('QuestsDetail', { questId: result.questId });
          break;
      }
    },
    [navigation]
  );

  const renderItem = (row: SearchRow) => {
    if (row.kind === 'header') {
      return <Text style={styles.sectionHeader}>{row.label}</Text>;
    }
    const { result } = row;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleResultPress(result)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {result.title}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {domainBadges(ruleset)[result.domain]}
            </Text>
          </View>
        </View>
        {result.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="tail">
            {result.subtitle}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const isIdle = searchQuery.trim().length < MIN_QUERY_LENGTH;

  return (
    <BaseListScreen
      data={rows}
      renderItem={renderItem}
      keyExtractor={row => row.key}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search all domains..."
      emptyStateTitle={isIdle ? 'Search everything' : 'No results'}
      emptyStateSubtitle={
        isIdle
          ? 'Find characters, factions, locations, events, and quests'
          : 'Try a different search term'
      }
    />
  );
};
