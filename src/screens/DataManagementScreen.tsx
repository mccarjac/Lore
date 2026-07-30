import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Text,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { clearStorage } from '@utils/characterStorage';
import { clearDiscordData } from '@/utils/discordStorage';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import { DataStoreSection } from '@components/common/DataStoreSection';
import { AutoSyncToggle } from '@components/common/AutoSyncToggle';
import { getActiveDataStores } from '@/datastores/registry';
import { createDataStoreContext } from '@/datastores/context';
import { autoSyncController } from '@/datastores/autoSync/controller';
import { setAutoSyncEnabled } from '@utils/autoSyncPreferences';
import { useRuleset } from '@/ruleset';

/**
 * Data Management is a *host* for whatever data stores this build registered
 * (#29), plus the Danger Zone the engine owns.
 *
 * It knows nothing about zip files or GitHub any more: a store either declares
 * `actions` and gets `DataStoreSection`'s rendering, or supplies its own
 * `Section`. The progress modal stays here so a build with several stores has
 * one spinner rather than one per section.
 */
export const DataManagementScreen: React.FC = () => {
  const [progress, setProgress] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: '' });

  const stores = getActiveDataStores();
  // Built from the *provider's* ruleset, not the module registry: a store's
  // export names the ruleset the data came from, and a test (or a consumer)
  // may render this screen under a different provider than the active one.
  const { ruleset } = useRuleset();
  const ctx = useMemo(() => createDataStoreContext(ruleset), [ruleset]);
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: commonStyles.layout.container,
        scrollView: commonStyles.layout.scrollView,
        contentContainer: commonStyles.layout.contentContainer,
        header: commonStyles.text.h1,
        description: {
          ...commonStyles.text.bodyLarge,
          marginBottom: 32,
          lineHeight: 24,
        },
        section: commonStyles.layout.section,
        dangerSection: commonStyles.layout.sectionDanger,
        sectionTitle: commonStyles.text.h2,
        dangerTitle: {
          ...commonStyles.text.h2,
          color: themeColors.accent.danger,
        },
        sectionDescription: {
          ...commonStyles.text.description,
          marginBottom: 16,
          lineHeight: 20,
        },
        actionButton: commonStyles.button.base,
        clearButton: commonStyles.button.danger,
        buttonText: commonStyles.button.text,
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        modalContent: {
          backgroundColor: themeColors.surface,
          borderRadius: 16,
          padding: 32,
          alignItems: 'center',
          minWidth: 280,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        modalText: {
          ...commonStyles.text.h3,
          marginTop: 16,
          textAlign: 'center',
        },
        modalSubText: {
          ...commonStyles.text.body,
          marginTop: 8,
          textAlign: 'center',
          color: themeColors.text.muted,
        },
      }),
    [commonStyles, themeColors]
  );

  const showProgress = (message: string) =>
    setProgress({ visible: true, message });
  const hideProgress = () => setProgress({ visible: false, message: '' });

  const handleClearAll = async () => {
    const hasAutoSyncStore = stores.some(store => store.autoSync);
    const confirmMessage = hasAutoSyncStore
      ? 'Are you sure you want to delete all game data? This action cannot be undone. Automatic sync will be turned off.'
      : 'Are you sure you want to delete all game data? This action cannot be undone.';

    const confirmClear = () => {
      if (Platform.OS === 'web') {
        return window.confirm(confirmMessage);
      } else {
        return new Promise<boolean>(resolve => {
          Alert.alert('Clear All Data', confirmMessage, [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Delete All',
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ]);
        });
      }
    };

    const shouldClear = await confirmClear();
    if (shouldClear) {
      // `clearStorage()` does not (and should not) touch a store's own merge
      // base — the two are unrelated concepts. But that means an auto-sync
      // store left enabled would see every record as "deleted locally" on
      // its next tick and, since deletions propagate, push that wipe out to
      // everyone else. Turn auto-sync off for every capable store first, so
      // a Danger Zone tap on this device stays local.
      await Promise.all(
        stores
          .filter(store => store.autoSync)
          .map(store => setAutoSyncEnabled(store.id, false))
      );
      await autoSyncController.refreshPreferences();

      await clearStorage();
      await clearDiscordData();
      Alert.alert(
        'Success',
        'All game data has been deleted. Automatic sync was turned off for safety — re-enable it once you have a data set you want to share again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.header}>Data Management</Text>
        <Text style={styles.description}>
          Manage your game data with import, export, merge, and backup options.
        </Text>

        {stores.map(store => (
          <React.Fragment key={store.id}>
            {store.Section ? (
              <store.Section
                ctx={ctx}
                showProgress={showProgress}
                hideProgress={hideProgress}
              />
            ) : (
              <DataStoreSection
                store={store}
                ctx={ctx}
                showProgress={showProgress}
                hideProgress={hideProgress}
              />
            )}
            {store.autoSync && <AutoSyncToggle store={store} ctx={ctx} />}
          </React.Fragment>
        ))}

        {/* Danger Zone */}
        <View style={[styles.section, styles.dangerSection]}>
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>
            Danger Zone
          </Text>
          <Text style={styles.sectionDescription}>
            Irreversible actions that will permanently delete your data.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton]}
            onPress={handleClearAll}
          >
            <Text style={styles.buttonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Progress Modal */}
      <Modal
        visible={progress.visible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator
              size="large"
              color={themeColors.accent.primary}
            />
            <Text style={styles.modalText}>{progress.message}</Text>
            <Text style={styles.modalSubText}>Please wait...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};
