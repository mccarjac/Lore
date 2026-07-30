import React, { useMemo } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';

interface HeaderSearchButtonProps {
  onPress: () => void;
  activeCount?: number;
}

export const HeaderSearchButton: React.FC<HeaderSearchButtonProps> = ({
  onPress,
  activeCount = 0,
}) => {
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          ...commonStyles.headerButton.add,
          marginRight: 4,
        },
        buttonText: {
          ...commonStyles.headerButton.addText,
          fontSize: 20,
        },
        badge: {
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          paddingHorizontal: 3,
          backgroundColor: themeColors.status.error,
          alignItems: 'center',
          justifyContent: 'center',
        },
        badgeText: {
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: '700',
        },
      }),
    [commonStyles, themeColors]
  );

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      accessibilityLabel="Advanced search"
    >
      <Text style={styles.buttonText}>🔍</Text>
      {activeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{activeCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
