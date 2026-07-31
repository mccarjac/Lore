import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import { Section } from '@/components/common/Section';
import type { RulesetDefinition } from '@/ruleset/types';

export interface FacetCategoryScoresProps {
  ruleset: RulesetDefinition;
  /** `DerivedStats.categoryScores` — collectionId -> categoryId -> score. */
  categoryScores: Record<string, Record<string, number>>;
}

/**
 * One score section per facet collection that declares `categories` — the
 * generalized form of the old single hardcoded "Category Scores" block, now
 * rendering however many scored collections the ruleset has (zero, one, or
 * several).
 */
export const FacetCategoryScores: React.FC<FacetCategoryScoresProps> = ({
  ruleset,
  categoryScores,
}) => {
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 12,
        },
        item: {
          ...commonStyles.badge.base,
          ...commonStyles.badge.tag,
          flexDirection: 'row',
          alignItems: 'center',
        },
        name: {
          ...commonStyles.badge.text,
          color: themeColors.accent.primary,
        },
        score: {
          ...commonStyles.badge.text,
          fontWeight: '700',
          color: themeColors.accent.primary,
          marginLeft: 6,
        },
      }),
    [commonStyles, themeColors]
  );

  const scoredCollections = ruleset.facets.filter(
    collection => (collection.categories?.length ?? 0) > 0
  );

  return (
    <>
      {scoredCollections.map(collection => {
        const scores = categoryScores[collection.id];
        if (!scores || Object.keys(scores).length === 0) return null;

        return (
          <Section
            key={collection.id}
            title={`${collection.categoryPlural ?? 'Category'} Scores`}
          >
            <View style={styles.container}>
              {Object.entries(scores).map(([categoryId, score]) => {
                const category = collection.categories?.find(
                  c => c.id === categoryId
                );
                return (
                  <View key={categoryId} style={styles.item}>
                    <Text style={styles.name}>
                      {category?.label ?? categoryId}
                    </Text>
                    <Text style={styles.score}>{score}</Text>
                  </View>
                );
              })}
            </View>
          </Section>
        );
      })}
    </>
  );
};
