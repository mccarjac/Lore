import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { LocationListScreen } from '@screens/location/LocationListScreen';
import { describeListScreenContract } from '../../helpers/screenContracts';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeLocation, makeCharacter } from '../../helpers/factories';
import {
  installNavigationMock,
  resetNavigationMocks,
  getLastHeaderRight,
} from '../../helpers/navigation';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();

describeListScreenContract({
  name: 'LocationListScreen',
  renderScreen: () => render(<LocationListScreen />),
  emptyStateTitle: 'No locations found',
  searchPlaceholder: 'Search locations by name...',
  loadFns: () => [storage.loadCharacters, storage.loadLocations],
  primePopulated: () => {
    storage.loadLocations.mockResolvedValue([
      makeLocation({ name: 'The Docks' }),
    ]);
  },
  populatedTexts: ['The Docks'],
});

describe('LocationListScreen — header actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('navigates to the map and the create form from the header buttons', async () => {
    const nav = installNavigationMock();
    // The 🗺️ button is gated on `useFeature('map')`, so the ruleset has to
    // be one that enables it rather than whatever the build defaults to.
    renderWithRuleset(<LocationListScreen />, {
      ruleset: {
        ...genericRuleset,
        features: { ...genericRuleset.features, map: true },
      },
    });

    await waitFor(() => {
      expect(nav.setOptions).toHaveBeenCalled();
    });
    const header = render(getLastHeaderRight(nav));

    fireEvent.press(header.getByText('🗺️'));
    expect(nav.navigate).toHaveBeenCalledWith('LocationMap');

    fireEvent.press(header.getByText('+'));
    expect(nav.navigate).toHaveBeenCalledWith('LocationForm', {});
  });

  it('narrows the list by occupancy when advanced filters are applied', async () => {
    const nav = installNavigationMock();
    storage.loadLocations.mockResolvedValue([
      makeLocation({ id: 'loc-1', name: 'The Docks' }),
      makeLocation({ id: 'loc-2', name: 'The Vault' }),
    ]);
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({ id: 'c1', locationId: 'loc-1', present: true }),
    ]);
    const screen = render(<LocationListScreen />);

    await waitFor(() => expect(screen.getByText('The Docks')).toBeTruthy());
    expect(screen.getByText('The Vault')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Advanced search'));

    expect(nav.navigate).toHaveBeenCalledWith(
      'AdvancedSearch',
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ key: 'occupancy' }),
        ]),
      })
    );

    const onApply = nav.navigate.mock.calls.find(
      call => call[0] === 'AdvancedSearch'
    )?.[1].onApply as (values: Record<string, unknown>) => void;

    act(() => onApply({ occupancy: 'occupied' }));

    await waitFor(() => {
      expect(screen.queryByText('The Vault')).toBeNull();
      expect(screen.getByText('The Docks')).toBeTruthy();
    });
  });
});
