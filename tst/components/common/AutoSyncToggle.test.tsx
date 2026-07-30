import React from 'react';
import { Switch } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AutoSyncToggle } from '@/components/common/AutoSyncToggle';
import { createDataStoreContext } from '@/datastores/context';
import * as autoSyncPreferences from '@utils/autoSyncPreferences';
import {
  autoSyncController,
  resetAutoSyncController,
} from '@/datastores/autoSync/controller';
import { genericRuleset } from '../../fixtures/genericRuleset';
import type { DataStore } from '@/datastores/types';

jest.mock('@utils/autoSyncPreferences');

const prefs = jest.mocked(autoSyncPreferences);

const storeWithAutoSync: DataStore = {
  id: 'github',
  label: 'GitHub',
  autoSync: {
    run: jest.fn(),
    description: 'Keep in sync automatically.',
  },
};

const storeWithoutAutoSync: DataStore = {
  id: 'json',
  label: 'JSON',
};

const ctx = createDataStoreContext(genericRuleset);

describe('AutoSyncToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prefs.setAutoSyncEnabled.mockResolvedValue({ stores: {}, state: {} });
  });

  afterEach(() => {
    resetAutoSyncController();
  });

  it('renders nothing for a store that does not declare autoSync', () => {
    const { toJSON } = render(
      <AutoSyncToggle store={storeWithoutAutoSync} ctx={ctx} />
    );

    expect(toJSON()).toBeNull();
  });

  it('renders the store description and an off status line by default', () => {
    const { getByText } = render(
      <AutoSyncToggle store={storeWithAutoSync} ctx={ctx} />
    );

    expect(getByText('Keep in sync automatically.')).toBeTruthy();
    expect(getByText('Automatic sync is off.')).toBeTruthy();
  });

  it('falls back to a generic description when the store supplies none', () => {
    const store: DataStore = {
      id: 's3',
      label: 'S3',
      autoSync: { run: jest.fn() },
    };

    const { getByText } = render(<AutoSyncToggle store={store} ctx={ctx} />);

    expect(
      getByText('Automatically keep this store in sync in the background.')
    ).toBeTruthy();
  });

  it('persists and refreshes the scheduler when toggled on', async () => {
    const refreshSpy = jest
      .spyOn(autoSyncController, 'refreshPreferences')
      .mockResolvedValue(undefined);
    const { UNSAFE_getAllByType } = render(
      <AutoSyncToggle store={storeWithAutoSync} ctx={ctx} />
    );

    const [toggle] = UNSAFE_getAllByType(Switch);
    fireEvent(toggle, 'valueChange', true);
    await Promise.resolve();
    await Promise.resolve();

    expect(prefs.setAutoSyncEnabled).toHaveBeenCalledWith('github', true);
    expect(refreshSpy).toHaveBeenCalled();
  });
});
