import React from 'react';
import { Image } from 'react-native';
import { fireEvent, waitFor, act } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';
import { LocationMapScreen } from '@screens/location/LocationMapScreen';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeLocation } from '../../helpers/factories';
import {
  installNavigationMock,
  installRouteParams,
  resetNavigationMocks,
} from '../../helpers/navigation';
import { renderWithRuleset } from '../../helpers/ruleset';

jest.mock('@utils/characterStorage');
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-pin-uuid') }));

const storage = getStorageMock();

// Small, well below any real screen size, so the fit-to-screen scale in
// LocationMapScreen never kicks in and imageSize == {300, 200} exactly.
const IMAGE_SIZE = { width: 300, height: 200 };

const mockGetSizeResolves = () =>
  jest
    .spyOn(Image, 'getSize')
    .mockImplementation((_uri, success) =>
      success(IMAGE_SIZE.width, IMAGE_SIZE.height)
    );

const renderMap = (locationId = 'loc-current') => {
  installRouteParams({ locationId });
  return renderWithRuleset(<LocationMapScreen />);
};

const getLatestLongPressStub = () => {
  const results = (Gesture.LongPress as jest.Mock).mock.results;
  return results[results.length - 1].value;
};

// Before the location loads, the screen shows "no map image yet" (not
// "Loading map..."), so waiting only for the loading text to disappear
// resolves immediately — before the image size has actually come back from
// the mocked, synchronous `Image.getSize`. The location load and the size
// lookup each land in their own effect/passive-effect pass, so flush a few
// full act() cycles rather than relying on `waitFor`'s own retry timing to
// catch a render that lands between polls.
const waitForMapImageLoaded = async (
  queryByText: (text: string) => unknown
) => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  expect(queryByText('Loading map...')).toBeNull();
  expect(queryByText('This location has no map image yet.')).toBeNull();
};

describe('LocationMapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('says so when the location has no map image yet', async () => {
    storage.getLocation.mockResolvedValue(
      makeLocation({ id: 'loc-current', name: 'The Vault' })
    );

    const { findByText } = renderMap();

    expect(
      await findByText('This location has no map image yet.')
    ).toBeTruthy();
  });

  it('shows a loading state before the map image size resolves', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation(() => {
      // Never resolves — simulates the size lookup still in flight.
    });
    storage.getLocation.mockResolvedValue(
      makeLocation({
        id: 'loc-current',
        name: 'The Vault',
        mapImageUri: 'test-map-uri',
      })
    );

    const { findByText } = renderMap();

    expect(await findByText('Loading map...')).toBeTruthy();
  });

  it('renders markers only for pins whose target location still exists', async () => {
    mockGetSizeResolves();
    storage.getLocation.mockResolvedValue(
      makeLocation({
        id: 'loc-current',
        name: 'The Vault',
        mapImageUri: 'test-map-uri',
        mapPins: [
          { id: 'pin-1', locationId: 'loc-placed', x: 0.5, y: 0.5 },
          { id: 'pin-2', locationId: 'loc-deleted', x: 0.2, y: 0.2 },
        ],
      })
    );
    storage.loadLocations.mockResolvedValue([
      makeLocation({ id: 'loc-placed', name: 'The Docks' }),
    ]);

    const { getByLabelText, queryByLabelText } = renderMap();

    await waitFor(() => {
      expect(getByLabelText('The Docks')).toBeTruthy();
    });
    expect(queryByLabelText('Rust Alley')).toBeNull();
  });

  it('shows the info card with "View details" when a marker is pressed', async () => {
    mockGetSizeResolves();
    storage.getLocation.mockResolvedValue(
      makeLocation({
        id: 'loc-current',
        name: 'The Vault',
        mapImageUri: 'test-map-uri',
        mapPins: [{ id: 'pin-1', locationId: 'loc-1', x: 0.5, y: 0.5 }],
      })
    );
    storage.loadLocations.mockResolvedValue([
      makeLocation({
        id: 'loc-1',
        name: 'The Docks',
        description: 'A rundown pier.',
      }),
    ]);

    const { getByLabelText, findByText } = renderMap();

    const marker = await waitFor(() => getByLabelText('The Docks'));
    fireEvent.press(marker);

    expect(await findByText('A rundown pier.')).toBeTruthy();
    expect(await findByText('View details')).toBeTruthy();
  });

  it('navigates to LocationDetails with the pinned location id', async () => {
    mockGetSizeResolves();
    storage.getLocation.mockResolvedValue(
      makeLocation({
        id: 'loc-current',
        name: 'The Vault',
        mapImageUri: 'test-map-uri',
        mapPins: [{ id: 'pin-1', locationId: 'loc-1', x: 0.5, y: 0.5 }],
      })
    );
    storage.loadLocations.mockResolvedValue([
      makeLocation({ id: 'loc-1', name: 'The Docks' }),
    ]);
    const nav = installNavigationMock();

    const { getByLabelText, findByText } = renderMap();

    const marker = await waitFor(() => getByLabelText('The Docks'));
    fireEvent.press(marker);

    fireEvent.press(await findByText('View details'));

    expect(nav.navigate).toHaveBeenCalledWith('LocationDetails', {
      locationId: 'loc-1',
    });
  });

  it('shows "View map" only when the pinned location has its own map image, and drills down into it', async () => {
    mockGetSizeResolves();
    storage.getLocation.mockResolvedValue(
      makeLocation({
        id: 'loc-current',
        name: 'The Vault',
        mapImageUri: 'test-map-uri',
        mapPins: [{ id: 'pin-1', locationId: 'loc-1', x: 0.5, y: 0.5 }],
      })
    );
    storage.loadLocations.mockResolvedValue([
      makeLocation({
        id: 'loc-1',
        name: 'The Docks',
        mapImageUri: 'nested-map-uri',
      }),
    ]);
    const nav = installNavigationMock();

    const { getByLabelText, findByText } = renderMap();

    const marker = await waitFor(() => getByLabelText('The Docks'));
    fireEvent.press(marker);

    fireEvent.press(await findByText('View map'));

    expect(nav.navigate).toHaveBeenCalledWith('LocationMap', {
      locationId: 'loc-1',
    });
  });

  it('places a pin at the long-pressed coordinates via the picker', async () => {
    mockGetSizeResolves();
    const current = makeLocation({
      id: 'loc-current',
      name: 'The Vault',
      mapImageUri: 'test-map-uri',
    });
    storage.getLocation.mockResolvedValue(current);
    storage.loadLocations.mockResolvedValue([
      current,
      makeLocation({ id: 'loc-1', name: 'The Docks' }),
    ]);
    storage.updateLocation.mockResolvedValue({
      ...current,
      mapPins: [{ id: 'mock-pin-uuid', locationId: 'loc-1', x: 0.5, y: 0.5 }],
    });

    const { findByText, queryByText } = renderMap();

    // Let the initial loads and the map image size resolve before
    // long-pressing, so the picker has the location to list and the
    // gesture's coordinate math sees the real image dimensions.
    await waitForMapImageLoaded(queryByText);
    const loadCallsBeforePlacement = () =>
      storage.loadLocations.mock.calls.length;
    const callsBeforePlacement = loadCallsBeforePlacement();

    const longPressStub = getLatestLongPressStub();
    act(() => {
      longPressStub.callbacks.onStart({ x: 0, y: 0 });
    });

    fireEvent.press(await findByText('The Docks'));

    await waitFor(() => {
      expect(storage.updateLocation).toHaveBeenCalledWith('loc-current', {
        mapPins: [{ id: 'mock-pin-uuid', locationId: 'loc-1', x: 0.5, y: 0.5 }],
      });
    });
    // Placement reloads the location so the new marker appears.
    await waitFor(() => {
      expect(loadCallsBeforePlacement()).toBeGreaterThan(callsBeforePlacement);
    });
  });

  it('excludes the current location itself from the placement picker', async () => {
    mockGetSizeResolves();
    const current = makeLocation({
      id: 'loc-current',
      name: 'The Vault',
      mapImageUri: 'test-map-uri',
    });
    storage.getLocation.mockResolvedValue(current);
    storage.loadLocations.mockResolvedValue([
      current,
      makeLocation({ id: 'loc-1', name: 'The Docks' }),
    ]);

    const { queryByText, queryByLabelText } = renderMap();

    await waitForMapImageLoaded(queryByText);

    const longPressStub = getLatestLongPressStub();
    act(() => {
      longPressStub.callbacks.onStart({ x: 0, y: 0 });
    });

    await waitFor(() =>
      expect(queryByLabelText('Place The Docks here')).toBeTruthy()
    );
    expect(queryByLabelText('Place The Vault here')).toBeNull();
  });

  it('removes a pin from the info card', async () => {
    mockGetSizeResolves();
    const current = makeLocation({
      id: 'loc-current',
      name: 'The Vault',
      mapImageUri: 'test-map-uri',
      mapPins: [{ id: 'pin-1', locationId: 'loc-1', x: 0.5, y: 0.5 }],
    });
    storage.getLocation.mockResolvedValue(current);
    storage.loadLocations.mockResolvedValue([
      current,
      makeLocation({ id: 'loc-1', name: 'The Docks' }),
    ]);
    storage.updateLocation.mockResolvedValue({ ...current, mapPins: [] });

    const { getByLabelText, findByText } = renderMap();

    const marker = await waitFor(() => getByLabelText('The Docks'));
    fireEvent.press(marker);

    fireEvent.press(await findByText('Remove pin'));

    await waitFor(() => {
      expect(storage.updateLocation).toHaveBeenCalledWith('loc-current', {
        mapPins: [],
      });
    });
  });
});
