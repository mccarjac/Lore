import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { CharacterListScreen } from '@screens/character/CharacterListScreen';
import { describeListScreenContract } from '../../helpers/screenContracts';
import { getStorageMock } from '../../helpers/storage';
import { makeCharacter } from '../../helpers/factories';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();

describeListScreenContract({
  name: 'CharacterListScreen',
  renderScreen: () => render(<CharacterListScreen />),
  emptyStateTitle: 'No characters found',
  searchPlaceholder: 'Search characters by name...',
  loadFns: () => [storage.loadCharacters],
  primePopulated: () => {
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Alice',
        factions: [{ name: 'Iron Legion', relationshipTypeId: 'ally' }],
      }),
      makeCharacter({ id: 'char-2', name: 'Bob' }),
    ]);
  },
  populatedTexts: ['Alice', 'Iron Legion', 'Bob'],
});

// Presence (#56) left the engine — the list screen no longer shows a
// Present/Absent badge per character or the "Present Only"/"Reset Present"
// header buttons; that's now a ruleset-declared facet, filterable through
// advanced search instead.
describe('CharacterListScreen presence removal (#56)', () => {
  it('renders no present/absent badges or header buttons', async () => {
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({ id: 'char-1', name: 'Alice' }),
    ]);

    const { queryByText } = render(<CharacterListScreen />);

    await waitFor(() => expect(queryByText('Alice')).toBeTruthy());

    expect(queryByText('Present')).toBeNull();
    expect(queryByText('Absent')).toBeNull();
    expect(queryByText('Present Only')).toBeNull();
    expect(queryByText('Reset Present')).toBeNull();
    expect(queryByText('No factions')).toBeNull();
  });
});
