import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QuestFormScreen } from '@screens/quest/QuestFormScreen';
import { describeFormScreenContract } from '../../helpers/screenContracts';
import { getStorageMock } from '../../helpers/storage';
import { makeQuest } from '../../helpers/factories';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();
const existingQuest = makeQuest({ id: 'quest-1', name: 'Old Mission' });

describeFormScreenContract({
  name: 'QuestFormScreen',
  renderScreen: () => render(<QuestFormScreen />),
  requiredFieldPlaceholder: 'Mission name',
  requiredFieldValue: 'Retrieve Artifact',
  validationErrorText: 'Mission name is required',
  submitLabels: { create: 'Create Quest', update: 'Update Quest' },
  createFn: () => storage.createQuest,
  updateFn: () => storage.updateQuest,
  primeCreate: () => {
    storage.createQuest.mockResolvedValue(makeQuest());
  },
  edit: {
    routeParams: { quest: existingQuest },
    prime: () => {
      storage.updateQuest.mockResolvedValue(existingQuest);
    },
    prefilledValue: 'Old Mission',
  },
});

describe('QuestFormScreen — team preferences come from the ruleset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.loadCharacters.mockResolvedValue([]);
    storage.loadLocations.mockResolvedValue([]);
    storage.loadFactions.mockResolvedValue([]);
    storage.loadEvents.mockResolvedValue([]);
  });

  /**
   * `Picker.Item` children collapse into an `items` prop on the host
   * `RNCPicker` and render no queryable text, so option labels have to be
   * read off the props rather than with `getByText`.
   */
  const pickerLabels = (
    picker: { props: { items?: { label: string }[] } } | undefined
  ): string[] => (picker?.props.items ?? []).map(item => item.label);

  it('offers the active ruleset’s facet categories and entries', async () => {
    const view = renderWithRuleset(<QuestFormScreen />, {
      ruleset: genericRuleset,
    });
    await waitFor(() => view.getByText('Team Preferences'));

    // The section is `defaultCollapsed`, so the pickers are not mounted yet.
    fireEvent.press(view.getByText('Team Preferences'));

    const allLabels = view
      .UNSAFE_getAllByType('RNCPicker' as never)
      .flatMap(pickerLabels);

    // Fixture content, on every axis the form offers: lineages and virtues
    // entries, talents entries, and talents' categories (its own field).
    expect(allLabels).toEqual(
      expect.arrayContaining(['Wanderer', 'Scholar', 'Patient'])
    );
    expect(allLabels).toEqual(
      expect.arrayContaining(['Well Read', 'Strong Back'])
    );
    expect(allLabels).toEqual(expect.arrayContaining(['Lore', 'Might']));

    // Nothing from the bundled Afterworlds tables leaks through. Asserted one
    // at a time: `not.arrayContaining([a, b])` passes when only one is absent.
    ['Human', 'Android', 'Agility', 'Endurance'].forEach(afterworldsLabel => {
      expect(allLabels).not.toContain(afterworldsLabel);
    });
  });

  it('hides a collection’s entries field when it has none, independent of its categories field', async () => {
    const rulesetWithEmptyTalents = {
      ...genericRuleset,
      facets: genericRuleset.facets.map(collection =>
        collection.id === 'talents'
          ? { ...collection, entries: [] }
          : collection
      ),
    };
    const view = renderWithRuleset(<QuestFormScreen />, {
      ruleset: rulesetWithEmptyTalents,
    });
    await waitFor(() => view.getByText('Team Preferences'));
    fireEvent.press(view.getByText('Team Preferences'));

    // The entries field (label "Talents") is gone on both axes...
    expect(view.queryAllByText('Talents')).toHaveLength(0);
    // ...but the categories field (label "Disciplines") still renders, since
    // only `entries` was emptied.
    expect(view.queryAllByText('Disciplines')).toHaveLength(2);
  });
});
