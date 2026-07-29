import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { commonStyles } from '@/styles/commonStyles';
import type {
  DataStore,
  DataStoreAction,
  DataStoreContext,
} from '@/datastores/types';

/**
 * The default rendering for a data store: a heading, a sentence, and one
 * button per declared action.
 *
 * A store only reaches for its own `Section` when it needs more than this —
 * see `datastores/github/GitHubSection.tsx`. Everything here is driven off the
 * store's declaration, so a consumer-authored store gets the engine's look
 * without shipping any UI of its own.
 */

interface DataStoreSectionProps {
  store: DataStore;
  ctx: DataStoreContext;
  showProgress: (message: string) => void;
  hideProgress: () => void;
}

const variantStyle = (action: DataStoreAction) => {
  switch (action.variant) {
    case 'secondary':
      return commonStyles.button.secondary;
    case 'warning':
      return commonStyles.button.warning;
    case 'danger':
      return commonStyles.button.danger;
    default:
      return commonStyles.button.primary;
  }
};

export const DataStoreSection: React.FC<DataStoreSectionProps> = ({
  store,
  ctx,
  showProgress,
  hideProgress,
}) => {
  const runAction = async (action: DataStoreAction) => {
    showProgress(action.progressMessage);
    try {
      const result = await action.run(ctx);
      hideProgress();

      // `handled` means the action already spoke for itself — a cancelled
      // picker, or a store that ran its own dialog to completion.
      if (result.handled) {
        return;
      }
      if (result.success && result.message) {
        Alert.alert('Success', result.message, [{ text: 'OK' }]);
      } else if (!result.success) {
        Alert.alert('Failed', result.error || 'An unexpected error occurred.', [
          { text: 'OK' },
        ]);
      }
    } catch (error) {
      hideProgress();
      Alert.alert(
        'Failed',
        `An unexpected error occurred: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{store.label}</Text>
      {!!store.description && (
        <Text style={styles.sectionDescription}>{store.description}</Text>
      )}

      {(store.actions ?? []).map(action => (
        <TouchableOpacity
          key={action.id}
          style={[styles.actionButton, variantStyle(action), styles.spaced]}
          onPress={() => runAction(action)}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  section: commonStyles.layout.section,
  sectionTitle: commonStyles.text.h2,
  sectionDescription: {
    ...commonStyles.text.description,
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButton: commonStyles.button.base,
  spaced: {
    marginBottom: 12,
  },
  buttonText: commonStyles.button.text,
});
