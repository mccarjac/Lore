import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HeaderMenuButton } from '@components/common/HeaderMenuButton';
import type { MenuSection } from '@components/common/menuTypes';

const sections: MenuSection[] = [
  {
    title: 'Statistics',
    items: [{ label: 'Character Statistics', onPress: jest.fn() }],
  },
];

describe('HeaderMenuButton', () => {
  it('renders default trigger label', () => {
    const { getByText } = render(<HeaderMenuButton sections={sections} />);
    expect(getByText('⋮')).toBeTruthy();
  });

  it('does not show menu items until the trigger is pressed', () => {
    const { queryByText, getByLabelText } = render(
      <HeaderMenuButton sections={sections} />
    );

    expect(queryByText('Statistics')).toBeNull();
    fireEvent.press(getByLabelText('More options'));
    expect(queryByText('Statistics')).toBeTruthy();
    expect(queryByText('Character Statistics')).toBeTruthy();
  });

  it('calls the item onPress and closes the menu when an item is pressed', () => {
    const onPress = jest.fn();
    const localSections: MenuSection[] = [
      { title: 'Statistics', items: [{ label: 'View Stats', onPress }] },
    ];
    const { getByLabelText, getByText, queryByText } = render(
      <HeaderMenuButton sections={localSections} />
    );

    fireEvent.press(getByLabelText('More options'));
    fireEvent.press(getByText('View Stats'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(queryByText('View Stats')).toBeNull();
  });

  it('closes the menu without firing any item when the overlay is pressed', () => {
    const onPress = jest.fn();
    const localSections: MenuSection[] = [
      { title: 'Statistics', items: [{ label: 'View Stats', onPress }] },
    ];
    const { getByLabelText, getByText, getByTestId, queryByText } = render(
      <HeaderMenuButton sections={localSections} />
    );

    fireEvent.press(getByLabelText('More options'));
    expect(getByText('View Stats')).toBeTruthy();

    fireEvent.press(getByTestId('header-menu-overlay'));

    expect(onPress).not.toHaveBeenCalled();
    expect(queryByText('View Stats')).toBeNull();
  });

  it('renders a custom trigger label when provided', () => {
    const { getByText } = render(
      <HeaderMenuButton sections={sections} label="Menu" />
    );
    expect(getByText('Menu')).toBeTruthy();
  });
});
