import React, { useMemo, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import { autoSyncController } from '@/datastores/autoSync/controller';
import { useAutoSyncStatus } from '@/datastores/autoSync/useAutoSyncStatus';
import { setAutoSyncEnabled } from '@utils/autoSyncPreferences';
import type { DataStore, DataStoreContext } from '@/datastores/types';

/**
 * The opt-in toggle and status line for a store's automatic sync (#31).
 *
 * Rendered once per store that declares `autoSync` — see
 * `DataManagementScreen.tsx` — so a consumer-authored store gets a toggle
 * and status line without writing any UI of its own, the same way
 * `DataStoreSection` gives a plain `actions` store its buttons for free.
 */
export interface AutoSyncToggleProps {
  store: DataStore;
  ctx: DataStoreContext;
}

const statusLine = (status: ReturnType<typeof useAutoSyncStatus>): string => {
  if (!status || !status.enabled) {
    return 'Automatic sync is off.';
  }
  if (status.conflictsPending) {
    return `${status.conflictsPending} change${
      status.conflictsPending === 1 ? '' : 's'
    } need your attention — use the sync button above to resolve.`;
  }
  if (status.pausedReason === 'auth') {
    return 'Paused: the token was rejected. Update it and re-enable automatic sync.';
  }
  if (
    status.pausedReason === 'forbidden' ||
    status.pausedReason === 'notFound'
  ) {
    return 'Paused: the repository could not be reached. Check its configuration and re-enable automatic sync.';
  }
  if (status.running) {
    return 'Syncing…';
  }
  if (status.lastOutcome === 'skipped' && status.lastMessage) {
    return status.lastMessage;
  }
  if (status.lastOutcome === 'failed') {
    return status.lastMessage
      ? `${status.lastMessage} Retrying automatically.`
      : 'The last automatic sync failed. Retrying automatically.';
  }
  if (status.lastRunAt) {
    return `Last automatic sync: ${new Date(status.lastRunAt).toLocaleString()}`;
  }
  return 'Waiting for the first automatic sync.';
};

export const AutoSyncToggle: React.FC<AutoSyncToggleProps> = ({ store }) => {
  const status = useAutoSyncStatus(store.id);
  const [enabled, setEnabled] = useState<boolean>(!!status?.enabled);
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: commonStyles.layout.section,
        sectionTitle: commonStyles.text.h2,
        sectionDescription: {
          ...commonStyles.text.description,
          marginBottom: 16,
          lineHeight: 20,
        },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        },
        rowLabel: {
          fontSize: 16,
          color: themeColors.text.primary,
          fontWeight: '500',
        },
        statusText: {
          ...commonStyles.text.body,
          color: themeColors.text.muted,
        },
      }),
    [commonStyles, themeColors]
  );

  if (!store.autoSync) {
    return null;
  }

  const handleToggle = (next: boolean) => {
    setEnabled(next);
    // Persistence failures are non-fatal — the switch reflects intent, and
    // a failed write here would surface as the toggle silently reverting on
    // next mount rather than an error the user can act on.
    setAutoSyncEnabled(store.id, next)
      .then(() => autoSyncController.refreshPreferences())
      .catch(() => {});
  };

  const isOn = status?.enabled ?? enabled;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Automatic Sync</Text>
      <Text style={styles.sectionDescription}>
        {store.autoSync.description ??
          'Automatically keep this store in sync in the background.'}
      </Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Sync automatically</Text>
        <Switch
          value={isOn}
          onValueChange={handleToggle}
          trackColor={{
            false: themeColors.border,
            true: themeColors.accent.primary,
          }}
          thumbColor={themeColors.primary}
        />
      </View>
      <Text style={styles.statusText}>{statusLine(status)}</Text>
    </View>
  );
};
