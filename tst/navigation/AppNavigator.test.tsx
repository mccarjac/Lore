import React from 'react';
import { renderWithRuleset } from '../helpers/ruleset';
import { genericRuleset } from '../fixtures/genericRuleset';
import { afterworldsRuleset } from '@/rulesets/afterworlds';

/**
 * The navigator factories are replaced with pass-throughs that surface each
 * registered route's `name` as text. That is exactly what #10 changed —
 * *which* routes exist — and it avoids mounting twenty real screens (and
 * their storage mocks) to find out.
 *
 * `drawerContent` is likewise surfaced so the drawer's item list, which is
 * registered independently of the Drawer.Screen list, is testable too.
 */
// The navigator imports every screen, which transitively reaches
// gitIntegration. A bare automock would load the real @octokit/rest and fail
// on its ESM `universal-user-agent` dependency (see AGENTS.md → Testing).
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('@utils/characterStorage');

jest.mock('@react-navigation/drawer', () => {
  const ReactActual = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    createDrawerNavigator: () => ({
      Navigator: ({
        children,
        drawerContent,
      }: {
        children: React.ReactNode;
        drawerContent?: (props: unknown) => React.ReactNode;
      }) =>
        ReactActual.createElement(
          RN.View,
          null,
          children,
          drawerContent?.({
            state: { routes: [{ name: 'CharacterList' }], index: 0 },
            navigation: { navigate: jest.fn() },
            descriptors: {},
          })
        ),
      Screen: ({ name }: { name: string }) =>
        ReactActual.createElement(RN.Text, null, `drawer:${name}`),
    }),
    DrawerContentScrollView: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(RN.View, null, children),
    DrawerItem: ({ label }: { label: string }) =>
      ReactActual.createElement(RN.Text, null, `item:${label}`),
  };
});

jest.mock('@react-navigation/stack', () => {
  const ReactActual = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    ...jest.requireActual('@react-navigation/stack'),
    createStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) =>
        ReactActual.createElement(RN.View, null, children),
      Screen: ({ name }: { name: string }) =>
        ReactActual.createElement(RN.Text, null, `stack:${name}`),
    }),
  };
});

// Imported after the mocks so the navigators are built from them.
import { AppNavigator, MainDrawer } from '@/navigation/AppNavigator';

const renderNav = (ruleset = afterworldsRuleset) =>
  renderWithRuleset(<AppNavigator />, { ruleset });

/**
 * The drawer is registered as `component={MainDrawer}` on a stack screen, so
 * the stack render never reaches it — it gets its own render.
 */
const renderDrawer = (ruleset = afterworldsRuleset) =>
  renderWithRuleset(<MainDrawer />, { ruleset });

describe('AppNavigator — the Afterworlds ruleset (behavior preservation)', () => {
  it('registers every drawer screen', () => {
    const { getByText } = renderDrawer();

    [
      'GlobalSearch',
      'CharacterList',
      'Factions',
      'Locations',
      'Events',
      'Quests',
      'InfluenceReport',
      'RelationshipGraph',
      'DataManagement',
      'DiscordConfig',
      'DiscordServers',
      'DiscordCharacterMapping',
      'DiscordMessages',
    ].forEach(name => expect(getByText(`drawer:${name}`)).toBeTruthy());
  });

  it('registers every stack screen', () => {
    const { getByText } = renderNav();

    [
      'Main',
      'CharacterDetail',
      'CharacterForm',
      'CharacterSearch',
      'CharacterStats',
      'FactionStats',
      'FactionDetails',
      'FactionForm',
      'LocationDetails',
      'LocationForm',
      'LocationMap',
      'EventsTimeline',
      'EventsForm',
      'EventsDetail',
      'QuestsList',
      'QuestsForm',
      'QuestsDetail',
      'QuestProposals',
      'DiscordMessageContext',
      'DiscordServerForm',
    ].forEach(name => expect(getByText(`stack:${name}`)).toBeTruthy());
  });

  it('shows every drawer item', () => {
    const { getByText } = renderDrawer();

    [
      'Search',
      'Characters',
      'Factions',
      'Locations',
      'Events',
      'Quests',
      'Influence Report',
      'Relationship Graph',
      'Data Management',
    ].forEach(label => expect(getByText(`item:${label}`)).toBeTruthy());
  });
});

describe('AppNavigator — a ruleset with features disabled', () => {
  it('drops the drawer screens for disabled features', () => {
    const { queryByText, getByText } = renderDrawer(genericRuleset);

    // quests, discord and influenceReport are off in the fixture.
    expect(queryByText('drawer:Quests')).toBeNull();
    expect(queryByText('drawer:InfluenceReport')).toBeNull();
    expect(queryByText('drawer:DiscordConfig')).toBeNull();
    expect(queryByText('drawer:DiscordServers')).toBeNull();
    expect(queryByText('drawer:DiscordCharacterMapping')).toBeNull();
    expect(queryByText('drawer:DiscordMessages')).toBeNull();

    // relationshipGraph is on, so it survives.
    expect(getByText('drawer:RelationshipGraph')).toBeTruthy();
    // Core screens are never gated.
    expect(getByText('drawer:CharacterList')).toBeTruthy();
  });

  it('drops the drawer items too, not just the registrations', () => {
    const { queryByText, getByText } = renderDrawer(genericRuleset);

    // The drawer item list is maintained separately from the screen list, so
    // hiding one without the other is the easy mistake here.
    expect(queryByText('item:Quests')).toBeNull();
    expect(queryByText('item:Influence Report')).toBeNull();
    expect(getByText('item:Relationship Graph')).toBeTruthy();
  });

  it('drops the quest, discord and map stack routes', () => {
    const { queryByText, getByText } = renderNav(genericRuleset);

    ['QuestsList', 'QuestsForm', 'QuestsDetail', 'QuestProposals'].forEach(
      name => expect(queryByText(`stack:${name}`)).toBeNull()
    );
    expect(queryByText('stack:DiscordMessageContext')).toBeNull();
    expect(queryByText('stack:DiscordServerForm')).toBeNull();
    expect(queryByText('stack:LocationMap')).toBeNull();

    expect(getByText('stack:CharacterDetail')).toBeTruthy();
    expect(getByText('stack:EventsDetail')).toBeTruthy();
  });
});
