import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { LocationFormScreen } from '@screens/location/LocationFormScreen';
import { describeFormScreenContract } from '../../helpers/screenContracts';
import { getStorageMock } from '../../helpers/storage';
import { makeLocation } from '../../helpers/factories';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();
const existingLocation = makeLocation({ id: 'loc-1', name: 'Old Docks' });

describeFormScreenContract({
  name: 'LocationFormScreen',
  renderScreen: () => render(<LocationFormScreen />),
  requiredFieldPlaceholder: 'Enter location name',
  requiredFieldValue: 'The Docks',
  validationErrorText: 'Location name is required',
  submitLabels: { create: 'Create Location', update: 'Update Location' },
  createFn: () => storage.createLocation,
  updateFn: () => storage.updateLocation,
  primeCreate: () => {
    storage.createLocation.mockResolvedValue(makeLocation());
  },
  edit: {
    routeParams: { location: existingLocation },
    prime: () => {
      storage.updateLocation.mockResolvedValue(existingLocation);
    },
    prefilledValue: 'Old Docks',
  },
});

describe('LocationFormScreen — map image section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides the map image section when the ruleset has the map feature off', () => {
    const { queryByText } = renderWithRuleset(<LocationFormScreen />, {
      ruleset: genericRuleset,
    });

    expect(queryByText('Add Map Image')).toBeNull();
  });

  it('picks a map image and includes it when creating a location', async () => {
    (
      ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
    ).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked-map.jpg' }],
    });
    storage.createLocation.mockResolvedValue(makeLocation());

    const { getByText, getByPlaceholderText } = render(<LocationFormScreen />);

    fireEvent.press(getByText('Add Map Image'));
    await waitFor(() => expect(getByText('Replace Map Image')).toBeTruthy());

    fireEvent.changeText(
      getByPlaceholderText('Enter location name'),
      'Portland 2026'
    );
    fireEvent.press(getByText('Create Location'));

    await waitFor(() => {
      expect(storage.createLocation).toHaveBeenCalledWith(
        expect.objectContaining({ mapImageUri: 'file:///picked-map.jpg' })
      );
    });
  });

  it('removes a picked map image', async () => {
    (
      ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
    ).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked-map.jpg' }],
    });

    const { getByText, queryByText } = render(<LocationFormScreen />);

    fireEvent.press(getByText('Add Map Image'));
    await waitFor(() => expect(getByText('Replace Map Image')).toBeTruthy());

    fireEvent.press(getByText('×'));

    expect(queryByText('Replace Map Image')).toBeNull();
    expect(getByText('Add Map Image')).toBeTruthy();
  });
});
