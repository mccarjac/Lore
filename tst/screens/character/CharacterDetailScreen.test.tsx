import React from 'react';
import { waitFor, fireEvent } from '@testing-library/react-native';
import { CharacterDetailScreen } from '@screens/character/CharacterDetailScreen';
import { describeDetailScreenContract } from '../../helpers/screenContracts';
import { getStorageMock } from '../../helpers/storage';
import { makeCharacter } from '../../helpers/factories';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';
import { installRouteParams } from '../../helpers/navigation';
import * as discordStorage from '@/utils/discordStorage';

jest.mock('@utils/characterStorage');
jest.mock('@/utils/discordStorage');

const storage = getStorageMock();
const character = makeCharacter({
  id: 'char-1',
  name: 'Alice',
  archetypeId: 'wanderer',
});

describeDetailScreenContract({
  name: 'CharacterDetailScreen',
  renderScreen: () =>
    renderWithRuleset(<CharacterDetailScreen />, { ruleset: genericRuleset }),
  routeParams: { character },
  prime: () => {
    storage.loadCharacters.mockResolvedValue([character]);
    jest
      .mocked(discordStorage.getDiscordMessagesForCharacter)
      .mockResolvedValue([]);
  },
  expectedContent: ['Alice', /Lineage: Wanderer/],
  edit: {
    expectedScreen: 'CharacterForm',
    expectedParams: { character },
  },
  del: {
    deleteFn: () => storage.deleteCharacter,
    primeDelete: () => {
      storage.deleteCharacter.mockResolvedValue(true);
    },
  },
});

describe('CharacterDetailScreen — reads the active ruleset', () => {
  const fixtureCharacter = makeCharacter({
    id: 'char-2',
    name: 'Bram',
    archetypeId: 'scholar',
    traitIds: ['well_read'],
    qualityIds: ['patient'],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    storage.loadCharacters.mockResolvedValue([fixtureCharacter]);
    storage.loadLocations.mockResolvedValue([]);
    jest
      .mocked(discordStorage.getDiscordMessagesForCharacter)
      .mockResolvedValue([]);
    installRouteParams({ character: fixtureCharacter });
  });

  const renderScreen = () =>
    renderWithRuleset(<CharacterDetailScreen />, { ruleset: genericRuleset });

  it('names the archetype with the ruleset label, not "Species"', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => expect(getByText(/Lineage: Scholar/)).toBeTruthy());
  });

  it('resolves trait and quality ids against the ruleset', async () => {
    const { getByText } = renderScreen();

    // Both sections default to collapsed.
    await waitFor(() => expect(getByText('Talents')).toBeTruthy());
    fireEvent.press(getByText('Talents'));
    expect(getByText('Well Read')).toBeTruthy();

    fireEvent.press(getByText('Virtues'));
    expect(getByText('Patient')).toBeTruthy();
  });

  it('computes stats from the provider ruleset, not the bundled one', async () => {
    const { getByText } = renderScreen();

    // Scholar's base focus is 4 and Well Read adds +1. Under Afterworlds this
    // character has no known archetype or trait at all, so the number itself
    // proves which ruleset did the arithmetic — this is the regression test
    // for calculateDerivedStats() having been called without a ruleset.
    await waitFor(() => expect(getByText(/Max Focus:\s*5/)).toBeTruthy());
    // Vigor is capped at 5 for a Scholar, and the base is 1.
    expect(getByText(/Max Vigor:\s*1/)).toBeTruthy();
  });
});
