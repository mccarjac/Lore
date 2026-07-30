import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { DataManagementScreen } from '@screens/DataManagementScreen';
import * as characterStorage from '@utils/characterStorage';
import * as gitIntegration from '@utils/gitIntegration';
import { configureLore, resetLoreConfig } from '@/activeRuleset';
import { jsonDataStore } from '@/datastores/json';
import { githubDataStore } from '@/datastores/github';
import type { DataStore } from '@/datastores/types';
import { spyOnAlert, pressAlertButton } from '../helpers/alertAndPlatform';
import { renderWithRuleset } from '../helpers/ruleset';
import { genericRuleset } from '../fixtures/genericRuleset';

jest.mock('@utils/characterStorage');
// githubDataStore reaches gitIntegration → the real @octokit/rest, whose
// transitive `universal-user-agent` dependency ships ESM outside
// transformIgnorePatterns.
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('@utils/gitIntegration');
jest.mock('@utils/discordStorage');

const storage = jest.mocked(characterStorage);

/**
 * The screen is a host for registered stores now, so these tests are about
 * *which* stores render and how a generic one is driven — the GitHub flow has
 * its own suite (`tst/datastores/GitHubSection.test.tsx`).
 */
describe('DataManagementScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyOnAlert();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // A registry left configured would leak into the next suite, same rule as
    // the ruleset itself.
    resetLoreConfig();
  });

  it('renders the default stores when nothing is registered', () => {
    const { getByText, queryByText } = render(<DataManagementScreen />);

    expect(getByText('JSON Data Management')).toBeTruthy();
    expect(getByText('Export Game Data')).toBeTruthy();
    expect(getByText('Import & Replace')).toBeTruthy();
    expect(getByText('Merge Data')).toBeTruthy();
    // The PDF wiki is default-on too (#28), and export-only — one button.
    expect(getByText('Campaign Wiki')).toBeTruthy();
    expect(getByText('Export Campaign PDF')).toBeTruthy();
    // GitHub still needs a token and a repository, so it stays opt-in.
    expect(queryByText('GitHub Repository Sync')).toBeNull();
  });

  it('renders a registered store that supplies its own Section', async () => {
    jest.mocked(gitIntegration).getGitHubConfig.mockResolvedValue({});
    configureLore({
      ruleset: genericRuleset,
      dataStores: [jsonDataStore, githubDataStore],
    });

    const { getByText } = render(<DataManagementScreen />);

    await waitFor(() => {
      expect(getByText('JSON Data Management')).toBeTruthy();
      expect(getByText('GitHub Repository Sync')).toBeTruthy();
    });
  });

  it('leaves only the Danger Zone when a consumer disables every store', () => {
    configureLore({ ruleset: genericRuleset, dataStores: [] });

    const { getByText, queryByText } = render(<DataManagementScreen />);

    expect(queryByText('JSON Data Management')).toBeNull();
    expect(queryByText('Campaign Wiki')).toBeNull();
    expect(queryByText('GitHub Repository Sync')).toBeNull();
    // Clearing data is the engine's, not a store's.
    expect(getByText('Danger Zone')).toBeTruthy();
  });

  it('renders a consumer-authored store from its declaration alone', async () => {
    const run = jest
      .fn()
      .mockResolvedValue({ success: true, message: 'Pushed to the vault.' });
    const customStore: DataStore = {
      id: 'vault',
      label: 'Vault Backend',
      description: 'A backend the engine knows nothing about.',
      actions: [
        {
          id: 'push',
          label: 'Push to Vault',
          progressMessage: 'Pushing...',
          run,
        },
      ],
    };
    configureLore({ ruleset: genericRuleset, dataStores: [customStore] });

    const { getByText } = render(<DataManagementScreen />);

    expect(getByText('Vault Backend')).toBeTruthy();
    expect(getByText('A backend the engine knows nothing about.')).toBeTruthy();

    fireEvent.press(getByText('Push to Vault'));

    await waitFor(() => {
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({ ruleset: genericRuleset })
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Success',
        'Pushed to the vault.',
        expect.any(Array)
      );
    });
  });

  it('stays quiet when an action reports it handled its own UI', async () => {
    const customStore: DataStore = {
      id: 'quiet',
      label: 'Quiet Backend',
      actions: [
        {
          id: 'pick',
          label: 'Pick a File',
          progressMessage: 'Picking...',
          run: jest.fn().mockResolvedValue({ success: false, handled: true }),
        },
      ],
    };
    configureLore({ ruleset: genericRuleset, dataStores: [customStore] });

    const { getByText } = render(<DataManagementScreen />);
    fireEvent.press(getByText('Pick a File'));

    // A cancelled picker is not an error, and must not raise an alert.
    await waitFor(() => expect(alertSpy).not.toHaveBeenCalled());
  });

  it('surfaces an action failure as an alert', async () => {
    const customStore: DataStore = {
      id: 'broken',
      label: 'Broken Backend',
      actions: [
        {
          id: 'push',
          label: 'Push',
          progressMessage: 'Pushing...',
          run: jest
            .fn()
            .mockResolvedValue({ success: false, error: 'The vault is shut.' }),
        },
      ],
    };
    configureLore({ ruleset: genericRuleset, dataStores: [customStore] });

    const { getByText } = render(<DataManagementScreen />);
    fireEvent.press(getByText('Push'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed',
        'The vault is shut.',
        expect.any(Array)
      );
    });
  });

  it('hands each action the ruleset from the provider', async () => {
    const run = jest.fn().mockResolvedValue({ success: true });
    configureLore({
      ruleset: genericRuleset,
      dataStores: [
        {
          id: 'probe',
          label: 'Probe',
          actions: [
            {
              id: 'go',
              label: 'Go',
              progressMessage: 'Going...',
              run,
            },
          ],
        },
      ],
    });

    const { getByText } = renderWithRuleset(<DataManagementScreen />, {
      ruleset: genericRuleset,
    });
    fireEvent.press(getByText('Go'));

    await waitFor(() => {
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({ ruleset: genericRuleset })
      );
    });
  });

  it('clears all game data after confirmation', async () => {
    const { getByText } = render(<DataManagementScreen />);

    fireEvent.press(getByText('Clear All Data'));
    await pressAlertButton(alertSpy, 'Delete All');

    await waitFor(() => {
      expect(storage.clearStorage).toHaveBeenCalled();
    });
  });
});
