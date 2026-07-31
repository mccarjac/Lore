import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useCommonStyles } from '@/styles/commonStyles';
import type { FacetCollection } from '@/ruleset/facets';

export interface FacetSingleSelectFieldProps {
  collection: FacetCollection;
  selectedId: string | undefined;
  onChange: (id: string) => void;
}

/**
 * A `selection: 'single'` facet collection's picker — the generalized form
 * of the old dedicated archetype `Picker`. Hidden when the collection has
 * only zero or one entry, mirroring the old `ruleset.archetypes.length > 1`
 * gate: a picker with one option offers nothing to choose.
 */
export const FacetSingleSelectField: React.FC<FacetSingleSelectFieldProps> = ({
  collection,
  selectedId,
  onChange,
}) => {
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        formSection: commonStyles.layout.formSection,
        label: commonStyles.text.label,
        picker: { ...commonStyles.input.picker, flex: 1 },
      }),
    [commonStyles]
  );

  if (collection.entries.length <= 1) return null;

  return (
    <View style={styles.formSection}>
      <Text style={styles.label}>{collection.singular}</Text>
      <Picker
        selectedValue={selectedId ?? ''}
        style={styles.picker}
        onValueChange={(value: string) => onChange(value)}
      >
        {collection.entries.map(entry => (
          <Picker.Item key={entry.id} label={entry.label} value={entry.id} />
        ))}
      </Picker>
    </View>
  );
};
