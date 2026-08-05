import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { LocationDetailsScreen } from '@screens/location/LocationDetailScreen';
import { describeDetailScreenContract } from '../../helpers/screenContracts';
import { getStorageMock } from '../../helpers/storage';
import { makeLocation } from '../../helpers/factories';
import {
  installNavigationMock,
  installRouteParams,
  resetNavigationMocks,
} from '../../helpers/navigation';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();
const LOCATION_ID = 'location-1';
const location = makeLocation({ id: LOCATION_ID, name: 'The Docks' });

describeDetailScreenContract({
  name: 'LocationDetailsScreen',
  renderScreen: () => render(<LocationDetailsScreen />),
  routeParams: { locationId: LOCATION_ID },
  prime: () => {
    storage.getLocation.mockResolvedValue(location);
  },
  expectedContent: ['The Docks', 'Statistics', 'Total Characters'],
  edit: {
    expectedScreen: 'LocationForm',
    expectedParams: { location },
  },
  del: {
    deleteFn: () => storage.deleteLocationCompletely,
    primeDelete: () => {
      storage.deleteLocationCompletely.mockResolvedValue({
        success: true,
        charactersUpdated: 0,
      });
    },
  },
});

describe('LocationDetailsScreen — View Map visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installRouteParams({ locationId: LOCATION_ID });
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('hides View Map when the ruleset has the map feature off', async () => {
    storage.getLocation.mockResolvedValue(
      makeLocation({
        id: LOCATION_ID,
        name: 'The Docks',
        mapImageUri: 'file:///docks-map.jpg',
      })
    );

    const { queryByText, findByText } = renderWithRuleset(
      <LocationDetailsScreen />,
      { ruleset: genericRuleset }
    );

    await findByText('The Docks');
    expect(queryByText('View Map')).toBeNull();
  });

  it('hides View Map when the location has no map image', async () => {
    storage.getLocation.mockResolvedValue(
      makeLocation({ id: LOCATION_ID, name: 'The Docks' })
    );

    const { queryByText, findByText } = render(<LocationDetailsScreen />);

    await findByText('The Docks');
    expect(queryByText('View Map')).toBeNull();
  });

  it('navigates to LocationMap when pressed', async () => {
    storage.getLocation.mockResolvedValue(
      makeLocation({
        id: LOCATION_ID,
        name: 'The Docks',
        mapImageUri: 'file:///docks-map.jpg',
      })
    );
    const nav = installNavigationMock();

    const { getByText, findByText } = render(<LocationDetailsScreen />);

    await findByText('The Docks');
    fireEvent.press(getByText('View Map'));

    await waitFor(() => {
      expect(nav.navigate).toHaveBeenCalledWith('LocationMap', {
        locationId: LOCATION_ID,
      });
    });
  });
});
