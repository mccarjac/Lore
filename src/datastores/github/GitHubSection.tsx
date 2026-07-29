import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  applyGitHubSyncPlan,
  computeGitHubSyncPlan,
  exportToGitHub,
  importFromGitHub,
  verifyGitHubToken,
  saveGitHubConfig,
  getGitHubConfig,
  DATA_REPO_SLUG,
} from '@utils/gitIntegration';
import type { ConflictResolution, SyncPlan } from '@utils/syncMerge';
import { colors as themeColors } from '@/styles/theme';
import { commonStyles } from '@/styles/commonStyles';
import { SyncConflictModal } from '@components/common/SyncConflictModal';
import type { DataStoreSectionProps } from '../types';

/**
 * The GitHub store's own UI.
 *
 * This is why `DataStore.Section` exists: the flow is a token dialog, a
 * configured/unconfigured split, a last-synced line, a
 * remote-moved-during-export branch, and a three-way conflict modal. Expressed
 * as generic `actions` it would need every one of those as a new field on the
 * plugin contract, each of which no other store would ever set.
 *
 * The progress modal is *not* here — it belongs to `DataManagementScreen` and
 * arrives on props, so a screen showing several stores has one spinner rather
 * than one per section.
 */

interface PendingSyncPlan {
  plan: SyncPlan;
  remoteCommitSha: string;
}

export const GitHubSection: React.FC<DataStoreSectionProps> = ({
  ctx,
  showProgress,
  hideProgress,
}) => {
  const [configured, setConfigured] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<string | undefined>(undefined);
  const [tokenDialogVisible, setTokenDialogVisible] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [tokenValidating, setTokenValidating] = useState<boolean>(false);
  const [pendingSyncPlan, setPendingSyncPlan] =
    useState<PendingSyncPlan | null>(null);

  React.useEffect(() => {
    const checkConfig = async () => {
      const config = await getGitHubConfig();
      setConfigured(!!config.token);
      setLastSync(config.sync?.pulledAt || config.lastSync);
    };
    checkConfig();
  }, []);

  const handleSetup = () => {
    setTokenInput('');
    setTokenDialogVisible(true);
  };

  const handleTokenSave = async () => {
    if (!tokenInput.trim()) {
      Alert.alert('Error', 'Please enter a valid token.', [{ text: 'OK' }]);
      return;
    }

    setTokenValidating(true);
    const { valid, error } = await verifyGitHubToken(tokenInput.trim());

    if (valid) {
      const config = await getGitHubConfig();
      await saveGitHubConfig({ ...config, token: tokenInput.trim() });
      setTokenValidating(false);
      setTokenDialogVisible(false);
      setConfigured(true);
      Alert.alert('Success', 'GitHub token saved successfully!', [
        { text: 'OK' },
      ]);
    } else {
      setTokenValidating(false);
      Alert.alert(
        error?.kind === 'offline' ? 'Offline' : 'Invalid Token',
        error?.message ||
          'The token you entered is invalid. Please check and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleTokenCancel = () => {
    setTokenInput('');
    setTokenDialogVisible(false);
  };

  const requireToken = (): boolean => {
    if (configured) {
      return true;
    }
    Alert.alert(
      'GitHub Not Configured',
      'Please set up your GitHub token first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set Up', onPress: handleSetup },
      ]
    );
    return false;
  };

  const applyResolvedSync = async (
    plan: SyncPlan,
    resolutions: Record<string, ConflictResolution>,
    remoteCommitSha: string
  ) => {
    showProgress('Applying merge...');
    const applied = await applyGitHubSyncPlan(
      plan,
      resolutions,
      remoteCommitSha
    );
    hideProgress();

    if (applied.success) {
      const config = await getGitHubConfig();
      setLastSync(config.sync?.pulledAt || config.lastSync);
      Alert.alert(
        'Sync Successful',
        'Your local data has been merged with the GitHub repository.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Sync Failed',
        applied.error || 'An unexpected error occurred',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMerge = async () => {
    if (!requireToken()) {
      return;
    }

    showProgress('Syncing from GitHub...');
    const result = await computeGitHubSyncPlan();
    hideProgress();

    if (!result.success || !result.plan || !result.remoteCommitSha) {
      Alert.alert(
        'Sync Failed',
        result.error || 'An unexpected error occurred',
        [{ text: 'OK' }]
      );
      return;
    }

    if (result.plan.conflicts.length === 0) {
      await applyResolvedSync(result.plan, {}, result.remoteCommitSha);
      return;
    }

    setPendingSyncPlan({
      plan: result.plan,
      remoteCommitSha: result.remoteCommitSha,
    });
  };

  const handleResolveConflicts = async (
    resolutions: Record<string, ConflictResolution>
  ) => {
    if (!pendingSyncPlan) {
      return;
    }
    const { plan, remoteCommitSha } = pendingSyncPlan;
    setPendingSyncPlan(null);
    await applyResolvedSync(plan, resolutions, remoteCommitSha);
  };

  const handleCancelConflicts = () => {
    setPendingSyncPlan(null);
  };

  const runExport = async (force: boolean) => {
    showProgress('Exporting to GitHub...');
    try {
      const result = await exportToGitHub({ force, ruleset: ctx.ruleset });
      hideProgress();

      if (result.success && result.prUrl) {
        Alert.alert(
          'Export Successful',
          `A pull request has been created with your data. You can review it at:\n\n${result.prUrl}`,
          [{ text: 'OK' }]
        );
      } else if (result.remoteMoved) {
        Alert.alert(
          'Repository Has Changed',
          result.error || 'The repository has changed since your last sync.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sync First', onPress: () => handleMerge() },
            { text: 'Export Anyway', onPress: () => runExport(true) },
          ]
        );
      } else {
        Alert.alert(
          'Export Failed',
          result.error || 'An unexpected error occurred',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      hideProgress();
      Alert.alert(
        'Export Failed',
        `An unexpected error occurred during export: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleExport = async () => {
    if (!requireToken()) {
      return;
    }
    await runExport(false);
  };

  const performImport = async () => {
    showProgress('Importing from GitHub...');
    try {
      const result = await importFromGitHub();

      if (result.success && result.data) {
        const imported = await ctx.importDataset(result.data);
        hideProgress();

        if (imported) {
          Alert.alert(
            'Import Successful',
            'Data has been imported from the GitHub repository.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Import Failed',
            'Failed to import the data. Please check the file format.',
            [{ text: 'OK' }]
          );
        }
      } else {
        hideProgress();
        Alert.alert(
          'Import Failed',
          result.error || 'An unexpected error occurred',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      hideProgress();
      Alert.alert(
        'Import Failed',
        `An unexpected error occurred during import: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleImport = () => {
    if (!requireToken()) {
      return;
    }

    Alert.alert(
      'Replace Local Data?',
      'This overwrites your local characters, factions, events, and quests with the version from GitHub. Any local edits not yet exported will be lost. Use "Sync from GitHub (Merge)" instead to keep your local changes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => performImport(),
        },
      ]
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>GitHub Repository Sync</Text>
      <Text style={styles.sectionDescription}>
        Share data with other users through the {DATA_REPO_SLUG} GitHub
        repository. Exports create pull requests for review.
      </Text>
      {configured && (
        <Text style={styles.syncStatusText}>
          {lastSync
            ? `Last synced: ${new Date(lastSync).toLocaleString()}`
            : 'Never synced'}
        </Text>
      )}

      {!configured && (
        <TouchableOpacity
          style={[styles.actionButton, styles.setupButton]}
          onPress={handleSetup}
        >
          <Text style={styles.buttonText}>Set Up GitHub Token</Text>
        </TouchableOpacity>
      )}

      {configured && (
        <>
          <TouchableOpacity
            style={[styles.actionButton, styles.gitMergeButton]}
            onPress={handleMerge}
          >
            <Text style={styles.buttonText}>Sync from GitHub (Merge)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.gitExportButton]}
            onPress={handleExport}
          >
            <Text style={styles.buttonText}>Export to GitHub (Create PR)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.gitImportButton]}
            onPress={handleImport}
          >
            <Text style={styles.buttonText}>Import from GitHub (Replace)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.setupButton]}
            onPress={handleSetup}
          >
            <Text style={styles.buttonText}>Update GitHub Token</Text>
          </TouchableOpacity>
        </>
      )}

      <Modal
        visible={tokenDialogVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tokenModalContent}>
            <Text style={styles.modalTitle}>GitHub Personal Access Token</Text>
            <Text style={styles.tokenModalDescription}>
              Enter your GitHub Personal Access Token with repo permissions. You
              can create one at:
            </Text>
            <Text style={styles.tokenModalLink}>
              https://github.com/settings/tokens
            </Text>

            <TextInput
              style={styles.tokenInput}
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor={themeColors.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={true}
              editable={!tokenValidating}
            />

            {tokenValidating && (
              <ActivityIndicator
                size="small"
                color={themeColors.accent.primary}
                style={styles.tokenValidatingSpinner}
              />
            )}

            <View style={styles.tokenModalButtons}>
              <TouchableOpacity
                style={[styles.tokenModalButton, styles.tokenModalCancelButton]}
                onPress={handleTokenCancel}
                disabled={tokenValidating}
              >
                <Text style={styles.tokenModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tokenModalButton, styles.tokenModalSaveButton]}
                onPress={handleTokenSave}
                disabled={tokenValidating}
              >
                <Text style={styles.tokenModalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SyncConflictModal
        visible={!!pendingSyncPlan}
        conflicts={pendingSyncPlan?.plan.conflicts || []}
        onResolve={handleResolveConflicts}
        onCancel={handleCancelConflicts}
      />
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
  syncStatusText: {
    ...commonStyles.text.body,
    color: themeColors.text.muted,
    marginBottom: 12,
  },
  actionButton: commonStyles.button.base,
  setupButton: {
    backgroundColor: themeColors.elevated,
    borderColor: themeColors.accent.secondary,
    marginBottom: 12,
  },
  gitMergeButton: {
    backgroundColor: themeColors.accent.primary,
    marginBottom: 12,
  },
  gitExportButton: {
    backgroundColor: themeColors.accent.success,
    marginBottom: 12,
  },
  gitImportButton: {
    backgroundColor: themeColors.accent.info,
    marginBottom: 12,
  },
  buttonText: commonStyles.button.text,
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenModalContent: {
    backgroundColor: themeColors.surface,
    borderRadius: 16,
    padding: 24,
    minWidth: 320,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  modalTitle: {
    ...commonStyles.text.h3,
    marginBottom: 12,
    textAlign: 'center',
  },
  tokenModalDescription: {
    ...commonStyles.text.body,
    marginBottom: 8,
    textAlign: 'center',
    color: themeColors.text.secondary,
    lineHeight: 20,
  },
  tokenModalLink: {
    ...commonStyles.text.body,
    marginBottom: 20,
    textAlign: 'center',
    color: themeColors.accent.info,
    fontSize: 12,
  },
  tokenInput: {
    backgroundColor: themeColors.elevated,
    borderColor: themeColors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: themeColors.text.primary,
    marginBottom: 16,
    width: '100%',
  },
  tokenValidatingSpinner: {
    marginBottom: 16,
  },
  tokenModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  tokenModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenModalCancelButton: {
    backgroundColor: themeColors.elevated,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  tokenModalSaveButton: {
    backgroundColor: themeColors.accent.primary,
  },
  tokenModalButtonText: {
    ...commonStyles.text.body,
    fontWeight: '600',
    color: themeColors.text.primary,
  },
});
