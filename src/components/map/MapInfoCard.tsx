import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameLocation } from '@models/types';
import { colors, spacing, borderRadius, shadows } from '@/styles/theme';
import { commonStyles } from '@/styles/commonStyles';

interface MapInfoCardProps {
  location: GameLocation;
  onViewDetails: (locationId: string) => void;
  onClose: () => void;
  onViewMap?: () => void;
  onRemovePin?: () => void;
}

export const MapInfoCard: React.FC<MapInfoCardProps> = ({
  location,
  onViewDetails,
  onClose,
  onViewMap,
  onRemovePin,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {location.name}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {location.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {location.description}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, commonStyles.button.primary]}
          onPress={() => onViewDetails(location.id)}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${location.name}`}
        >
          <Text style={commonStyles.button.text}>View details</Text>
        </TouchableOpacity>

        {onViewMap && (
          <TouchableOpacity
            style={[styles.actionButton, commonStyles.button.secondary]}
            onPress={onViewMap}
            accessibilityRole="button"
            accessibilityLabel={`View map for ${location.name}`}
          >
            <Text style={commonStyles.button.text}>View map</Text>
          </TouchableOpacity>
        )}

        {onRemovePin && (
          <TouchableOpacity
            style={[styles.actionButton, commonStyles.button.outline]}
            onPress={onRemovePin}
            accessibilityRole="button"
            accessibilityLabel={`Remove pin for ${location.name}`}
          >
            <Text style={commonStyles.button.text}>Remove pin</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    ...commonStyles.text.h3,
    flex: 1,
    marginRight: spacing.md,
  },
  closeIcon: {
    color: colors.text.secondary,
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    ...commonStyles.text.body,
    marginBottom: spacing.base,
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    ...commonStyles.button.base,
  },
});
