import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useCommonStyles } from '@/styles/commonStyles';

interface HeaderStatsButtonProps {
  onPress: () => void;
  label?: string;
}

export const HeaderStatsButton: React.FC<HeaderStatsButtonProps> = ({
  onPress,
  label = '%',
}) => {
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerStatsButton: commonStyles.headerButton.add,
        headerStatsButtonText: commonStyles.headerButton.addText,
      }),
    [commonStyles]
  );

  return (
    <TouchableOpacity style={styles.headerStatsButton} onPress={onPress}>
      <Text style={styles.headerStatsButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};
