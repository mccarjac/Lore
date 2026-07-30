import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useCommonStyles } from '@/styles/commonStyles';

interface HeaderDeleteButtonProps {
  onPress: () => void;
  label?: string;
}

export const HeaderDeleteButton: React.FC<HeaderDeleteButtonProps> = ({
  onPress,
  label = 'Delete',
}) => {
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        deleteButton: commonStyles.headerButton.delete,
        deleteButtonText: commonStyles.headerButton.text,
      }),
    [commonStyles]
  );

  return (
    <TouchableOpacity style={styles.deleteButton} onPress={onPress}>
      <Text style={styles.deleteButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};
