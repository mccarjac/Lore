import type { AttributeBag, Modifier } from '@/ruleset/types';

export interface GameLocation {
  id: string;
  name: string;
  description: string;
  imageUris?: string[];
  mapCoordinates?: {
    x: number; // Normalized coordinate (0-1) representing position on map
    y: number; // Normalized coordinate (0-1) representing position on map
  };
  createdAt: string;
  updatedAt: string;
}

export interface LocationDataset {
  locations: GameLocation[];
  version: string;
  lastUpdated: string;
}

export enum RelationshipStanding {
  Ally = 'Ally',
  Friend = 'Friend',
  Neutral = 'Neutral',
  Hostile = 'Hostile',
  Enemy = 'Enemy',
}

export const POSITIVE_RELATIONSHIP_TYPE: RelationshipStanding[] = [
  RelationshipStanding.Ally,
  RelationshipStanding.Friend,
];

export const NEGATIVE_RELATIONSHIP_TYPE: RelationshipStanding[] = [
  RelationshipStanding.Hostile,
  RelationshipStanding.Enemy,
];

export interface Faction {
  name: string;
  standing: RelationshipStanding;
  description?: string;
}

export interface Relationship {
  characterName: string;
  relationshipType: RelationshipStanding;
  description?: string;
  customName?: string;
}

/**
 * An inline, per-character facet entry — the shape of a hand-authored
 * catalog entry (`authored: true` on its `FacetCollection`), such as what the
 * Afterworlds ruleset calls Cyberware. Authored per character rather than
 * picked from a ruleset catalog, which is how it has always worked for
 * modifications; a catalog could come later for other collections.
 */
export interface AuthoredFacetEntry {
  name: string;
  description?: string;
  modifier?: Modifier;
}

/**
 * A character's selections in one facet collection: catalog entry ids for a
 * `FacetCollection` picked from `entries`, or inline `AuthoredFacetEntry`
 * objects for one declared `authored: true`. A `selection: 'single'`
 * collection stores an array of 0 or 1 id.
 */
export type FacetValue = string | AuthoredFacetEntry;

export interface GameCharacter {
  id: string;
  name: string;
  /**
   * collectionId -> the character's selections in that
   * `RulesetDefinition.facets[]` entry. Replaces the pre-#51 `archetypeId` /
   * `traitIds` / `qualityIds` / `modifications` fields — one shape for
   * however many facet collections a ruleset declares.
   * `migrateRulesetFields()` rewrites stored data from the old shape, driven
   * by each collection's `legacyField`.
   */
  facets?: Record<string, FacetValue[]>;
  /**
   * Character-specific attribute values, keyed by
   * `RulesetDefinition.attributes[].id` (#22). These are *absolute* values
   * that override a `stage: 'base'` facet entry's own — a GM-defined
   * "Corruption" counter, or a per-character base stat. Deltas are what
   * facet entries are for. Optional: a ruleset need declare no character
   * attributes.
   */
  attributes?: AttributeBag;
  factions: Faction[];
  relationships: Relationship[];
  imageUris?: string[];
  notes?: string;
  locationId?: string; // Reference to GameLocation.id
  occupation?: string;
  present?: boolean;
  retired?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterDataset {
  characters: GameCharacter[];
  version: string;
  lastUpdated: string;
}

export type CharacterFormData = Omit<
  GameCharacter,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface GameEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date string
  time?: string; // Optional time in HH:MM format
  locationId?: string; // Reference to GameLocation.id
  characterIds?: string[]; // References to GameCharacter.id
  factionNames?: string[]; // Faction names involved in the event
  questIds?: string[]; // References to GameQuest.id
  notes?: string;
  imageUris?: string[];
  certaintyLevel?: CertaintyLevel; // Certainty level: unconfirmed, confirmed, or disputed
  createdAt: string;
  updatedAt: string;
}

export interface EventDataset {
  events: GameEvent[];
  version: string;
  lastUpdated: string;
}

export type CertaintyLevel = 'unconfirmed' | 'confirmed' | 'disputed';

// Quest / Mission Management
export enum QuestStatus {
  NotStarted = 'NOTSTARTED',
  Assigned = 'ASSIGNED',
  InProgress = 'INPROGRESS',
  Successful = 'SUCCESSFUL',
  Failure = 'FAILURE',
}

export interface QuestMaterial {
  id: string;
  name: string;
  quantityRequired: number;
  quantityProvided: number;
}

/**
 * A quest's preferred (or unwanted) facet selections — the generalized form
 * of the pre-#51 four parallel id lists (`archetypeIds`/`traitIds`/
 * `qualityIds`/`traitCategoryIds`), now one map per collection instead of one
 * field per collection kind.
 */
export interface QuestFacetPreferences {
  /** collectionId -> entry ids. */
  entries?: Record<string, string[]>;
  /** collectionId -> category ids (for a collection with `categories`). */
  categories?: Record<string, string[]>;
}

export interface GameQuest {
  id: string;
  name: string;
  details?: string;
  date?: string; // ISO date string (YYYY-MM-DD), optional time of mission
  time?: string; // Optional time in HH:MM format
  status: QuestStatus;
  assignedCharacterIds?: string[]; // References to GameCharacter.id
  desirable?: QuestFacetPreferences;
  undesirable?: QuestFacetPreferences;
  locationId?: string; // Reference to GameLocation.id
  factionNames?: string[]; // Faction names related to the quest
  eventIds?: string[]; // References to GameEvent.id
  sponsor?: string; // Who commissioned the quest (free text)
  requiredMaterials?: QuestMaterial[];
  teamSize?: number; // Desired team size for proposal generation
  notes?: string;
  imageUris?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestDataset {
  quests: GameQuest[];
  version: string;
  lastUpdated: string;
}

export type QuestFormData = Omit<GameQuest, 'id' | 'createdAt' | 'updatedAt'>;

// Discord Integration Types
export interface DiscordServerConfig {
  id: string; // Unique ID for this server/channel config
  name: string; // User-friendly name for this server/channel
  botToken: string; // Discord bot token (can be same across configs)
  guildId?: string; // Discord server ID (optional)
  channelId: string; // Discord channel ID
  enabled: boolean; // Whether this specific config is enabled
  lastSync?: string; // ISO timestamp of last sync for this channel
  createdAt: string;
  updatedAt: string;
}

export interface DiscordConfig {
  botToken?: string; // Legacy: Primary bot token (deprecated, use serverConfigs)
  guildId?: string; // Legacy: Discord server ID (deprecated)
  channelId?: string; // Legacy: Discord channel ID (deprecated)
  enabled: boolean; // Global enable/disable for Discord integration
  lastSync?: string; // Legacy: ISO timestamp of last sync (deprecated)
  autoSync: boolean; // Auto-sync when internet is available
  serverConfigs: DiscordServerConfig[]; // Multiple server/channel configurations
}

export interface DiscordUserMapping {
  discordUserId: string; // Discord user ID
  discordUsername: string; // Discord username for display
  characterId: string; // GameCharacter.id
  createdAt: string;
  updatedAt: string;
}

export interface DiscordMessage {
  id: string; // Discord message ID
  channelId: string; // Discord channel ID
  guildId?: string; // Discord server/guild ID (for organization)
  serverConfigId?: string; // Reference to DiscordServerConfig.id
  authorId: string; // Discord user ID
  authorUsername: string; // Discord username
  content: string; // Message content
  timestamp: string; // ISO timestamp
  characterId?: string; // Mapped character ID (if available)
  extractedCharacterName?: string; // Character name extracted from >[Name] format
  imageUris?: string[]; // Downloaded image URIs
  attachments?: DiscordAttachment[]; // Original attachment metadata
  createdAt: string; // When stored locally
  ignored?: boolean; // Whether to ignore this message (not from any character)
}

export interface DiscordCharacterAlias {
  alias: string; // The nickname or shortened name
  characterId: string; // The actual character ID it maps to
  discordUserId: string; // The Discord user who uses this alias
  confidence: number; // How confident we are in this mapping (0-1)
  usageCount: number; // How many times this alias has been used
  createdAt: string;
  updatedAt: string;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  contentType?: string;
  size: number;
}

export interface DiscordDataset {
  config: DiscordConfig;
  serverConfigs?: DiscordServerConfig[]; // For export/import of multi-server configs
  userMappings: DiscordUserMapping[];
  messages: DiscordMessage[];
  characterAliases: DiscordCharacterAlias[];
  version: string;
  lastUpdated: string;
}
