import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AdvancedSearchScreen } from '@screens/search/AdvancedSearchScreen';
import type { FilterFieldConfig } from '@/components/search/filterFieldTypes';
import {
  installNavigationMock,
  installRouteParams,
  resetNavigationMocks,
} from '../../helpers/navigation';

const selectField: FilterFieldConfig = {
  key: 'category',
  type: 'select',
  label: 'Category',
  options: [
    { value: 'tools', label: 'Tools' },
    { value: 'toys', label: 'Toys' },
  ],
  matches: () => true,
};

const numberField: FilterFieldConfig = {
  key: 'minScore',
  type: 'number',
  label: 'Min Score',
  placeholder: 'Min Score',
  matches: () => true,
};

describe('AdvancedSearchScreen', () => {
  afterEach(() => {
    resetNavigationMocks();
  });

  const renderScreen = (
    initialValues: Record<string, unknown>,
    onApply: jest.Mock
  ) => {
    const nav = installNavigationMock();
    installRouteParams({
      title: 'Search Widgets',
      fields: [selectField, numberField],
      initialValues,
      onApply,
    });
    return { nav, screen: render(<AdvancedSearchScreen />) };
  };

  it('renders the given title and field labels/options', () => {
    const { screen } = renderScreen({}, jest.fn());

    expect(screen.getByText('Search Widgets')).toBeTruthy();
    expect(screen.getByText('Category')).toBeTruthy();
    expect(screen.getByText('Min Score')).toBeTruthy();

    const pickerOptionLabels = screen
      .UNSAFE_getAllByType('RNCPicker' as never)
      .flatMap(picker => (picker.props.items ?? []) as { label: string }[])
      .map(item => item.label);
    expect(pickerOptionLabels).toEqual(
      expect.arrayContaining(['Tools', 'Toys'])
    );
  });

  it('applies the current values and navigates back', () => {
    const onApply = jest.fn();
    const { nav, screen } = renderScreen({ category: 'tools' }, onApply);

    fireEvent.press(screen.getByText('Apply'));

    expect(onApply).toHaveBeenCalledWith({ category: 'tools' });
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('lets a number field value be edited before applying', () => {
    const onApply = jest.fn();
    const { screen } = renderScreen({}, onApply);

    fireEvent.changeText(screen.getByPlaceholderText('Min Score'), '4');
    fireEvent.press(screen.getByText('Apply'));

    expect(onApply).toHaveBeenCalledWith({ minScore: 4 });
  });

  it('clear all resets values before the next apply', () => {
    const onApply = jest.fn();
    const { screen } = renderScreen({ category: 'tools' }, onApply);

    fireEvent.press(screen.getByText('Clear all'));
    fireEvent.press(screen.getByText('Apply'));

    expect(onApply).toHaveBeenCalledWith({});
  });
});
