import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { EventsDetailScreen } from '@screens/events/EventsDetailScreen';
import { describeDetailScreenContract } from '../../helpers/screenContracts';
import { getStorageMock, primeStorageDefaults } from '../../helpers/storage';
import { makeCharacter, makeEvent, makeQuest } from '../../helpers/factories';
import { QuestStatus } from '@models/types';
import {
  installNavigationMock,
  installRouteParams,
  resetNavigationMocks,
  NavMock,
} from '../../helpers/navigation';
import { renderWithRuleset } from '../../helpers/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';

jest.mock('@utils/characterStorage');

const storage = getStorageMock();
const EVENT_ID = 'event-1';
const event = makeEvent({ id: EVENT_ID, title: 'The Great Fire' });

describeDetailScreenContract({
  name: 'EventsDetailScreen',
  renderScreen: () => render(<EventsDetailScreen />),
  routeParams: { eventId: EVENT_ID },
  prime: () => {
    storage.loadEvents.mockResolvedValue([event]);
  },
  expectedContent: ['The Great Fire', 'Confirmed', 'Date:'],
  edit: {
    expectedScreen: 'EventsForm',
    expectedParams: {
      event: {
        ...event,
        characterNames: [],
        quests: [],
        relatedCharacters: [],
      },
    },
  },
  del: {
    deleteFn: () => storage.deleteEvent,
    primeDelete: () => {
      storage.deleteEvent.mockResolvedValue(true);
    },
  },
});

describe('EventsDetailScreen — narrative thread', () => {
  let nav: NavMock;

  beforeEach(() => {
    jest.clearAllMocks();
    primeStorageDefaults();
    nav = installNavigationMock();
    installRouteParams({ eventId: EVENT_ID });
  });

  afterEach(() => {
    resetNavigationMocks();
  });

  it('lists the quests the event belongs to and navigates to one on tap', async () => {
    const quest = makeQuest({
      id: 'quest-1',
      name: 'Recover the Cargo',
      status: QuestStatus.InProgress,
    });
    const linkedEvent = makeEvent({
      id: EVENT_ID,
      title: 'The Great Fire',
      questIds: [quest.id],
    });

    storage.loadEvents.mockResolvedValue([linkedEvent]);
    storage.loadQuests.mockResolvedValue([quest]);

    const { getByText } = render(<EventsDetailScreen />);

    await waitFor(() => {
      expect(getByText('Recover the Cargo')).toBeTruthy();
    });
    expect(getByText('In Progress')).toBeTruthy();

    fireEvent.press(getByText('Recover the Cargo'));

    expect(nav.navigate).toHaveBeenCalledWith('QuestsDetail', {
      questId: quest.id,
    });
  });

  it('hides the quest section when the ruleset has quests off', async () => {
    // QuestsDetail is unregistered under such a ruleset, so leaving the
    // section visible would give the user a tap that throws.
    const quest = makeQuest({ id: 'quest-1', name: 'Recover the Cargo' });
    const linkedEvent = makeEvent({
      id: EVENT_ID,
      title: 'The Great Fire',
      questIds: [quest.id],
    });

    storage.loadEvents.mockResolvedValue([linkedEvent]);
    storage.loadQuests.mockResolvedValue([quest]);

    const { getByText, queryByText } = renderWithRuleset(
      <EventsDetailScreen />,
      { ruleset: genericRuleset }
    );

    await waitFor(() => expect(getByText('The Great Fire')).toBeTruthy());
    expect(queryByText('Recover the Cargo')).toBeNull();
  });

  it('shows characters with a typed event relationship and navigates to one on tap', async () => {
    // Discovered by scanning GameCharacter.eventRelationships (#50) — distinct
    // from the plain "Characters Involved" list, which comes from
    // GameEvent.characterIds.
    const witness = makeCharacter({
      id: 'char-witness',
      name: 'Nadia Reyes',
      eventRelationships: [
        { eventId: EVENT_ID, relationshipTypeId: 'witness' },
      ],
    });

    storage.loadEvents.mockResolvedValue([event]);
    storage.loadCharacters.mockResolvedValue([witness]);

    const { getByText } = render(<EventsDetailScreen />);

    await waitFor(() => expect(getByText('Nadia Reyes')).toBeTruthy());
    expect(getByText('Witness')).toBeTruthy();

    fireEvent.press(getByText('Nadia Reyes'));

    expect(nav.navigate).toHaveBeenCalledWith('CharacterDetail', {
      character: witness,
    });
  });

  it('omits the Related Characters section when no character has one', async () => {
    storage.loadEvents.mockResolvedValue([event]);
    storage.loadCharacters.mockResolvedValue([makeCharacter()]);

    const { getByText, queryByText } = render(<EventsDetailScreen />);

    await waitFor(() => expect(getByText('The Great Fire')).toBeTruthy());
    expect(queryByText('Related Characters')).toBeNull();
  });
});
