import {
  calculateFactionStats as calculateFactionStatsWith,
  calculateCombinedFactionStats as calculateCombinedFactionStatsWith,
  getAllFactionStats as getAllFactionStatsWith,
  type FactionStats,
} from '@/utils/factionStats';
import { GameCharacter } from '@/models/types';
import { FactionRelationship } from '@/utils/characterStorage';
import { makeCharacter } from '../helpers/factories';
import { mechanicsRuleset } from '../fixtures/mechanicsRuleset';

/**
 * Faction aggregation consults the ruleset for facet categories and for
 * turning ids into names, so it runs against the neutral fixture — the counts
 * themselves are ruleset-independent and the labels must not be Afterworlds'.
 */
const calculateFactionStats = (
  factionName: string,
  characters: GameCharacter[],
  relationships: FactionRelationship[] = []
) =>
  calculateFactionStatsWith(
    factionName,
    characters,
    relationships,
    mechanicsRuleset
  );

const calculateCombinedFactionStats = (
  factionName: string,
  characters: GameCharacter[],
  relationships: Map<string, FactionRelationship[]>
) =>
  calculateCombinedFactionStatsWith(
    factionName,
    characters,
    relationships,
    mechanicsRuleset
  );

const getAllFactionStats = (
  characters: GameCharacter[],
  relationships: Map<string, FactionRelationship[]>
) => getAllFactionStatsWith(characters, relationships, mechanicsRuleset);

const collectionStats = (stats: FactionStats, collectionId: string) =>
  stats.facetCollections.find(c => c.collectionId === collectionId)!;

describe('factionStats', () => {
  describe('calculateFactionStats', () => {
    it('returns empty stats when the faction has no members', () => {
      const stats = calculateFactionStats('Brotherhood', []);

      expect(stats).toEqual({
        factionName: 'Brotherhood',
        totalMembers: 0,
        presentMembers: 0,
        facetCollections: [],
        relationships: [],
        alliedFactions: [],
        enemyFactions: [],
      });
    });

    it('only counts positive-role standings as members, ignoring neutral/negative', () => {
      const characters: GameCharacter[] = [
        makeCharacter({
          id: '1',
          name: 'Ally Member',
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
        makeCharacter({
          id: '2',
          name: 'Friend Member',
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
        makeCharacter({
          id: '3',
          name: 'Enemy Non-member',
          factions: [
            { name: 'Brotherhood', relationshipTypeId: 'oath_broken' },
          ],
        }),
        makeCharacter({
          id: '4',
          name: 'Unrelated',
          factions: [{ name: 'Raiders', relationshipTypeId: 'oath_sworn' }],
        }),
      ];

      const stats = calculateFactionStats('Brotherhood', characters);

      expect(stats.totalMembers).toBe(2);
    });

    it('counts present members separately from total members', () => {
      const characters: GameCharacter[] = [
        makeCharacter({
          id: '1',
          name: 'Present',
          present: true,
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
        makeCharacter({
          id: '2',
          name: 'Absent',
          present: false,
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
      ];

      const stats = calculateFactionStats('Brotherhood', characters);

      expect(stats.totalMembers).toBe(2);
      expect(stats.presentMembers).toBe(1);
    });

    it('aggregates category counts, top categories, top entries, and calling distribution', () => {
      const characters: GameCharacter[] = [
        makeCharacter({
          id: '1',
          name: 'Member A',
          facets: { callings: ['tinker'], knacks: ['hammer_hand'] },
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
        makeCharacter({
          id: '2',
          name: 'Member B',
          facets: {
            callings: ['tinker'],
            knacks: ['hammer_hand', 'kin_secret'],
          },
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
        makeCharacter({
          id: '3',
          name: 'Member C',
          facets: { callings: ['sentinel'], knacks: [] },
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
      ];

      const stats = calculateFactionStats('Brotherhood', characters);
      const knacks = collectionStats(stats, 'knacks');

      expect(knacks.categoryCounts.forge).toBe(3);
      expect(knacks.topCategories[0]).toEqual({
        categoryId: 'forge',
        label: 'Forge',
        count: 3,
        percentage: 100,
      });
      expect(knacks.topEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'hammer_hand',
            label: 'Hammer Hand',
            count: 2,
            percentage: (2 / 3) * 100,
          }),
        ])
      );

      const callings = collectionStats(stats, 'callings');
      expect(
        Object.fromEntries(callings.topEntries.map(e => [e.id, e.count]))
      ).toEqual({ tinker: 2, sentinel: 1 });
    });

    it('falls back to Unknown Knack/Temperament names for unrecognized ids', () => {
      const characters: GameCharacter[] = [
        makeCharacter({
          id: '1',
          name: 'Member A',
          facets: {
            knacks: ['not-a-real-perk'],
            temperaments: ['not-a-real-distinction'],
          },
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
      ];

      const stats = calculateFactionStats('Brotherhood', characters);

      expect(collectionStats(stats, 'knacks').topEntries[0].label).toBe(
        'Unknown Knack'
      );
      expect(collectionStats(stats, 'temperaments').topEntries[0].label).toBe(
        'Unknown Temperament'
      );
    });

    it('classifies faction relationships into allied and enemy factions', () => {
      const relationships: FactionRelationship[] = [
        { factionName: 'Raiders', relationshipTypeId: 'pact_allied' },
        {
          factionName: 'Scavengers',
          relationshipTypeId: 'pact_allied',
        },
        {
          factionName: 'Vault Dwellers',
          relationshipTypeId: 'pact_rival',
        },
        {
          factionName: 'Ghouls',
          relationshipTypeId: 'pact_rival',
        },
        {
          factionName: 'Traders',
          relationshipTypeId: 'pact_vassal',
        },
      ];
      const characters: GameCharacter[] = [
        makeCharacter({
          id: '1',
          name: 'Member A',
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
      ];

      const stats = calculateFactionStats(
        'Brotherhood',
        characters,
        relationships
      );

      expect(stats.alliedFactions).toEqual(['Raiders', 'Scavengers']);
      expect(stats.enemyFactions).toEqual(['Vault Dwellers', 'Ghouls']);
      expect(stats.relationships).toBe(relationships);
    });
  });

  describe('calculateCombinedFactionStats', () => {
    it('combines member counts and category counts with allied factions', () => {
      const characters: GameCharacter[] = [
        makeCharacter({
          id: '1',
          name: 'Brotherhood Member',
          facets: { knacks: ['hammer_hand'] },
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
        makeCharacter({
          id: '2',
          name: 'Ally Member',
          facets: { knacks: ['hammer_hand'] },
          factions: [{ name: 'Scavengers', relationshipTypeId: 'oath_sworn' }],
        }),
      ];
      const relationshipsMap = new Map<string, FactionRelationship[]>([
        [
          'Brotherhood',
          [
            {
              factionName: 'Scavengers',
              relationshipTypeId: 'pact_allied',
            },
          ],
        ],
        ['Scavengers', []],
      ]);

      const combined = calculateCombinedFactionStats(
        'Brotherhood',
        characters,
        relationshipsMap
      );

      expect(combined.directMembers).toBe(1);
      expect(combined.alliedFactions).toEqual(['Scavengers']);
      expect(combined.combinedMembers).toBe(2);
      expect(combined.combinedCategoryCounts.knacks.forge).toBe(2);
      expect(combined.strengthMultiplier).toBe(2);
    });

    it('defaults strengthMultiplier to 1 when the faction has no direct members', () => {
      const relationshipsMap = new Map<string, FactionRelationship[]>();

      const combined = calculateCombinedFactionStats(
        'Empty Faction',
        [],
        relationshipsMap
      );

      expect(combined.directMembers).toBe(0);
      expect(combined.combinedMembers).toBe(0);
      expect(combined.strengthMultiplier).toBe(1);
    });

    it('treats an unknown faction relationships key as an empty relationship list', () => {
      const combined = calculateCombinedFactionStats(
        'Unknown Faction',
        [],
        new Map()
      );

      expect(combined.alliedFactions).toEqual([]);
      expect(combined.combinedMembers).toBe(0);
    });
  });

  describe('getAllFactionStats', () => {
    it('returns stats for every faction present in the relationships map', () => {
      const characters: GameCharacter[] = [
        makeCharacter({
          id: '1',
          name: 'Member A',
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'oath_sworn' }],
        }),
      ];
      const relationshipsMap = new Map<string, FactionRelationship[]>([
        ['Brotherhood', []],
        ['Raiders', []],
      ]);

      const stats = getAllFactionStats(characters, relationshipsMap);

      expect(stats.map(s => s.factionName)).toEqual(['Brotherhood', 'Raiders']);
      expect(stats[0].totalMembers).toBe(1);
      expect(stats[1].totalMembers).toBe(0);
    });

    it('returns an empty array when the relationships map is empty', () => {
      expect(getAllFactionStats([], new Map())).toEqual([]);
    });
  });
});
