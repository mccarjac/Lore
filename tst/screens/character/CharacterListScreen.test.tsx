import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { CharacterListScreen } from '@screens/character/CharacterListScreen';
import { RelationshipStanding } from '@models/types';
import { describeListScreenContract } from '../../helpers/screenContracts';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeCharacter } from '../../helpers/factories';
import {
  installNavigationMock,
  resetNavigationMocks,
  getLastHeaderRight,
} from '../../helpers/navigation';
import { spyOnAlert, pressAlertButton } from '../../helpers/alertAndPlatform';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();

describeListScreenContract({
  name: 'CharacterListScreen',
  renderScreen: () => render(<CharacterListScreen />),
  emptyStateTitle: 'No characters found',
  searchPlaceholder: 'Search characters by name...',
  loadFns: () => [storage.loadCharacters],
  primePopulated: () => {
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Alice',
        present: true,
        factions: [
          { name: 'Iron Legion', standing: RelationshipStanding.Ally },
        ],
      }),
      makeCharacter({ id: 'char-2', name: 'Bob' }),
    ]);
  },
  populatedTexts: [
    'Alice',
    'Present',
    'Iron Legion',
    'Bob',
    'Absent',
    'No factions',
  ],
});

describe('CharacterListScreen — header menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('navigates to CharacterStats from the Statistics menu section', async () => {
    const nav = installNavigationMock();
    render(<CharacterListScreen />);

    await waitFor(() => expect(nav.setOptions).toHaveBeenCalled());
    const header = render(getLastHeaderRight(nav));

    fireEvent.press(header.getByLabelText('More options'));
    expect(header.getByText('Statistics')).toBeTruthy();

    fireEvent.press(header.getByText('Character Statistics'));
    expect(nav.navigate).toHaveBeenCalledWith('CharacterStats');
  });
});

describe('CharacterListScreen — quick filters and bulk actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
    jest.restoreAllMocks();
  });

  it('narrows the list to present characters via the Present Only toggle', async () => {
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({ id: 'char-1', name: 'Alice', present: true }),
      makeCharacter({ id: 'char-2', name: 'Bob', present: false }),
    ]);
    const screen = render(<CharacterListScreen />);

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    expect(screen.getByText('Bob')).toBeTruthy();

    fireEvent.press(screen.getByText('Present Only'));

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.queryByText('Bob')).toBeNull();
    });

    fireEvent.press(screen.getByText('Show All'));

    await waitFor(() => expect(screen.getByText('Bob')).toBeTruthy());
  });

  it('resets present status for all characters after confirming', async () => {
    const alertSpy = spyOnAlert();
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({ id: 'char-1', name: 'Alice', present: true }),
    ]);
    storage.resetAllPresentStatus.mockResolvedValue(undefined);
    const screen = render(<CharacterListScreen />);

    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());

    fireEvent.press(screen.getByText('Reset Present'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    await pressAlertButton(alertSpy, 'Reset All');

    await waitFor(() => {
      expect(storage.resetAllPresentStatus).toHaveBeenCalledTimes(1);
    });
  });
});
