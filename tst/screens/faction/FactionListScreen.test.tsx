import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { FactionListScreen } from '@screens/faction/FactionListScreen';
import { RelationshipStanding } from '@models/types';
import { describeListScreenContract } from '../../helpers/screenContracts';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeStoredFaction, makeCharacter } from '../../helpers/factories';
import {
  installNavigationMock,
  resetNavigationMocks,
  getLastHeaderRight,
} from '../../helpers/navigation';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();

describeListScreenContract({
  name: 'FactionListScreen',
  renderScreen: () => render(<FactionListScreen />),
  emptyStateTitle: 'No factions found',
  searchPlaceholder: 'Search factions by name...',
  loadFns: () => [
    storage.migrateFactionDescriptions,
    storage.loadCharacters,
    storage.loadFactions,
  ],
  primePopulated: () => {
    storage.loadFactions.mockResolvedValue([
      makeStoredFaction({ name: 'Iron Legion' }),
    ]);
  },
  populatedTexts: ['Iron Legion'],
});

describe('FactionListScreen — advanced search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('narrows the list by standing when advanced filters are applied', async () => {
    const nav = installNavigationMock();
    storage.loadFactions.mockResolvedValue([
      makeStoredFaction({ name: 'Iron Legion' }),
      makeStoredFaction({ name: 'Void Cult' }),
    ]);
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({
        id: 'c1',
        factions: [
          { name: 'Iron Legion', standing: RelationshipStanding.Ally },
        ],
      }),
    ]);
    const screen = render(<FactionListScreen />);

    await waitFor(() => expect(screen.getByText('Iron Legion')).toBeTruthy());
    expect(screen.getByText('Void Cult')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Advanced search'));

    expect(nav.navigate).toHaveBeenCalledWith(
      'AdvancedSearch',
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ key: 'standing' }),
        ]),
      })
    );

    const onApply = nav.navigate.mock.calls.find(
      call => call[0] === 'AdvancedSearch'
    )?.[1].onApply as (values: Record<string, unknown>) => void;

    act(() => onApply({ standing: RelationshipStanding.Ally }));

    await waitFor(() => {
      expect(screen.queryByText('Void Cult')).toBeNull();
      expect(screen.getByText('Iron Legion')).toBeTruthy();
    });
  });
});

describe('FactionListScreen — header menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('navigates to FactionStats from the Statistics menu section', async () => {
    const nav = installNavigationMock();
    render(<FactionListScreen />);

    await waitFor(() => expect(nav.setOptions).toHaveBeenCalled());
    const header = render(getLastHeaderRight(nav));

    fireEvent.press(header.getByLabelText('More options'));
    expect(header.getByText('Statistics')).toBeTruthy();

    fireEvent.press(header.getByText('Faction Statistics'));
    expect(nav.navigate).toHaveBeenCalledWith('FactionStats');
  });
});
