/**
 * A small example campaign for `exampleRuleset` (#51).
 *
 * Every statistics screen (`CharacterStatsScreen`, `FactionStatsScreen`,
 * `InfluenceReportScreen`, the relationship graph) is empty on a fresh
 * install, which makes them impossible to eyeball in a running app. This
 * dataset exists so `npm run web` plus "Load Example Campaign" (see
 * `src/datastores/seed/index.ts`) produces real numbers everywhere: every
 * facet collection has holders, both trait categories clear the
 * `categoryBonuses` threshold at least once, factions have a real
 * ally/enemy network, and quests exercise both `desirable` and
 * `undesirable` preferences.
 *
 * Deliberately plain data — no functions, no `new Date()` — so it is
 * deterministic and safe to export from `headless.ts` alongside
 * `exampleRuleset` itself. Ids and timestamps are fixed rather than
 * generated, which is also what keeps a JSON round-trip of this file
 * diff-free.
 *
 * Shaped like `SyncDataset` (`src/utils/syncMerge.ts`) structurally, without
 * importing it — that module pulls in `characterStorage.ts`, which is not
 * RN-free, and this file has to stay importable from `headless.ts`.
 */
import {
  QuestStatus,
  type GameCharacter,
  type GameEvent,
  type GameLocation,
  type GameQuest,
  type Relationship,
} from '@models/types';
import { num, text } from './attributes';

/** Structurally `FactionRelationship` (`@utils/characterStorage`), duplicated
 * to avoid importing a non-RN-free module from here. */
export interface SeedFactionRelationship {
  factionName: string;
  relationshipTypeId: string;
  description?: string;
}

/** Structurally `StoredFaction` (`@utils/characterStorage`), same reason. */
export interface SeedFaction {
  name: string;
  description: string;
  relationships?: SeedFactionRelationship[];
  retired?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Structurally `SyncDataset` (`@utils/syncMerge`), same reason. */
export interface SeedDataset {
  characters: GameCharacter[];
  factions: SeedFaction[];
  locations: GameLocation[];
  events: GameEvent[];
  quests: GameQuest[];
  version: string;
  lastUpdated: string;
}

const T = '2026-01-05T12:00:00.000Z';

const relationship = (
  characterName: string,
  relationshipTypeId: string,
  description?: string
): Relationship => ({ characterName, relationshipTypeId, description });

// --- Locations ---------------------------------------------------------

const locations: GameLocation[] = [
  {
    id: 'loc-ashfall-hold',
    name: 'Ashfall Hold',
    description: 'A fortified hilltop settlement and the Wardens’ seat.',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'loc-the-warren',
    name: 'The Warren',
    description: 'A dense market quarter where the Artisans keep their shops.',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'loc-millbrook-circle',
    name: 'Millbrook Circle',
    description: 'A ring of old mills, now the Drifters’ informal camp.',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'loc-sable-reach',
    name: 'Sable Reach',
    description:
      'Open country between the settlements, contested and unmapped.',
    createdAt: T,
    updatedAt: T,
  },
];

// --- Characters ---------------------------------------------------------
//
// Twelve characters spread across all three archetypes, both trait
// categories (with two Wardens holding both body traits to clear the
// `requiredScore: 2` bonus), qualities up to the collection's
// `maxSelections`, two authored modifications (one with an attribute delta,
// one with both an attribute and a category delta), an attendance/retired
// mix, and one character-attribute override.

const characters: GameCharacter[] = [
  {
    id: 'char-mira-hale',
    name: 'Mira Hale',
    facets: {
      archetypes: ['warden'],
      traits: ['tough', 'warden_kit'],
      qualities: ['curious'],
      modifications: [],
      attendance: ['present'],
    },
    factions: [{ name: "Wardens' Guild", relationshipTypeId: 'ally' }],
    relationships: [relationship('Corwin Ashe', 'friend', 'Trained together.')],
    locationId: 'loc-ashfall-hold',
    occupation: 'Gate Captain',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-corwin-ashe',
    name: 'Corwin Ashe',
    facets: {
      archetypes: ['warden'],
      traits: ['tough', 'warden_kit'],
      qualities: ['stubborn'],
      modifications: [],
      attendance: ['present'],
    },
    factions: [{ name: "Wardens' Guild", relationshipTypeId: 'ally' }],
    relationships: [relationship('Mira Hale', 'friend', 'Trained together.')],
    locationId: 'loc-ashfall-hold',
    occupation: 'Watch Sergeant',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-petra-voss',
    name: 'Petra Voss',
    facets: {
      archetypes: ['warden'],
      traits: ['warden_kit'],
      qualities: [],
      modifications: [],
      attendance: ['absent'],
    },
    factions: [{ name: "Wardens' Guild", relationshipTypeId: 'friend' }],
    relationships: [],
    locationId: 'loc-ashfall-hold',
    occupation: 'Quartermaster',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-callum-bright',
    name: 'Callum Bright',
    facets: {
      archetypes: ['warden'],
      traits: ['tough'],
      qualities: [],
      modifications: [],
      attendance: ['present'],
    },
    factions: [{ name: 'Free Folk Coalition', relationshipTypeId: 'ally' }],
    relationships: [],
    locationId: 'loc-sable-reach',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-dez-okafor',
    name: 'Dez Okafor',
    facets: {
      archetypes: ['artisan'],
      traits: ['studied'],
      qualities: ['curious', 'stubborn'],
      modifications: [
        {
          name: 'Reinforced Gloves',
          description: 'Sturdy work gloves, patched more than once.',
          modifier: { attributeDeltas: { stamina: 1 } },
        },
      ],
      attendance: ['present'],
    },
    factions: [{ name: "Artisans' Circle", relationshipTypeId: 'ally' }],
    relationships: [relationship('Yuki Tanaka', 'ally', 'Business partners.')],
    locationId: 'loc-the-warren',
    occupation: 'Smith',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-yuki-tanaka',
    name: 'Yuki Tanaka',
    facets: {
      archetypes: ['artisan'],
      traits: ['studied'],
      qualities: [],
      modifications: [],
      attendance: ['present'],
    },
    attributes: {
      background: text('Trained as a cartographer before the fall.'),
    },
    factions: [{ name: "Artisans' Circle", relationshipTypeId: 'ally' }],
    relationships: [relationship('Dez Okafor', 'ally', 'Business partners.')],
    locationId: 'loc-the-warren',
    occupation: 'Cartographer',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-bram-solt',
    name: 'Bram Solt',
    facets: {
      archetypes: ['artisan'],
      traits: ['tough'],
      qualities: ['curious'],
      modifications: [],
      attendance: ['absent'],
    },
    factions: [{ name: "Artisans' Circle", relationshipTypeId: 'friend' }],
    relationships: [],
    locationId: 'loc-the-warren',
    retired: true,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-sable-quinn',
    name: 'Sable Quinn',
    facets: {
      archetypes: ['artisan'],
      traits: [],
      qualities: [],
      modifications: [],
      attendance: ['present'],
    },
    factions: [{ name: 'Free Folk Coalition', relationshipTypeId: 'ally' }],
    relationships: [],
    locationId: 'loc-sable-reach',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-nadia-reyes',
    name: 'Nadia Reyes',
    facets: {
      archetypes: ['drifter'],
      traits: [],
      qualities: ['stubborn'],
      modifications: [],
      attendance: ['present'],
    },
    factions: [{ name: "Drifters' Union", relationshipTypeId: 'ally' }],
    relationships: [
      relationship('Otis Kane', 'enemy', 'Old grudge over a bad trade.'),
    ],
    locationId: 'loc-millbrook-circle',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-otis-kane',
    name: 'Otis Kane',
    facets: {
      archetypes: ['drifter'],
      traits: ['tough'],
      qualities: [],
      modifications: [
        {
          name: 'Scavenged Plating',
          description: 'Mismatched armor plates, welded on in a hurry.',
          modifier: {
            attributeDeltas: { staminaCap: 2 },
            categoryDeltas: { traits: { body: 1 } },
          },
        },
      ],
      attendance: ['present'],
    },
    factions: [{ name: "Drifters' Union", relationshipTypeId: 'ally' }],
    relationships: [
      relationship('Nadia Reyes', 'enemy', 'Old grudge over a bad trade.'),
    ],
    locationId: 'loc-millbrook-circle',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-ilse-fenwick',
    name: 'Ilse Fenwick',
    facets: {
      archetypes: ['drifter'],
      traits: ['studied'],
      qualities: ['curious'],
      modifications: [],
      attendance: ['absent'],
    },
    factions: [{ name: "Drifters' Union", relationshipTypeId: 'friend' }],
    relationships: [],
    locationId: 'loc-millbrook-circle',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'char-talia-marsh',
    name: 'Talia Marsh',
    facets: {
      archetypes: ['drifter'],
      traits: ['tough'],
      qualities: ['stubborn'],
      modifications: [],
      attendance: ['present'],
    },
    attributes: { resolve: num(5) },
    factions: [{ name: 'The Watch', relationshipTypeId: 'ally' }],
    relationships: [],
    locationId: 'loc-sable-reach',
    retired: true,
    createdAt: T,
    updatedAt: T,
  },
];

// --- Factions -------------------------------------------------------------
//
// Five factions with reciprocal relationships across the standing range, so
// the influence report and relationship graph have a real network.

const factions: SeedFaction[] = [
  {
    name: "Wardens' Guild",
    description: 'Keeps the peace and mans the walls of Ashfall Hold.',
    relationships: [
      {
        factionName: "Artisans' Circle",
        relationshipTypeId: 'ally',
        description: 'Trade weapons and armor for tools.',
      },
      {
        factionName: "Drifters' Union",
        relationshipTypeId: 'hostile',
        description: 'Disputes over toll roads.',
      },
    ],
    createdAt: T,
    updatedAt: T,
  },
  {
    name: "Artisans' Circle",
    description: 'Craftspeople and traders based out of the Warren.',
    relationships: [
      {
        factionName: "Wardens' Guild",
        relationshipTypeId: 'ally',
        description: 'Trade weapons and armor for tools.',
      },
      {
        factionName: 'Free Folk Coalition',
        relationshipTypeId: 'friend',
        description: 'Buy raw materials from Free Folk scouts.',
      },
    ],
    createdAt: T,
    updatedAt: T,
  },
  {
    name: "Drifters' Union",
    description: 'Loosely organized travelers camped at Millbrook Circle.',
    relationships: [
      {
        factionName: "Wardens' Guild",
        relationshipTypeId: 'hostile',
        description: 'Disputes over toll roads.',
      },
      {
        factionName: 'The Watch',
        relationshipTypeId: 'enemy',
        description: 'The Watch accuses the Union of banditry.',
      },
    ],
    createdAt: T,
    updatedAt: T,
  },
  {
    name: 'Free Folk Coalition',
    description: 'Independent settlers scattered across Sable Reach.',
    relationships: [
      {
        factionName: "Artisans' Circle",
        relationshipTypeId: 'friend',
        description: 'Buy raw materials from Free Folk scouts.',
      },
      {
        factionName: 'The Watch',
        relationshipTypeId: 'neutral',
        description: 'Wary but not openly hostile.',
      },
    ],
    createdAt: T,
    updatedAt: T,
  },
  {
    name: 'The Watch',
    description: 'A self-appointed patrol operating out of Sable Reach.',
    relationships: [
      {
        factionName: "Drifters' Union",
        relationshipTypeId: 'enemy',
        description: 'The Watch accuses the Union of banditry.',
      },
      {
        factionName: 'Free Folk Coalition',
        relationshipTypeId: 'neutral',
        description: 'Wary but not openly hostile.',
      },
    ],
    createdAt: T,
    updatedAt: T,
  },
];

// --- Events -----------------------------------------------------------

const events: GameEvent[] = [
  {
    id: 'event-toll-dispute',
    title: 'Toll Road Dispute',
    description: 'Wardens turned back a Drifter caravan at the Ashfall gate.',
    date: '2025-11-02',
    locationId: 'loc-ashfall-hold',
    characterIds: ['char-mira-hale', 'char-nadia-reyes'],
    factionNames: ["Wardens' Guild", "Drifters' Union"],
    certaintyLevel: 'confirmed',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'event-warren-market-day',
    title: 'Warren Market Day',
    description: 'Quarterly trade fair; Free Folk scouts sold pelts and ore.',
    date: '2025-11-10',
    locationId: 'loc-the-warren',
    characterIds: ['char-dez-okafor', 'char-yuki-tanaka', 'char-sable-quinn'],
    factionNames: ["Artisans' Circle", 'Free Folk Coalition'],
    certaintyLevel: 'confirmed',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'event-millbrook-fire',
    title: 'Fire at Millbrook Circle',
    description: 'One of the old mills burned overnight; cause unclear.',
    date: '2025-11-14',
    locationId: 'loc-millbrook-circle',
    characterIds: ['char-otis-kane', 'char-ilse-fenwick'],
    factionNames: ["Drifters' Union"],
    certaintyLevel: 'disputed',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'event-watch-patrol',
    title: 'Watch Patrol Ambushed',
    description: 'A Watch patrol was turned back on the road to Sable Reach.',
    date: '2025-11-18',
    locationId: 'loc-sable-reach',
    characterIds: ['char-talia-marsh'],
    factionNames: ['The Watch'],
    certaintyLevel: 'unconfirmed',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'event-gate-repair',
    title: 'Ashfall Gate Repaired',
    description: 'The Circle finished reinforcing the north gate.',
    date: '2025-11-22',
    locationId: 'loc-ashfall-hold',
    characterIds: ['char-corwin-ashe', 'char-dez-okafor'],
    factionNames: ["Wardens' Guild", "Artisans' Circle"],
    certaintyLevel: 'confirmed',
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'event-coalition-gathering',
    title: 'Free Folk Gathering',
    description: 'A seasonal gathering to divide territory for the winter.',
    date: '2025-11-27',
    locationId: 'loc-sable-reach',
    characterIds: ['char-callum-bright', 'char-sable-quinn'],
    factionNames: ['Free Folk Coalition'],
    certaintyLevel: 'confirmed',
    createdAt: T,
    updatedAt: T,
  },
];

// --- Quests -------------------------------------------------------------

const quests: GameQuest[] = [
  {
    id: 'quest-escort-caravan',
    name: 'Escort the Trade Caravan',
    details: 'Guide an Artisan caravan through Sable Reach without incident.',
    status: QuestStatus.NotStarted,
    desirable: {
      entries: { archetypes: ['warden'], traits: ['tough'] },
      categories: { traits: ['body'] },
    },
    undesirable: {
      entries: { qualities: ['stubborn'] },
    },
    locationId: 'loc-sable-reach',
    factionNames: ["Artisans' Circle"],
    sponsor: "Artisans' Circle",
    requiredMaterials: [
      {
        id: 'mat-escort-rations',
        name: 'Trail rations',
        quantityRequired: 10,
        quantityProvided: 4,
      },
    ],
    teamSize: 3,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'quest-investigate-fire',
    name: 'Investigate the Millbrook Fire',
    details:
      'Determine whether the fire at Millbrook Circle was set deliberately.',
    status: QuestStatus.InProgress,
    assignedCharacterIds: ['char-ilse-fenwick'],
    desirable: {
      entries: { traits: ['studied'], qualities: ['curious'] },
      categories: { traits: ['mind'] },
    },
    locationId: 'loc-millbrook-circle',
    factionNames: ["Drifters' Union"],
    eventIds: ['event-millbrook-fire'],
    sponsor: "Drifters' Union",
    teamSize: 2,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: 'quest-broker-peace',
    name: 'Broker Peace with the Wardens',
    details: 'Negotiate an end to the toll road dispute before winter.',
    status: QuestStatus.Assigned,
    assignedCharacterIds: ['char-mira-hale', 'char-nadia-reyes'],
    desirable: {
      entries: { archetypes: ['warden', 'drifter'] },
    },
    undesirable: {
      entries: { traits: ['tough'] },
    },
    locationId: 'loc-ashfall-hold',
    factionNames: ["Wardens' Guild", "Drifters' Union"],
    eventIds: ['event-toll-dispute'],
    sponsor: "Wardens' Guild",
    teamSize: 2,
    createdAt: T,
    updatedAt: T,
  },
];

export const exampleSeedDataset: SeedDataset = {
  characters,
  factions,
  locations,
  events,
  quests,
  version: '1.0',
  lastUpdated: T,
};
