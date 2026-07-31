import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import { CollapsibleSection } from '@/components/common/CollapsibleSection';
import {
  findFacetCollection,
  getAuthoredFacets,
  resolveFacetEntries,
  type FacetCollection,
} from '@/ruleset/facets';
import type { GameCharacter } from '@models/types';
import type { Modifier, RulesetDefinition } from '@/ruleset/types';

export interface FacetDetailSectionProps {
  collection: FacetCollection;
  ruleset: RulesetDefinition;
  character: GameCharacter;
}

interface DisplayEntry {
  key: string;
  label: string;
  description?: string;
  modifier?: Modifier;
  links?: Record<string, string[]>;
}

/**
 * Read-only display for one `selection: 'multi'` (or `authored`) facet
 * collection a character holds entries in — the generalized form of the old
 * dedicated Traits/Qualities/Modifications detail blocks. Renders a held
 * entry's modifier deltas (attribute and, per target collection, category)
 * and any linked catalog entries (the old trait -> recipe display).
 */
export const FacetDetailSection: React.FC<FacetDetailSectionProps> = ({
  collection,
  ruleset,
  character,
}) => {
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        itemContainer: {
          marginBottom: 16,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.border,
          backgroundColor: themeColors.elevated,
          padding: 12,
          borderRadius: 8,
        },
        titleText: { ...commonStyles.text.body, fontWeight: '600' },
        descriptionText: {
          ...commonStyles.text.description,
          marginTop: 6,
          lineHeight: 20,
        },
        modifiersContainer: {
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: themeColors.border,
        },
        modifiersTitle: {
          ...commonStyles.text.label,
          fontSize: 14,
          marginBottom: 8,
          color: themeColors.accent.primary,
        },
        modifierLine: {
          ...commonStyles.text.body,
          fontSize: 14,
          marginLeft: 8,
          marginBottom: 4,
          color: themeColors.text.secondary,
        },
        linksContainer: {
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 2,
          borderTopColor: themeColors.border,
        },
        linksTitle: {
          ...commonStyles.text.h3,
          marginBottom: 12,
          color: themeColors.accent.primary,
        },
        linkItem: {
          backgroundColor: themeColors.surface,
          padding: 16,
          borderRadius: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        linkName: { ...commonStyles.text.body, fontWeight: '600' },
        materialsTitle: {
          ...commonStyles.text.label,
          fontSize: 14,
          marginTop: 8,
          marginBottom: 8,
        },
        materialItem: {
          ...commonStyles.text.body,
          marginLeft: 12,
          marginBottom: 4,
        },
      }),
    [commonStyles, themeColors]
  );

  const catalogEntries: DisplayEntry[] = resolveFacetEntries(
    character,
    collection
  ).map(entry => ({
    key: entry.id,
    label: entry.label,
    description: entry.description,
    modifier: entry.modifier,
    links: entry.links,
  }));

  const authoredEntries: DisplayEntry[] = collection.authored
    ? getAuthoredFacets(character, collection.id).map((entry, index) => ({
        key: `authored-${index}`,
        label: entry.name,
        description: entry.description,
        modifier: entry.modifier,
      }))
    : [];

  const allEntries = [...catalogEntries, ...authoredEntries];
  if (allEntries.length === 0) return null;

  return (
    <CollapsibleSection title={collection.plural} defaultCollapsed>
      {allEntries.map(entry => (
        <View key={entry.key} style={styles.itemContainer}>
          <Text style={styles.titleText}>{entry.label}</Text>
          {entry.description ? (
            <Text style={styles.descriptionText}>{entry.description}</Text>
          ) : null}

          {entry.modifier && (
            <View style={styles.modifiersContainer}>
              <Text style={styles.modifiersTitle}>Modifiers:</Text>
              {Object.entries(entry.modifier.attributeDeltas ?? {}).map(
                ([attributeId, delta]) => {
                  const attrLabel =
                    ruleset.attributes.find(a => a.id === attributeId)?.label ??
                    attributeId;
                  return (
                    <Text key={attributeId} style={styles.modifierLine}>
                      • {attrLabel}: {delta > 0 ? '+' : ''}
                      {delta}
                    </Text>
                  );
                }
              )}
              {Object.entries(entry.modifier.categoryDeltas ?? {}).flatMap(
                ([targetCollectionId, deltas]) => {
                  const target = findFacetCollection(
                    ruleset,
                    targetCollectionId
                  );
                  return Object.entries(deltas).map(([categoryId, delta]) => {
                    const categoryLabel =
                      target?.categories?.find(c => c.id === categoryId)
                        ?.label ?? categoryId;
                    return (
                      <Text
                        key={`${targetCollectionId}-${categoryId}`}
                        style={styles.modifierLine}
                      >
                        • {categoryLabel}{' '}
                        {target?.categorySingular ?? 'Category'} Score:{' '}
                        {delta > 0 ? '+' : ''}
                        {delta}
                      </Text>
                    );
                  });
                }
              )}
            </View>
          )}

          {entry.links &&
            Object.entries(entry.links).map(([targetCollectionId, ids]) => {
              const target = findFacetCollection(ruleset, targetCollectionId);
              if (!target || ids.length === 0) return null;
              return (
                <View key={targetCollectionId} style={styles.linksContainer}>
                  <Text style={styles.linksTitle}>Known {target.plural}:</Text>
                  {ids.map(id => {
                    const linked = target.entries.find(e => e.id === id);
                    if (!linked) return null;
                    return (
                      <View key={id} style={styles.linkItem}>
                        <Text style={styles.linkName}>{linked.label}</Text>
                        {linked.description ? (
                          <Text style={styles.descriptionText}>
                            {linked.description}
                          </Text>
                        ) : null}
                        {linked.materials && linked.materials.length > 0 && (
                          <>
                            <Text style={styles.materialsTitle}>
                              Materials Needed:
                            </Text>
                            {linked.materials.map((material, index) => (
                              <Text key={index} style={styles.materialItem}>
                                • {material}
                              </Text>
                            ))}
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
        </View>
      ))}
    </CollapsibleSection>
  );
};
