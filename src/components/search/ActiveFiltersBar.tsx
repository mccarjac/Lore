import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/styles/theme';
import {
  FilterFieldConfig,
  FilterValues,
  isFilterValueActive,
  optionLabel,
} from './filterFieldTypes';

interface ActiveFiltersBarProps {
  fields: FilterFieldConfig[];
  values: FilterValues;
  onRemove: (key: string) => void;
}

export const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = ({
  fields,
  values,
  onRemove,
}) => {
  const { colors: themeColors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: themeColors.border,
          backgroundColor: themeColors.elevated,
        },
        chipText: {
          fontSize: 13,
          color: themeColors.text.primary,
          fontWeight: '500',
        },
        chipRemove: {
          marginLeft: 6,
          fontSize: 13,
          color: themeColors.text.muted,
        },
      }),
    [themeColors]
  );

  const activeFields = fields.filter(field =>
    isFilterValueActive(field, values[field.key])
  );

  if (activeFields.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {activeFields.map(field => {
        const value = values[field.key];
        const displayValue =
          field.type === 'select'
            ? optionLabel(field, value as string)
            : String(value);

        return (
          <TouchableOpacity
            key={field.key}
            style={styles.chip}
            onPress={() => onRemove(field.key)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${field.label} filter`}
          >
            <Text style={styles.chipText}>
              {field.label}: {displayValue}
            </Text>
            <Text style={styles.chipRemove}>✕</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
