import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, borderRadius, spacing } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import type { MenuSection } from './menuTypes';

interface HeaderMenuButtonProps {
  sections: MenuSection[];
  label?: string;
}

export const HeaderMenuButton: React.FC<HeaderMenuButtonProps> = ({
  sections,
  label = '⋮',
}) => {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors: themeColors, shadows } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        trigger: commonStyles.headerButton.add,
        triggerText: commonStyles.headerButton.addText,
        overlay: {
          flex: 1,
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          paddingTop: insets.top + 56,
          paddingRight: spacing.md,
        },
        panel: {
          minWidth: 220,
          backgroundColor: themeColors.surface,
          borderWidth: 1,
          borderColor: themeColors.border,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.sm,
          ...shadows.small,
        },
        sectionTitle: {
          ...commonStyles.text.caption,
          fontWeight: '600',
          paddingHorizontal: spacing.base,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
        },
        itemRow: {
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
        },
        itemLabel: commonStyles.text.body,
      }),
    [commonStyles, themeColors, shadows, insets]
  );

  const close = () => setVisible(false);

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="More options"
      >
        <Text style={styles.triggerText}>{label}</Text>
      </Pressable>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable
          style={styles.overlay}
          onPress={close}
          testID="header-menu-overlay"
        >
          <Pressable style={styles.panel} onPress={() => {}}>
            {sections.map(section => (
              <View key={section.title}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map(item => (
                  <Pressable
                    key={item.label}
                    style={styles.itemRow}
                    accessibilityRole="button"
                    onPress={() => {
                      close();
                      item.onPress();
                    }}
                  >
                    <Text style={styles.itemLabel}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
