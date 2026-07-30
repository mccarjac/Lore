import {
  GameCharacter,
  GameLocation,
  GameEvent,
  GameQuest,
} from '@models/types';
import type {
  FilterFieldConfig,
  FilterValues,
} from '@/components/search/filterFieldTypes';

export type RootDrawerParamList = {
  GlobalSearch: undefined;
  CharacterList: undefined;
  DataManagement: undefined;
  Factions: undefined;
  Locations: undefined;
  Events: undefined;
  Quests: undefined;
  InfluenceReport: undefined;
  RelationshipGraph: undefined;
  DiscordConfig: undefined;
  DiscordServers: undefined;
  DiscordCharacterMapping: undefined;
  DiscordMessages: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  AdvancedSearch: {
    title: string;
    fields: FilterFieldConfig[];
    initialValues: FilterValues;
    onApply: (values: FilterValues) => void;
  };
  CharacterStats: undefined;
  FactionStats: undefined;
  FactionDetails: { factionName: string };
  FactionForm: { factionName?: string };
  LocationDetails: { locationId: string };
  LocationForm: { location?: GameLocation };
  LocationMap: undefined;
  CharacterForm: {
    character?: GameCharacter;
    onSubmit?: (character: GameCharacter) => void;
  };
  CharacterDetail: { character: GameCharacter };
  EventsTimeline: undefined;
  EventsForm: { event?: GameEvent };
  EventsDetail: { eventId: string };
  QuestsList: undefined;
  QuestsForm: { quest?: GameQuest };
  QuestsDetail: { questId: string };
  QuestProposals: undefined;
  DiscordMessageContext: { messageId: string; characterId?: string };
  DiscordServerForm: { serverConfigId?: string };
};
