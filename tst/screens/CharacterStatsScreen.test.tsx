import React from 'react';
import { Text } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import { CharacterStatsScreen } from '@screens/CharacterStatsScreen';
import { getStorageMock, primeStorageDefaults } from '../helpers/storage';
import { makeCharacter } from '../helpers/factories';
import {
  installFocusEffectOnce,
  resetNavigationMocks,
} from '../helpers/navigation';
import { renderWithRuleset } from '../helpers/ruleset';
import { genericRuleset } from '../fixtures/genericRuleset';
import { CHART_PALETTE } from '@/styles/chartPalette';

jest.mock('@utils/characterStorage');

/**
 * The real PieChart renders to SVG and swallows its slice data. Replace it
 * with a component that surfaces `data` as text, so the chart's colors and
 * labels are assertable — they are the thing #9 changed.
 */
interface PieSlice {
  value: number;
  color: string;
  label: string;
}
jest.mock('react-native-gifted-charts', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  return {
    PieChart: ({ data }: { data: PieSlice[] }) =>
      ReactActual.createElement(
        RNText,
        { testID: 'pie-data' },
        data.map(slice => `${slice.label}:${slice.color}`).join('|')
      ),
  };
});

const storage = getStorageMock();

describe('CharacterStatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
    installFocusEffectOnce();

    storage.loadCharacters.mockResolvedValue([
      makeCharacter({
        id: 'c1',
        name: 'Bram',
        facets: { lineages: ['scholar'] },
      }),
      makeCharacter({
        id: 'c2',
        name: 'Wren',
        facets: { lineages: ['wanderer'] },
      }),
      makeCharacter({
        id: 'c3',
        name: 'Sela',
        facets: { lineages: ['wanderer'] },
      }),
    ]);
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  const renderScreen = () =>
    renderWithRuleset(<CharacterStatsScreen />, { ruleset: genericRuleset });

  it('titles the distribution with the ruleset terminology', async () => {
    const { getByText } = renderScreen();

    await waitFor(() =>
      expect(getByText('Lineages Distribution')).toBeTruthy()
    );
  });

  it('labels chart slices with archetype labels, not raw ids', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => expect(getByTestId('pie-data')).toBeTruthy());

    const slices = getByTestId('pie-data').props.children as string;
    expect(slices).toContain('Scholar:');
    expect(slices).toContain('Wanderer:');
    expect(slices).not.toContain('scholar:');
  });

  it('draws chart and legend from one palette assignment', async () => {
    const screen = renderScreen();

    await waitFor(() => expect(screen.getByTestId('pie-data')).toBeTruthy());

    // Slice colors come from the shared palette in declaration order.
    const slices = screen.getByTestId('pie-data').props.children as string;
    expect(slices).toContain(`Wanderer:${CHART_PALETTE[0]}`);
    expect(slices).toContain(`Scholar:${CHART_PALETTE[1]}`);

    // The legend must agree — it used to rebuild the palette independently.
    const legendSwatches = screen
      .UNSAFE_getAllByType(Text)
      .map(node => node.props.children)
      .filter((child): child is string => typeof child === 'string');
    expect(legendSwatches.join(' ')).toContain('Wanderer');
  });

  it('counts characters per archetype', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => expect(getByText('Total Characters: 3')).toBeTruthy());
    expect(getByText(/Wanderer: 2/)).toBeTruthy();
    expect(getByText(/Scholar: 1/)).toBeTruthy();
  });
});
