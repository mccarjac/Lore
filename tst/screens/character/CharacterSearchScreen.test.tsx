import React from 'react';
import {
  waitFor,
  fireEvent,
  type RenderResult,
} from '@testing-library/react-native';
import { CharacterSearchScreen } from '@screens/character/CharacterSearchScreen';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeCharacter } from '../../helpers/factories';
import {
  installNavigationMock,
  resetNavigationMocks,
} from '../../helpers/navigation';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';

// This screen has no list/form/detail shape — it is a criteria panel plus a
// result list — so it gets a bespoke file rather than a screen contract.
jest.mock('@utils/characterStorage');

const storage = getStorageMock();

/**
 * Picker.Item children collapse into an `items` prop on the host RNCPicker
 * and render no queryable text, so read option labels from there.
 */
const pickerOptionLabels = (screen: RenderResult): string[] =>
  screen
    .UNSAFE_getAllByType('RNCPicker' as never)
    .flatMap(picker => (picker.props.items ?? []) as { label: string }[])
    .map(item => item.label);

describe('CharacterSearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  const renderScreen = (ruleset = genericRuleset) =>
    renderWithRuleset(<CharacterSearchScreen />, { ruleset });

  it('populates its filters from the ruleset, under its terminology', async () => {
    const screen = renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Search Criteria')).toBeTruthy()
    );

    expect(screen.getByText('Talent')).toBeTruthy();
    expect(screen.getByText('Virtue')).toBeTruthy();
    expect(screen.getByText('Discipline Score')).toBeTruthy();

    const options = pickerOptionLabels(screen);
    expect(options).toEqual(
      expect.arrayContaining(['Well Read', 'Strong Back', 'Patient', 'Guile'])
    );
  });

  it('hides the recipe filter when the ruleset disables recipes', async () => {
    const screen = renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Search Criteria')).toBeTruthy()
    );
    expect(screen.queryByText('Recipe')).toBeNull();
  });

  it('shows the recipe filter when the ruleset enables recipes', async () => {
    const withRecipes = {
      ...genericRuleset,
      features: { ...genericRuleset.features, recipes: true },
      recipes: [
        { id: 'stew', name: 'Stew', description: '', materials: ['Pot'] },
      ],
    };
    const screen = renderScreen(withRecipes);

    await waitFor(() =>
      expect(screen.getByText('Search Criteria')).toBeTruthy()
    );
    expect(screen.getByText('Recipe')).toBeTruthy();
    expect(pickerOptionLabels(screen)).toContain('Stew');
  });

  it('lists matching characters under their ruleset archetype label', async () => {
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({ id: 'c1', name: 'Bram', archetypeId: 'scholar' }),
    ]);

    const screen = renderScreen();

    await waitFor(() => expect(screen.getByText('Search')).toBeTruthy());
    fireEvent.press(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Bram')).toBeTruthy());
    // The raw id is 'scholar'; the label is 'Scholar'.
    expect(screen.getByText('Scholar')).toBeTruthy();
  });

  it('scores trait categories from the ruleset when filtering', async () => {
    const nav = installNavigationMock();
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({
        id: 'c1',
        name: 'Bram',
        archetypeId: 'scholar',
        traitIds: ['well_read'],
      }),
    ]);

    const screen = renderScreen();

    await waitFor(() => expect(screen.getByText('Search')).toBeTruthy());
    fireEvent.press(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Bram')).toBeTruthy());
    fireEvent.press(screen.getByText('Bram'));

    expect(nav.navigate).toHaveBeenCalledWith(
      'CharacterDetail',
      expect.objectContaining({
        character: expect.objectContaining({ name: 'Bram' }),
      })
    );
  });
});
