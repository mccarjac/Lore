import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { QuestListScreen } from '@screens/quest/QuestListScreen';
import { QuestStatus } from '@models/types';
import { describeListScreenContract } from '../../helpers/screenContracts';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeQuest } from '../../helpers/factories';
import {
  installNavigationMock,
  resetNavigationMocks,
  getLastHeaderRight,
} from '../../helpers/navigation';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();

describeListScreenContract({
  name: 'QuestListScreen',
  renderScreen: () => render(<QuestListScreen />),
  emptyStateTitle: 'No quests found',
  searchPlaceholder: 'Search quests by name...',
  loadFns: () => [storage.loadQuests],
  primePopulated: () => {
    storage.loadQuests.mockResolvedValue([
      makeQuest({ name: 'Recover the Cargo' }),
    ]);
  },
  populatedTexts: ['Recover the Cargo'],
});

describe('QuestListScreen — advanced search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('narrows the list by status when advanced filters are applied', async () => {
    const nav = installNavigationMock();
    storage.loadQuests.mockResolvedValue([
      makeQuest({
        id: 'q1',
        name: 'Recover the Cargo',
        status: QuestStatus.InProgress,
      }),
      makeQuest({
        id: 'q2',
        name: 'Scout the Ruins',
        status: QuestStatus.NotStarted,
      }),
    ]);
    const screen = render(<QuestListScreen />);

    await waitFor(() =>
      expect(screen.getByText('Recover the Cargo')).toBeTruthy()
    );
    expect(screen.getByText('Scout the Ruins')).toBeTruthy();

    const header = render(getLastHeaderRight(nav));
    fireEvent.press(header.getByText('🔍'));

    expect(nav.navigate).toHaveBeenCalledWith(
      'AdvancedSearch',
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ key: 'status' }),
        ]),
      })
    );

    const onApply = nav.navigate.mock.calls.find(
      call => call[0] === 'AdvancedSearch'
    )?.[1].onApply as (values: Record<string, unknown>) => void;

    act(() => onApply({ status: QuestStatus.NotStarted }));

    await waitFor(() => {
      expect(screen.queryByText('Recover the Cargo')).toBeNull();
      expect(screen.getByText('Scout the Ruins')).toBeTruthy();
    });
  });
});
