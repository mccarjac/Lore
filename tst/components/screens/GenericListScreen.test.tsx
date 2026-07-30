import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GenericListScreen } from '@components/screens/GenericListScreen';
import type { ListScreenConfig } from '@components/screens/listScreenConfig';
import {
  installNavigationMock,
  resetNavigationMocks,
  getLastHeaderRight,
} from '../../helpers/navigation';
import { spyOnAlert, pressAlertButton } from '../../helpers/alertAndPlatform';

interface TestItem {
  id: string;
  name: string;
  active: boolean;
}

const items: TestItem[] = [
  { id: '1', name: 'Alpha', active: true },
  { id: '2', name: 'Beta', active: false },
];

function makeConfig(
  overrides: Partial<ListScreenConfig<TestItem>> = {}
): ListScreenConfig<TestItem> {
  return {
    loadData: jest.fn().mockResolvedValue({ items, context: undefined }),
    keyExtractor: item => item.id,
    renderItem: item => <Text>{item.name}</Text>,
    searchableText: item => [item.name],
    useFilterFields: () => [],
    advancedSearchTitle: 'Search Test Items',
    searchPlaceholder: 'Search test items...',
    emptyStateTitle: 'No items found',
    ...overrides,
  };
}

describe('GenericListScreen', () => {
  afterEach(() => {
    resetNavigationMocks();
    jest.restoreAllMocks();
  });

  it('loads data via config.loadData and renders items', async () => {
    const config = makeConfig();
    const { getByText } = render(<GenericListScreen config={config} />);

    await waitFor(() => {
      expect(config.loadData).toHaveBeenCalled();
      expect(getByText('Alpha')).toBeTruthy();
      expect(getByText('Beta')).toBeTruthy();
    });
  });

  it('renders the empty state when loadData resolves with no items', async () => {
    const config = makeConfig({
      loadData: jest.fn().mockResolvedValue({ items: [], context: undefined }),
    });
    const { getByText } = render(<GenericListScreen config={config} />);

    await waitFor(() => {
      expect(getByText('No items found')).toBeTruthy();
    });
  });

  it('passes loaded context into useFilterFields', async () => {
    const useFilterFields = jest.fn().mockReturnValue([]);
    const config = makeConfig({
      loadData: jest
        .fn()
        .mockResolvedValue({ items, context: { label: 'ctx-value' } }),
      useFilterFields,
    });
    render(<GenericListScreen config={config} />);

    await waitFor(() => {
      expect(useFilterFields).toHaveBeenCalledWith({ label: 'ctx-value' });
    });
  });

  it('applies a quick filter and re-sorts via sortResults', async () => {
    const config = makeConfig({
      quickFilters: [
        {
          key: 'active',
          label: active => (active ? 'Show All' : 'Active Only'),
          predicate: item => item.active === true,
          defaultActive: false,
        },
      ],
      sortResults: sorted =>
        [...sorted].sort((a, b) => a.name.localeCompare(b.name)),
    });
    const { getByText, queryByText } = render(
      <GenericListScreen config={config} />
    );

    await waitFor(() => expect(getByText('Alpha')).toBeTruthy());
    expect(getByText('Beta')).toBeTruthy();

    fireEvent.press(getByText('Active Only'));

    await waitFor(() => {
      expect(getByText('Alpha')).toBeTruthy();
      expect(queryByText('Beta')).toBeNull();
    });

    fireEvent.press(getByText('Show All'));

    await waitFor(() => {
      expect(getByText('Beta')).toBeTruthy();
    });
  });

  it('runs a bulk action after confirmation and reloads data', async () => {
    const alertSpy = spyOnAlert();
    const run = jest.fn().mockResolvedValue(undefined);
    const loadData = jest.fn().mockResolvedValue({ items, context: undefined });
    const config = makeConfig({
      loadData,
      bulkActions: [
        {
          key: 'resetAll',
          label: 'Reset All',
          confirmTitle: 'Reset Everything',
          confirmMessage: 'Are you sure?',
          confirmLabel: 'Reset',
          run,
        },
      ],
    });
    const { getByText } = render(<GenericListScreen config={config} />);

    await waitFor(() => expect(getByText('Alpha')).toBeTruthy());
    const callsBeforeAction = loadData.mock.calls.length;

    fireEvent.press(getByText('Reset All'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    await pressAlertButton(alertSpy, 'Reset');

    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
      expect(loadData.mock.calls.length).toBeGreaterThan(callsBeforeAction);
    });
  });

  it('does not run a bulk action when the confirmation is cancelled', async () => {
    const alertSpy = spyOnAlert();
    const run = jest.fn().mockResolvedValue(undefined);
    const config = makeConfig({
      bulkActions: [
        {
          key: 'resetAll',
          label: 'Reset All',
          confirmTitle: 'Reset Everything',
          confirmMessage: 'Are you sure?',
          run,
        },
      ],
    });
    const { getByText } = render(<GenericListScreen config={config} />);

    await waitFor(() => expect(getByText('Alpha')).toBeTruthy());

    fireEvent.press(getByText('Reset All'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    await pressAlertButton(alertSpy, 'Cancel');

    expect(run).not.toHaveBeenCalled();
  });

  it('composes extra header buttons, the Statistics menu, and Add into headerRight', async () => {
    const nav = installNavigationMock();
    const extraOnPress = jest.fn();
    const statsOnPress = jest.fn();
    const onAddPress = jest.fn();
    const config = makeConfig({
      extraHeaderButtons: [
        { key: 'map', label: '🗺️', onPress: extraOnPress },
        { key: 'hidden', label: 'Hidden', onPress: jest.fn(), visible: false },
      ],
      menuSections: [
        {
          title: 'Statistics',
          items: [{ label: 'View Stats', onPress: statsOnPress }],
        },
      ],
      onAddPress,
    });
    render(<GenericListScreen config={config} />);

    await waitFor(() => expect(nav.setOptions).toHaveBeenCalled());
    const header = render(getLastHeaderRight(nav));

    expect(header.getByText('🗺️')).toBeTruthy();
    expect(header.queryByText('Hidden')).toBeNull();

    fireEvent.press(header.getByText('🗺️'));
    expect(extraOnPress).toHaveBeenCalledTimes(1);

    fireEvent.press(header.getByLabelText('More options'));
    fireEvent.press(header.getByText('View Stats'));
    expect(statsOnPress).toHaveBeenCalledTimes(1);

    fireEvent.press(header.getByText('+'));
    expect(onAddPress).toHaveBeenCalledTimes(1);
  });

  it('navigates to AdvancedSearch with the resolved filter fields', async () => {
    const nav = installNavigationMock();
    const config = makeConfig({
      useFilterFields: () => [
        {
          key: 'active',
          type: 'select',
          label: 'Active',
          options: [{ value: 'yes', label: 'Yes' }],
          matches: () => true,
        },
      ],
    });
    const { getByLabelText } = render(<GenericListScreen config={config} />);

    await waitFor(() => expect(getByLabelText('Advanced search')).toBeTruthy());
    fireEvent.press(getByLabelText('Advanced search'));

    expect(nav.navigate).toHaveBeenCalledWith(
      'AdvancedSearch',
      expect.objectContaining({
        title: 'Search Test Items',
        fields: expect.arrayContaining([
          expect.objectContaining({ key: 'active' }),
        ]),
      })
    );
  });
});
