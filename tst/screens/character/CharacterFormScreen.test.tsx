import React from 'react';
import {
  render,
  waitFor,
  fireEvent,
  type RenderResult,
} from '@testing-library/react-native';
import { CharacterFormScreen } from '@screens/character/CharacterFormScreen';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeCharacter } from '../../helpers/factories';
import {
  installNavigationMock,
  installRouteParams,
  resetNavigationMocks,
} from '../../helpers/navigation';
import { spyOnAlert } from '../../helpers/alertAndPlatform';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';

// This screen validates via Alert.alert (no inline error text) and renders
// its submit action with RN's <Button>, not a styled TouchableOpacity like
// the other form screens, so it doesn't fit describeFormScreenContract and
// gets a bespoke test file instead.
jest.mock('@utils/characterStorage');

const storage = getStorageMock();

describe('CharacterFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
    installRouteParams({});
  });

  afterEach(() => {
    resetNavigationMocks();
    jest.restoreAllMocks();
  });

  it('shows the create action when no character is being edited', async () => {
    const { getByText } = render(<CharacterFormScreen />);

    await waitFor(() => {
      expect(getByText('Create Character')).toBeTruthy();
    });
  });

  it('alerts instead of creating when the name is blank', async () => {
    const alertSpy = spyOnAlert();

    const { getByText } = render(<CharacterFormScreen />);

    await waitFor(() => {
      expect(getByText('Create Character')).toBeTruthy();
    });
    fireEvent.press(getByText('Create Character'));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Name is required');
    expect(storage.addCharacter).not.toHaveBeenCalled();
  });

  it('creates the character and navigates back on success', async () => {
    const nav = installNavigationMock();
    storage.addCharacter.mockResolvedValue(
      makeCharacter({ id: 'new-1', name: 'Newbie' })
    );
    storage.saveCharacters.mockResolvedValue(undefined);

    const { getByText, getByPlaceholderText } = render(<CharacterFormScreen />);

    await waitFor(() => {
      expect(getByText('Create Character')).toBeTruthy();
    });
    fireEvent.changeText(getByPlaceholderText('Character Name'), 'Newbie');
    fireEvent.press(getByText('Create Character'));

    await waitFor(() => {
      expect(storage.addCharacter).toHaveBeenCalled();
      expect(nav.goBack).toHaveBeenCalled();
    });
  });

  it('prefills existing data and updates instead of creating', async () => {
    const nav = installNavigationMock();
    const existing = makeCharacter({ id: 'char-1', name: 'Alice' });
    installRouteParams({ character: existing });
    storage.updateCharacter.mockResolvedValue(existing);
    storage.loadCharacters.mockResolvedValue([existing]);
    storage.saveCharacters.mockResolvedValue(undefined);

    const { getByText, getByDisplayValue } = render(<CharacterFormScreen />);

    await waitFor(() => {
      expect(getByDisplayValue('Alice')).toBeTruthy();
      expect(getByText('Update Character')).toBeTruthy();
    });
    fireEvent.press(getByText('Update Character'));

    await waitFor(() => {
      expect(storage.updateCharacter).toHaveBeenCalledWith(
        'char-1',
        expect.objectContaining({ name: 'Alice' })
      );
      expect(nav.goBack).toHaveBeenCalled();
    });
    expect(storage.addCharacter).not.toHaveBeenCalled();
  });
});

// The sections rewired in #8. Rendered against a ruleset that shares no ids
// with Afterworlds, so a screen still reaching for AVAILABLE_PERKS or
// SPECIES_BASE_STATS fails here rather than passing by coincidence.
describe('CharacterFormScreen — reads the active ruleset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
    installRouteParams({});
  });

  afterEach(() => {
    resetNavigationMocks();
    jest.restoreAllMocks();
  });

  const renderForm = () =>
    renderWithRuleset(<CharacterFormScreen />, { ruleset: genericRuleset });

  /**
   * Picker.Item children collapse into an `items` prop on the host
   * `RNCPicker`, and render no queryable text, so read the option labels
   * from there.
   */
  const pickerOptionLabels = (screen: RenderResult): string[] =>
    screen
      .UNSAFE_getAllByType('RNCPicker' as never)
      .flatMap(picker => (picker.props.items ?? []) as { label: string }[])
      .map(item => item.label);

  it('offers the ruleset archetypes, under the ruleset terminology', async () => {
    const screen = renderForm();

    await waitFor(() =>
      expect(screen.getByText('Create Character')).toBeTruthy()
    );

    expect(screen.getByText('Lineage')).toBeTruthy();

    const options = pickerOptionLabels(screen);
    expect(options).toEqual(expect.arrayContaining(['Wanderer', 'Scholar']));
    expect(options).not.toContain('Human');
  });

  it('starts a new character on the ruleset default archetype', async () => {
    const nav = installNavigationMock();
    storage.addCharacter.mockResolvedValue(makeCharacter());
    storage.saveCharacters.mockResolvedValue(undefined);

    const { getByText, getByPlaceholderText } = renderForm();

    await waitFor(() => expect(getByText('Create Character')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Character Name'), 'Nomad');
    fireEvent.press(getByText('Create Character'));

    await waitFor(() => {
      expect(storage.addCharacter).toHaveBeenCalledWith(
        expect.objectContaining({ archetypeId: 'scholar' })
      );
      expect(nav.goBack).toHaveBeenCalled();
    });
  });

  it('lists the ruleset traits and its declared categories', async () => {
    const screen = renderForm();

    await waitFor(() =>
      expect(screen.getByText('Create Character')).toBeTruthy()
    );
    fireEvent.press(screen.getByText('Talents'));

    await waitFor(() => expect(screen.getByText('Well Read')).toBeTruthy());

    // The category filter reads the declared list, not the categories that
    // happen to appear on traits — 'Guile' has no traits and must still be
    // offered, which the old derive-from-perks approach could not do.
    expect(pickerOptionLabels(screen)).toEqual(
      expect.arrayContaining(['Lore', 'Might', 'Guile'])
    );
  });

  it('filters traits by the selected archetype', async () => {
    const { getByText, queryByText } = renderForm();

    await waitFor(() => expect(getByText('Create Character')).toBeTruthy());
    fireEvent.press(getByText('Talents'));

    // Default archetype is 'scholar'; 'Strong Back' is wanderer-only.
    await waitFor(() => expect(getByText('Well Read')).toBeTruthy());
    expect(queryByText('Strong Back')).toBeNull();
  });

  it('lists the ruleset qualities and honors its lower quality cap', async () => {
    const alertSpy = spyOnAlert();
    const { getByText } = renderForm();

    await waitFor(() => expect(getByText('Create Character')).toBeTruthy());
    fireEvent.press(getByText('Virtues'));

    await waitFor(() => expect(getByText('Patient')).toBeTruthy());
    fireEvent.press(getByText('Patient'));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('gives every resource and cap an input, and capability flags none', async () => {
    const { getByText, queryByText } = renderForm();

    await waitFor(() => expect(getByText('Create Character')).toBeTruthy());
    fireEvent.press(getByText('Add Augment'));

    // Three resources plus two caps — the old hardcoded quartet could only
    // ever render health/limit/healthCap/limitCap.
    await waitFor(() => expect(getByText('Vigor:')).toBeTruthy());
    expect(getByText('Focus:')).toBeTruthy();
    expect(getByText('Luck:')).toBeTruthy();
    expect(getByText('Vigor Cap:')).toBeTruthy();
    expect(getByText('Focus Cap:')).toBeTruthy();

    // A capability flag is not a number and must not get a numeric field.
    expect(queryByText('Can Fly:')).toBeNull();
    expect(queryByText('Health:')).toBeNull();
  });
});
