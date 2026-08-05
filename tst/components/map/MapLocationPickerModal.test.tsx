import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MapLocationPickerModal } from '@components/map/MapLocationPickerModal';
import { makeLocation } from '../../helpers/factories';

describe('MapLocationPickerModal', () => {
  it('lists every saved location', () => {
    const locations = [
      makeLocation({ id: 'loc-1', name: 'The Docks' }),
      makeLocation({ id: 'loc-2', name: 'Rust Alley' }),
    ];

    const { getByText } = render(
      <MapLocationPickerModal
        visible
        locations={locations}
        placedLocationIds={new Set()}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(getByText('The Docks')).toBeTruthy();
    expect(getByText('Rust Alley')).toBeTruthy();
  });

  it('shows a "placed" badge only for locations already in placedLocationIds', () => {
    const locations = [
      makeLocation({ id: 'loc-1', name: 'The Docks' }),
      makeLocation({ id: 'loc-2', name: 'Rust Alley' }),
    ];

    const { getAllByText } = render(
      <MapLocationPickerModal
        visible
        locations={locations}
        placedLocationIds={new Set(['loc-1'])}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(getAllByText('placed')).toHaveLength(1);
  });

  it('shows an empty state when there are no saved locations', () => {
    const { getByText } = render(
      <MapLocationPickerModal
        visible
        locations={[]}
        placedLocationIds={new Set()}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(getByText('No saved locations yet. Create one first.')).toBeTruthy();
  });

  it('calls onSelect with the location id when a row is pressed', () => {
    const locations = [makeLocation({ id: 'loc-1', name: 'The Docks' })];
    const onSelect = jest.fn();

    const { getByText } = render(
      <MapLocationPickerModal
        visible
        locations={locations}
        placedLocationIds={new Set()}
        onSelect={onSelect}
        onCancel={jest.fn()}
      />
    );

    fireEvent.press(getByText('The Docks'));

    expect(onSelect).toHaveBeenCalledWith('loc-1');
  });

  it('calls onCancel when the cancel button is pressed', () => {
    const onCancel = jest.fn();

    const { getByText } = render(
      <MapLocationPickerModal
        visible
        locations={[]}
        placedLocationIds={new Set()}
        onSelect={jest.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.press(getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
