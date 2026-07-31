import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import { CollapsibleSection } from '@/components/common/CollapsibleSection';
import {
  findFacetCollection,
  type FacetCollection,
  type FacetEntry,
} from '@/ruleset/facets';
import type { RulesetDefinition } from '@/ruleset/types';

export interface FacetMultiSelectFieldProps {
  collection: FacetCollection;
  ruleset: RulesetDefinition;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /**
   * Every other collection's current selections, keyed by collection id —
   * needed to resolve an entry's `requires` (the generalized form of the old
   * `trait.allowedArchetypeIds.includes(character.archetypeId)` check) and to
   * label the restriction badge.
   */
  allSelections: Record<string, string[]>;
  defaultCollapsed?: boolean;
}

const isAvailable = (
  entry: FacetEntry,
  allSelections: Record<string, string[]>
): boolean =>
  Object.entries(entry.requires ?? {}).every(([collectionId, ids]) =>
    ids.some(id => (allSelections[collectionId] ?? []).includes(id))
  );

/** "Warden" for a single-id restriction, "3 Archetypes" for several. */
const restrictionLabel = (
  entry: FacetEntry,
  ruleset: RulesetDefinition
): string | undefined => {
  const requirement = Object.entries(entry.requires ?? {})[0];
  if (!requirement) return undefined;
  const [collectionId, ids] = requirement;
  const target = findFacetCollection(ruleset, collectionId);
  if (!target) return undefined;
  if (ids.length === 1) {
    return target.entries.find(e => e.id === ids[0])?.label ?? ids[0];
  }
  return `${ids.length} ${target.plural}`;
};

/**
 * A `selection: 'multi'` catalog collection's picker — the generalized form
 * of the old dedicated Traits/Qualities blocks. Handles an optional category
 * filter (only when the collection declares `categories`), `maxSelections`
 * (the old `limits.maxQualities`), and `requires`-based availability with a
 * restriction badge (the old archetype-restricted trait badge).
 */
export const FacetMultiSelectField: React.FC<FacetMultiSelectFieldProps> = ({
  collection,
  ruleset,
  selectedIds,
  onChange,
  allSelections,
  defaultCollapsed = true,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        filterContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        },
        filterLabel: {
          ...commonStyles.text.label,
          marginRight: 12,
          marginBottom: 0,
        },
        picker: { ...commonStyles.input.picker, flex: 1 },
        item: {
          backgroundColor: themeColors.elevated,
          padding: 16,
          borderRadius: 12,
          marginVertical: 6,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        selectedItem: {
          backgroundColor: themeColors.interactive.hover,
          borderColor: themeColors.accent.primary,
        },
        restrictedItem: {
          borderLeftWidth: 4,
          borderLeftColor: themeColors.status.info,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        itemName: {
          fontSize: 16,
          color: themeColors.text.primary,
          fontWeight: '500',
        },
        categoryBadge: {
          ...commonStyles.badge.text,
          ...commonStyles.badge.tag,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        restrictionBadge: {
          ...commonStyles.badge.text,
          ...commonStyles.badge.species,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        description: {
          ...commonStyles.text.description,
          marginTop: 6,
          lineHeight: 20,
        },
      }),
    [commonStyles, themeColors]
  );

  if (collection.entries.length === 0) return null;

  const toggle = (entryId: string) => {
    if (selectedIds.includes(entryId)) {
      onChange(selectedIds.filter(id => id !== entryId));
      return;
    }
    if (
      collection.maxSelections !== undefined &&
      selectedIds.length >= collection.maxSelections
    ) {
      Alert.alert(
        'Maximum Reached',
        `You can only select up to ${collection.maxSelections} ${collection.plural.toLowerCase()}.`
      );
      return;
    }
    onChange([...selectedIds, entryId]);
  };

  const visibleEntries = collection.entries.filter(
    entry =>
      (!selectedCategoryId || entry.categoryId === selectedCategoryId) &&
      isAvailable(entry, allSelections)
  );

  return (
    <CollapsibleSection
      title={collection.plural}
      defaultCollapsed={defaultCollapsed}
    >
      {collection.categories && collection.categories.length > 0 && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>
            Filter by {collection.categorySingular ?? 'Category'}:
          </Text>
          <Picker
            selectedValue={selectedCategoryId}
            style={styles.picker}
            onValueChange={setSelectedCategoryId}
          >
            <Picker.Item
              label={`All ${collection.categoryPlural ?? 'Categories'}`}
              value=""
            />
            {collection.categories.map(category => (
              <Picker.Item
                key={category.id}
                label={category.label}
                value={category.id}
              />
            ))}
          </Picker>
        </View>
      )}
      {visibleEntries.map(entry => {
        const restriction = restrictionLabel(entry, ruleset);
        const category = collection.categories?.find(
          c => c.id === entry.categoryId
        );
        return (
          <TouchableOpacity
            key={entry.id}
            style={[
              styles.item,
              selectedIds.includes(entry.id) && styles.selectedItem,
              entry.requires && styles.restrictedItem,
            ]}
            onPress={() => toggle(entry.id)}
          >
            <View style={styles.headerRow}>
              <Text style={styles.itemName}>{entry.label}</Text>
              <View style={styles.badgeRow}>
                {restriction && (
                  <Text style={styles.restrictionBadge}>{restriction}</Text>
                )}
                {category && (
                  <Text style={styles.categoryBadge}>{category.label}</Text>
                )}
              </View>
            </View>
            {entry.description && (
              <Text style={styles.description}>{entry.description}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </CollapsibleSection>
  );
};
