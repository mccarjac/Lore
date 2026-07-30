import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import { RootStackParamList } from '@/navigation/types';
import { FilterValues } from '@/components/search/filterFieldTypes';

type AdvancedSearchRouteProp = RouteProp<RootStackParamList, 'AdvancedSearch'>;

export const AdvancedSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AdvancedSearchRouteProp>();
  const { title, fields, initialValues, onApply } = route.params;
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();

  const [values, setValues] = useState<FilterValues>(initialValues);

  const styles = useMemo(
    () => ({
      container: commonStyles.layout.container,
      section: commonStyles.layout.section,
      title: commonStyles.text.h2,
      criteriaItem: { marginBottom: 16 as const },
      label: commonStyles.text.label,
      picker: { ...commonStyles.input.picker, marginBottom: 8 },
      input: commonStyles.input.base,
      applyButton: {
        ...commonStyles.button.base,
        ...commonStyles.button.primary,
        marginTop: 16,
      },
      applyButtonText: commonStyles.button.text,
      clearButton: {
        ...commonStyles.button.base,
        marginTop: 8,
        backgroundColor: themeColors.elevated,
      },
      clearButtonText: {
        ...commonStyles.button.text,
        color: themeColors.text.secondary,
      },
    }),
    [commonStyles, themeColors]
  );

  const handleApply = () => {
    onApply(values);
    navigation.goBack();
  };

  const handleClear = () => {
    setValues({});
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>{title}</Text>

        {fields.map(field => (
          <View key={field.key} style={styles.criteriaItem}>
            <Text style={styles.label}>{field.label}</Text>
            {field.type === 'select' ? (
              <Picker
                selectedValue={(values[field.key] as string) ?? ''}
                style={styles.picker}
                onValueChange={value =>
                  setValues(prev => ({
                    ...prev,
                    [field.key]: value || undefined,
                  }))
                }
              >
                <Picker.Item label={`Any ${field.label}`} value="" />
                {field.options.map(option => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Picker>
            ) : (
              <TextInput
                style={styles.input}
                value={
                  values[field.key] !== undefined
                    ? String(values[field.key])
                    : ''
                }
                onChangeText={text =>
                  setValues(prev => ({
                    ...prev,
                    [field.key]: text ? parseInt(text, 10) : undefined,
                  }))
                }
                placeholder={field.placeholder}
                placeholderTextColor={themeColors.text.muted}
                keyboardType="numeric"
              />
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Clear all</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
