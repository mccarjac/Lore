import React, { useMemo } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import { roleOf, type AttributeDefinition } from '@/ruleset/attributes';
import type { AuthoredFacetEntry } from '@models/types';
import type { FacetCollection } from '@/ruleset/facets';
import type { RulesetDefinition } from '@/ruleset/types';

export interface FacetAuthoredEditorProps {
  collection: FacetCollection;
  ruleset: RulesetDefinition;
  entries: AuthoredFacetEntry[];
  onChange: (entries: AuthoredFacetEntry[]) => void;
}

const setAttributeDelta = (
  entry: AuthoredFacetEntry,
  attributeId: string,
  numValue: number | undefined
): AuthoredFacetEntry => {
  const existing = entry.modifier ?? {};
  const deltas = { ...(existing.attributeDeltas ?? {}) };

  if (numValue === undefined) {
    delete deltas[attributeId];
  } else {
    deltas[attributeId] = numValue;
  }

  return {
    ...entry,
    modifier: {
      ...existing,
      attributeDeltas: Object.keys(deltas).length > 0 ? deltas : undefined,
    },
  };
};

const setCategoryDeltas = (
  entry: AuthoredFacetEntry,
  targetCollectionId: string,
  categoryDeltas: Record<string, number>
): AuthoredFacetEntry => {
  const existingByCollection = { ...(entry.modifier?.categoryDeltas ?? {}) };
  if (Object.keys(categoryDeltas).length > 0) {
    existingByCollection[targetCollectionId] = categoryDeltas;
  } else {
    delete existingByCollection[targetCollectionId];
  }
  return {
    ...entry,
    modifier: {
      ...(entry.modifier ?? {}),
      categoryDeltas:
        Object.keys(existingByCollection).length > 0
          ? existingByCollection
          : undefined,
    },
  };
};

/**
 * Two per row, restricted to the roles this collection's
 * `contributes.deltaRoles` actually applies (the old hardcoded
 * resource/cap restriction, generalized) — a role `derived.ts` will never
 * read gets no input.
 */
const deltaAttributeRows = (
  attributes: AttributeDefinition[],
  deltaRoles: string[]
): AttributeDefinition[][] => {
  const editable = attributes.filter(attribute =>
    deltaRoles.includes(roleOf(attribute))
  );
  const rows: AttributeDefinition[][] = [];
  for (let index = 0; index < editable.length; index += 2) {
    rows.push(editable.slice(index, index + 2));
  }
  return rows;
};

/**
 * An `authored: true` facet collection's editor — the generalized form of
 * the old Modifications repeater. Each entry is free-authored (name,
 * description) plus an optional `Modifier`: attribute deltas restricted to
 * the collection's declared `deltaRoles`, and one category-delta sub-editor
 * per *other* collection that declares `categories` (so a modification can
 * shift score in however many scored collections a ruleset has, not just
 * one hardcoded trait-category map).
 */
export const FacetAuthoredEditor: React.FC<FacetAuthoredEditorProps> = ({
  collection,
  ruleset,
  entries,
  onChange,
}) => {
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const deltaRoles = collection.contributes?.deltaRoles ?? [];
  const attributeRows = deltaAttributeRows(ruleset.attributes, deltaRoles);
  const scoredCollections = ruleset.facets.filter(
    c => c.id !== collection.id && (c.categories?.length ?? 0) > 0
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: themeColors.elevated,
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        },
        nameInput: {
          ...commonStyles.input.base,
          flex: 1,
          padding: 12,
          borderRadius: 8,
          fontWeight: '600',
        },
        descriptionInput: {
          ...commonStyles.input.base,
          padding: 12,
          borderRadius: 8,
          minHeight: 60,
          textAlignVertical: 'top',
          marginBottom: 12,
        },
        modifiersSection: {
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: themeColors.border,
        },
        modifiersLabel: {
          ...commonStyles.text.label,
          fontSize: 14,
          marginBottom: 12,
          color: themeColors.accent.primary,
        },
        row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
        inputGroup: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        inputLabel: {
          ...commonStyles.text.label,
          fontSize: 13,
          marginBottom: 0,
          minWidth: 80,
        },
        numericField: {
          ...commonStyles.input.base,
          flex: 1,
          padding: 8,
          borderRadius: 6,
          textAlign: 'center',
        },
        categorySection: {
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: themeColors.border,
        },
        categoryLabel: {
          ...commonStyles.text.label,
          fontSize: 14,
          marginBottom: 12,
          color: themeColors.accent.secondary,
        },
        categoryRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: themeColors.surface,
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: themeColors.border,
          marginBottom: 8,
        },
        categoryName: {
          ...commonStyles.text.label,
          fontSize: 13,
          marginBottom: 0,
          minWidth: 90,
          color: themeColors.text.primary,
        },
        categoryField: {
          ...commonStyles.input.base,
          flex: 1,
          padding: 8,
          borderRadius: 6,
          textAlign: 'center',
          minWidth: 60,
        },
        removeCategoryButton: {
          backgroundColor: themeColors.status.error,
          borderRadius: 4,
          width: 28,
          height: 28,
          alignItems: 'center',
          justifyContent: 'center',
        },
        removeCategoryButtonText: {
          color: themeColors.text.primary,
          fontSize: 18,
          fontWeight: '700',
          lineHeight: 20,
        },
        addCategoryButton: {
          backgroundColor: themeColors.surface,
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: themeColors.accent.secondary,
          borderStyle: 'dashed',
          alignItems: 'center',
        },
        addCategoryButtonText: {
          ...commonStyles.text.label,
          fontSize: 13,
          marginBottom: 0,
          color: themeColors.accent.secondary,
        },
        removeButton: {
          ...commonStyles.button.small,
          backgroundColor: themeColors.status.error,
        },
        removeButtonText: commonStyles.button.textSmall,
        addButton: {
          ...commonStyles.button.base,
          ...commonStyles.button.primary,
          marginTop: 12,
        },
        addButtonText: commonStyles.button.text,
      }),
    [commonStyles, themeColors]
  );

  const updateEntry = (index: number, next: AuthoredFacetEntry) => {
    const copy = [...entries];
    copy[index] = next;
    onChange(copy);
  };

  return (
    <View>
      {entries.map((entry, index) => (
        <View key={index} style={styles.container}>
          <View style={styles.headerRow}>
            <TextInput
              style={styles.nameInput}
              value={entry.name}
              onChangeText={value =>
                updateEntry(index, { ...entry, name: value })
              }
              placeholder={`${collection.singular} name`}
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onChange(entries.filter((_, i) => i !== index))}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.descriptionInput}
            value={entry.description ?? ''}
            onChangeText={value =>
              updateEntry(index, { ...entry, description: value })
            }
            placeholder="Description"
            multiline
          />
          {attributeRows.length > 0 && (
            <View style={styles.modifiersSection}>
              <Text style={styles.modifiersLabel}>
                Stat Modifiers (optional):
              </Text>
              {attributeRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                  {row.map(attribute => (
                    <View key={attribute.id} style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>{attribute.label}:</Text>
                      <TextInput
                        style={styles.numericField}
                        value={
                          entry.modifier?.attributeDeltas?.[
                            attribute.id
                          ]?.toString() || ''
                        }
                        onChangeText={value => {
                          const numValue =
                            value === '' ? undefined : parseInt(value) || 0;
                          updateEntry(
                            index,
                            setAttributeDelta(entry, attribute.id, numValue)
                          );
                        }}
                        placeholder="0"
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                </View>
              ))}
              {scoredCollections.map(target => {
                const currentDeltas =
                  entry.modifier?.categoryDeltas?.[target.id] ?? {};
                return (
                  <View key={target.id} style={styles.categorySection}>
                    <Text style={styles.categoryLabel}>
                      {target.categorySingular ?? 'Category'} Score Modifiers
                      (optional):
                    </Text>
                    {Object.entries(currentDeltas).map(
                      ([categoryId, value]) => {
                        const category = target.categories?.find(
                          c => c.id === categoryId
                        );
                        return (
                          <View key={categoryId} style={styles.categoryRow}>
                            <Text style={styles.categoryName}>
                              {category?.label ?? categoryId}:
                            </Text>
                            <TextInput
                              style={styles.categoryField}
                              value={value.toString()}
                              onChangeText={text => {
                                const numValue =
                                  text === '' ? undefined : parseInt(text) || 0;
                                const next = { ...currentDeltas };
                                if (numValue === undefined) {
                                  delete next[categoryId];
                                } else {
                                  next[categoryId] = numValue;
                                }
                                updateEntry(
                                  index,
                                  setCategoryDeltas(entry, target.id, next)
                                );
                              }}
                              placeholder="0"
                              keyboardType="numeric"
                            />
                            <TouchableOpacity
                              style={styles.removeCategoryButton}
                              onPress={() => {
                                const next = { ...currentDeltas };
                                delete next[categoryId];
                                updateEntry(
                                  index,
                                  setCategoryDeltas(entry, target.id, next)
                                );
                              }}
                            >
                              <Text style={styles.removeCategoryButtonText}>
                                ×
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                    )}
                    <TouchableOpacity
                      style={styles.addCategoryButton}
                      onPress={() => {
                        const available = (target.categories ?? [])
                          .map(c => c.id)
                          .filter(id => !(id in currentDeltas));
                        if (available.length === 0) {
                          Alert.alert(
                            `All ${target.categoryPlural ?? 'Categories'} Added`,
                            `All available ${(
                              target.categoryPlural ?? 'categories'
                            ).toLowerCase()} already have modifiers.`
                          );
                          return;
                        }
                        updateEntry(
                          index,
                          setCategoryDeltas(entry, target.id, {
                            ...currentDeltas,
                            [available[0]]: 1,
                          })
                        );
                      }}
                    >
                      <Text style={styles.addCategoryButtonText}>
                        + Add {target.categorySingular ?? 'Category'} Modifier
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ))}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => onChange([...entries, { name: '', description: '' }])}
      >
        <Text style={styles.addButtonText}>Add {collection.singular}</Text>
      </TouchableOpacity>
    </View>
  );
};
