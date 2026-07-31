import React from 'react';
import {
  waitFor,
  fireEvent,
  type RenderResult,
} from '@testing-library/react-native';
import { FactionStatsScreen } from '@screens/FactionStatsScreen';
import { getStorageMock, primeStorageDefaults } from '../helpers/storage';
import { makeCharacter, makeStoredFaction } from '../helpers/factories';
import {
  installFocusEffectOnce,
  resetNavigationMocks,
} from '../helpers/navigation';
import { renderWithRuleset } from '../helpers/ruleset';
import { genericRuleset } from '../fixtures/genericRuleset';
import { CHART_PALETTE } from '@/styles/chartPalette';
import { RelationshipStanding } from '@models/types';
import type { RulesetDefinition } from '@/ruleset/types';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();

/** Collects backgroundColor off every flattened style on the tree. */
const backgroundColors = (node: unknown): string[] => {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.backgroundColor === 'string') {
      found.push(record.backgroundColor);
    }
    Object.values(record).forEach(walk);
  };
  walk(node);
  return found;
};

describe('FactionStatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
    // This screen gates its spinner behind useFocusEffect; the global mock
    // re-fires on every render and turns that into a render loop.
    installFocusEffectOnce();

    storage.loadFactions.mockResolvedValue([
      makeStoredFaction({ name: 'The Athenaeum' }),
    ]);
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({
        id: 'c1',
        name: 'Bram',
        facets: { lineages: ['scholar'], talents: ['well_read'] },
        factions: [
          { name: 'The Athenaeum', standing: RelationshipStanding.Ally },
        ],
      }),
    ]);
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  /** The category bars only render once a faction card is expanded. */
  const renderAndExpand = async (
    ruleset = genericRuleset
  ): Promise<RenderResult> => {
    const screen = renderWithRuleset(<FactionStatsScreen />, { ruleset });
    await waitFor(() => expect(screen.getByText('The Athenaeum')).toBeTruthy());
    fireEvent.press(screen.getByText('The Athenaeum'));
    return screen;
  };

  it('renders trait categories from the ruleset, by their labels', async () => {
    const screen = await renderAndExpand();

    // 'well_read' is in the 'lore' category, whose label is 'Lore'.
    await waitFor(() => expect(screen.getByText('Lore')).toBeTruthy());
  });

  it("colors a bar with the category's declared color", async () => {
    const screen = await renderAndExpand();

    await waitFor(() => expect(screen.getByText('Lore')).toBeTruthy());
    // The fixture declares Lore as #112233; the old hardcoded PerkTag map
    // knew nothing about it and would have fallen back to the accent color.
    expect(backgroundColors(screen.toJSON())).toContain('#112233');
  });

  it('falls back to the shared palette for an uncolored category', async () => {
    // 'guile' is the fixture's colorless category. Give a character a trait in
    // it so it renders a bar at all.
    storage.loadCharacters.mockResolvedValue([
      makeCharacter({
        id: 'c1',
        name: 'Bram',
        facets: { lineages: ['scholar'], talents: ['sly'] },
        factions: [
          { name: 'The Athenaeum', standing: RelationshipStanding.Ally },
        ],
      }),
    ]);

    const withGuileTrait: RulesetDefinition = {
      ...genericRuleset,
      facets: genericRuleset.facets.map(collection =>
        collection.id === 'talents'
          ? {
              ...collection,
              entries: [
                ...collection.entries,
                {
                  id: 'sly',
                  label: 'Sly',
                  description: '',
                  categoryId: 'guile',
                },
              ],
            }
          : collection
      ),
    };

    const screen = await renderAndExpand(withGuileTrait);

    await waitFor(() => expect(screen.getByText('Guile')).toBeTruthy());
    // Guile is third in traitCategories, so it cycles to palette index 2 —
    // a real color, never undefined.
    expect(backgroundColors(screen.toJSON())).toContain(CHART_PALETTE[2]);
  });
});
