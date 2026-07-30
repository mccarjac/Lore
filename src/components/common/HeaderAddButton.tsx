import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useCommonStyles } from '@/styles/commonStyles';

interface HeaderAddButtonProps {
  onPress: () => void;
  label?: string;
}

export const HeaderAddButton: React.FC<HeaderAddButtonProps> = ({
  onPress,
  label = '+',
}) => {
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerAddButton: commonStyles.headerButton.add,
        headerAddButtonText: commonStyles.headerButton.addText,
      }),
    [commonStyles]
  );

  return (
    <TouchableOpacity style={styles.headerAddButton} onPress={onPress}>
      <Text style={styles.headerAddButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};
