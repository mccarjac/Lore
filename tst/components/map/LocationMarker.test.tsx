import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';
import { LocationMarker } from '@components/map/LocationMarker';
import { makeLocation } from '../../helpers/factories';

const Harness: React.FC<{
  x: number;
  y: number;
  onPress: (location: ReturnType<typeof makeLocation>) => void;
}> = ({ x, y, onPress }) => {
  const scale = useSharedValue(1);
  const location = makeLocation({ id: 'loc-1', name: 'The Docks' });
  return (
    <LocationMarker
      x={x}
      y={y}
      location={location}
      imageWidth={300}
      imageHeight={200}
      scale={scale}
      onPress={onPress}
    />
  );
};

describe('LocationMarker', () => {
  it('renders a pressable marker labeled with the location name', () => {
    const { getByLabelText } = render(
      <Harness x={0.5} y={0.5} onPress={jest.fn()} />
    );

    expect(getByLabelText('The Docks')).toBeTruthy();
  });

  it('calls onPress with the location when pressed', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <Harness x={0.5} y={0.5} onPress={onPress} />
    );

    fireEvent.press(getByLabelText('The Docks'));

    expect(onPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'loc-1', name: 'The Docks' })
    );
  });
});
