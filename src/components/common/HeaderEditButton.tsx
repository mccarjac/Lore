import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useCommonStyles } from '@/styles/commonStyles';

interface HeaderEditButtonProps {
  onPress: () => void;
  label?: string;
}

export const HeaderEditButton: React.FC<HeaderEditButtonProps> = ({
  onPress,
  label = 'Edit',
}) => {
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        editButton: commonStyles.headerButton.edit,
        editButtonText: commonStyles.headerButton.text,
      }),
    [commonStyles]
  );

  return (
    <TouchableOpacity style={styles.editButton} onPress={onPress}>
      <Text style={styles.editButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};
