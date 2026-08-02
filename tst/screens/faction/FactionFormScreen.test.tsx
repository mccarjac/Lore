import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { FactionFormScreen } from '@screens/faction/FactionFormScreen';
import { describeFormScreenContract } from '../../helpers/screenContracts';
import { getStorageMock } from '../../helpers/storage';
import { makeStoredFaction } from '../../helpers/factories';
import {
  installRouteParams,
  resetNavigationMocks,
} from '../../helpers/navigation';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();
const FACTION_NAME = 'Iron Legion';

describeFormScreenContract({
  name: 'FactionFormScreen',
  renderScreen: () => render(<FactionFormScreen />),
  requiredFieldPlaceholder: 'Enter faction name',
  requiredFieldValue: 'New Faction',
  validationErrorText: 'Faction name is required',
  submitLabels: { create: 'Create Faction', update: 'Update Faction' },
  createFn: () => storage.createFaction,
  updateFn: () => storage.updateFaction,
  primeCreate: () => {
    storage.createFaction.mockResolvedValue(true);
  },
  edit: {
    routeParams: { factionName: FACTION_NAME },
    prime: () => {
      storage.loadFactions.mockResolvedValue([
        makeStoredFaction({ name: FACTION_NAME, description: 'Old guard' }),
      ]);
      storage.updateFaction.mockResolvedValue(
        makeStoredFaction({ name: FACTION_NAME })
      );
    },
    prefilledValue: FACTION_NAME,
  },
});

// The "Faction Relationships" section must not render for a ruleset that
// declares no faction-faction pairing, unless the faction already has
// stored relationship data from a ruleset that used to declare one — that
// data must stay visible and removable rather than becoming orphaned.
describe('FactionFormScreen — relationships section visibility', () => {
  afterEach(() => {
    resetNavigationMocks();
  });

  const rulesetWithoutFactionPairing = {
    ...genericRuleset,
    relationshipTypes: genericRuleset.relationshipTypes.filter(
      collection => collection.id !== 'accord'
    ),
  };

  it('hides the section for a new faction when the ruleset has no faction-faction pairing', async () => {
    installRouteParams({});
    storage.loadFactions.mockResolvedValue([]);

    const { getByText, queryByText } = renderWithRuleset(
      <FactionFormScreen />,
      { ruleset: rulesetWithoutFactionPairing }
    );

    await waitFor(() => expect(getByText('Create Faction')).toBeTruthy());
    expect(queryByText(/Relationships$/)).toBeNull();
    expect(queryByText('+ Add Relationship')).toBeNull();
  });

  it('keeps the section for a faction with existing relationship data even when the ruleset drops the pairing', async () => {
    installRouteParams({ factionName: FACTION_NAME });
    storage.loadFactions.mockResolvedValue([
      makeStoredFaction({
        name: FACTION_NAME,
        relationships: [
          { factionName: 'Other Faction', relationshipTypeId: 'old-id' },
        ],
      }),
    ]);

    const { getByText, queryByText } = renderWithRuleset(
      <FactionFormScreen />,
      { ruleset: rulesetWithoutFactionPairing }
    );

    await waitFor(() => expect(getByText('Update Faction')).toBeTruthy());
    expect(queryByText(/Relationships$/)).toBeTruthy();
    expect(getByText('+ Add Relationship')).toBeTruthy();
  });
});
