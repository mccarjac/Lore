import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MapInfoCard } from '@components/map/MapInfoCard';
import { makeLocation } from '../../helpers/factories';

describe('MapInfoCard', () => {
  it('renders the location name and description', () => {
    const location = makeLocation({
      name: 'The Docks',
      description: 'A rundown pier on the east side.',
    });

    const { getByText } = render(
      <MapInfoCard
        location={location}
        onViewDetails={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(getByText('The Docks')).toBeTruthy();
    expect(getByText('A rundown pier on the east side.')).toBeTruthy();
  });

  it('calls onViewDetails with the location id when the button is pressed', () => {
    const location = makeLocation({ id: 'loc-42', name: 'The Docks' });
    const onViewDetails = jest.fn();

    const { getByText } = render(
      <MapInfoCard
        location={location}
        onViewDetails={onViewDetails}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByText('View details'));

    expect(onViewDetails).toHaveBeenCalledWith('loc-42');
  });

  it('calls onClose when the close button is pressed', () => {
    const location = makeLocation({ name: 'The Docks' });
    const onClose = jest.fn();

    const { getByText } = render(
      <MapInfoCard
        location={location}
        onViewDetails={jest.fn()}
        onClose={onClose}
      />
    );

    fireEvent.press(getByText('✕'));

    expect(onClose).toHaveBeenCalled();
  });

  it('does not render "View map" or "Remove pin" when their handlers are omitted', () => {
    const location = makeLocation({ name: 'The Docks' });

    const { queryByText } = render(
      <MapInfoCard
        location={location}
        onViewDetails={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(queryByText('View map')).toBeNull();
    expect(queryByText('Remove pin')).toBeNull();
  });

  it('calls onViewMap when "View map" is pressed', () => {
    const location = makeLocation({ name: 'The Docks' });
    const onViewMap = jest.fn();

    const { getByText } = render(
      <MapInfoCard
        location={location}
        onViewDetails={jest.fn()}
        onClose={jest.fn()}
        onViewMap={onViewMap}
      />
    );

    fireEvent.press(getByText('View map'));

    expect(onViewMap).toHaveBeenCalled();
  });

  it('calls onRemovePin when "Remove pin" is pressed', () => {
    const location = makeLocation({ name: 'The Docks' });
    const onRemovePin = jest.fn();

    const { getByText } = render(
      <MapInfoCard
        location={location}
        onViewDetails={jest.fn()}
        onClose={jest.fn()}
        onRemovePin={onRemovePin}
      />
    );

    fireEvent.press(getByText('Remove pin'));

    expect(onRemovePin).toHaveBeenCalled();
  });
});
