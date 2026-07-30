import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { EventsTimelineScreen } from '@screens/events/EventsListScreen';
import { describeListScreenContract } from '../../helpers/screenContracts';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeEvent } from '../../helpers/factories';
import {
  installNavigationMock,
  resetNavigationMocks,
  getLastHeaderRight,
} from '../../helpers/navigation';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();

describeListScreenContract({
  name: 'EventsTimelineScreen',
  renderScreen: () => render(<EventsTimelineScreen />),
  emptyStateTitle: 'No events found',
  searchPlaceholder: 'Search events...',
  loadFns: () => [
    storage.loadEvents,
    storage.loadCharacters,
    storage.loadLocations,
    storage.loadFactions,
  ],
  primePopulated: () => {
    storage.loadEvents.mockResolvedValue([
      makeEvent({ title: 'The Great Fire' }),
    ]);
  },
  populatedTexts: ['The Great Fire'],
});

describe('EventsTimelineScreen — header actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('navigates to the create form from the header add button', async () => {
    const nav = installNavigationMock();
    render(<EventsTimelineScreen />);

    await waitFor(() => {
      expect(nav.setOptions).toHaveBeenCalled();
    });
    const header = render(getLastHeaderRight(nav));

    fireEvent.press(header.getByText('+'));
    expect(nav.navigate).toHaveBeenCalledWith('EventsForm', {});
  });

  it('opens the generic advanced search screen with certainty/location/character/faction fields', async () => {
    const nav = installNavigationMock();
    storage.loadEvents.mockResolvedValue([
      makeEvent({ id: 'e1', title: 'The Great Fire' }),
    ]);
    const screen = render(<EventsTimelineScreen />);

    await waitFor(() => expect(screen.getByText('Filters')).toBeTruthy());
    fireEvent.press(screen.getByText('Filters'));

    expect(nav.navigate).toHaveBeenCalledWith(
      'AdvancedSearch',
      expect.objectContaining({
        title: 'Search Events',
        fields: expect.arrayContaining([
          expect.objectContaining({ key: 'certainty' }),
          expect.objectContaining({ key: 'location' }),
          expect.objectContaining({ key: 'character' }),
          expect.objectContaining({ key: 'faction' }),
        ]),
      })
    );
  });

  it('narrows the list when advanced filters are applied', async () => {
    const nav = installNavigationMock();
    storage.loadEvents.mockResolvedValue([
      makeEvent({
        id: 'e1',
        title: 'The Great Fire',
        certaintyLevel: 'confirmed',
      }),
      makeEvent({
        id: 'e2',
        title: 'The Rumored Sighting',
        certaintyLevel: 'unconfirmed',
      }),
    ]);
    const screen = render(<EventsTimelineScreen />);

    await waitFor(() =>
      expect(screen.getByText('The Great Fire')).toBeTruthy()
    );
    expect(screen.getByText('The Rumored Sighting')).toBeTruthy();

    fireEvent.press(screen.getByText('Filters'));

    const onApply = nav.navigate.mock.calls.find(
      call => call[0] === 'AdvancedSearch'
    )?.[1].onApply as (values: Record<string, unknown>) => void;

    act(() => onApply({ certainty: 'unconfirmed' }));

    await waitFor(() => {
      expect(screen.queryByText('The Great Fire')).toBeNull();
      expect(screen.getByText('The Rumored Sighting')).toBeTruthy();
    });
  });
});
