import {
  calculateCharacterStats as calculateWith,
  type CharacterStats,
} from '@/utils/characterStats';
import { GameCharacter, RelationshipStanding } from '@/models/types';
import { mechanicsRuleset } from '../fixtures/mechanicsRuleset';

/**
 * Aggregation is ruleset-independent for counts and only consults the ruleset
 * to turn facet ids into labels — so this runs against the neutral fixture.
 * Asserting on Afterworlds ids here would have proved the util works for
 * exactly one ruleset.
 */
const calculateCharacterStats = (characters: GameCharacter[]) =>
  calculateWith(characters, mechanicsRuleset);

const collectionStats = (stats: CharacterStats, collectionId: string) =>
  stats.facetCollections.find(c => c.collectionId === collectionId)!;

describe('characterStats', () => {
  describe('calculateCharacterStats', () => {
    const mockCharacters: GameCharacter[] = [
      {
        id: '1',
        name: 'Alice',
        facets: { callings: ['tinker'] },
        factions: [
          { name: 'Brotherhood', standing: RelationshipStanding.Ally },
        ],
        relationships: [],
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      {
        id: '2',
        name: 'Bob',
        facets: { callings: ['sentinel'] },
        factions: [
          { name: 'Brotherhood', standing: RelationshipStanding.Friend },
          { name: 'Raiders', standing: RelationshipStanding.Enemy },
        ],
        relationships: [],
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      {
        id: '3',
        name: 'Charlie',
        facets: { callings: ['tinker'] },
        factions: [{ name: 'Raiders', standing: RelationshipStanding.Ally }],
        relationships: [],
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
    ];

    it('should throw error for empty character array', () => {
      expect(() => calculateCharacterStats([])).toThrow(
        'No characters available for statistics calculation'
      );
    });

    it('should calculate total character count', () => {
      const stats = calculateCharacterStats(mockCharacters);

      expect(stats.totalCharacters).toBe(3);
    });

    it('should calculate calling distribution', () => {
      const stats = calculateCharacterStats(mockCharacters);

      expect(collectionStats(stats, 'callings').counts).toEqual({
        tinker: 2,
        sentinel: 1,
      });
    });

    it('should calculate faction distribution', () => {
      const stats = calculateCharacterStats(mockCharacters);

      expect(stats.factionDistribution).toEqual({
        Brotherhood: 2,
        Raiders: 2,
      });
    });

    it('should calculate faction standings distribution', () => {
      const stats = calculateCharacterStats(mockCharacters);

      expect(stats.factionStandings).toEqual({
        Brotherhood: {
          Ally: 1,
          Friend: 1,
        },
        Raiders: {
          Enemy: 1,
          Ally: 1,
        },
      });
    });

    it('should handle character with no factions', () => {
      const characters: GameCharacter[] = [
        {
          id: '1',
          name: 'Loner',
          facets: { callings: ['tinker'] },
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ];

      const stats = calculateCharacterStats(characters);

      expect(stats.totalCharacters).toBe(1);
      expect(stats.factionDistribution).toEqual({});
      expect(stats.factionStandings).toEqual({});
    });

    it('should handle single character', () => {
      const characters: GameCharacter[] = [
        {
          id: '1',
          name: 'Solo',
          facets: { callings: ['revenant'] },
          factions: [
            { name: 'Machines', standing: RelationshipStanding.Neutral },
          ],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ];

      const stats = calculateCharacterStats(characters);

      expect(stats.totalCharacters).toBe(1);
      expect(collectionStats(stats, 'callings').counts).toEqual({
        revenant: 1,
      });
      expect(stats.factionDistribution).toEqual({ Machines: 1 });
    });

    it('should accumulate multiple faction memberships per character', () => {
      const characters: GameCharacter[] = [
        {
          id: '1',
          name: 'Multi-faction',
          facets: { callings: ['tinker'] },
          factions: [
            { name: 'Faction A', standing: RelationshipStanding.Ally },
            { name: 'Faction B', standing: RelationshipStanding.Friend },
            { name: 'Faction C', standing: RelationshipStanding.Neutral },
          ],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ];

      const stats = calculateCharacterStats(characters);

      expect(stats.factionDistribution).toEqual({
        'Faction A': 1,
        'Faction B': 1,
        'Faction C': 1,
      });
    });

    it('should handle diverse calling distribution', () => {
      const characters: GameCharacter[] = [
        {
          id: '1',
          name: 'Char1',
          facets: { callings: ['tinker'] },
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '2',
          name: 'Char2',
          facets: { callings: ['sentinel'] },
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '3',
          name: 'Char3',
          facets: { callings: ['revenant'] },
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '4',
          name: 'Char4',
          facets: { callings: ['tinker'] },
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ];

      const stats = calculateCharacterStats(characters);

      expect(collectionStats(stats, 'callings').counts).toEqual({
        tinker: 2,
        sentinel: 1,
        revenant: 1,
      });
    });

    it('should include all relationship standings in faction standings', () => {
      const characters: GameCharacter[] = [
        {
          id: '1',
          name: 'Char1',
          facets: { callings: ['tinker'] },
          factions: [
            { name: 'TestFaction', standing: RelationshipStanding.Ally },
          ],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '2',
          name: 'Char2',
          facets: { callings: ['tinker'] },
          factions: [
            { name: 'TestFaction', standing: RelationshipStanding.Friend },
          ],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '3',
          name: 'Char3',
          facets: { callings: ['tinker'] },
          factions: [
            { name: 'TestFaction', standing: RelationshipStanding.Neutral },
          ],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '4',
          name: 'Char4',
          facets: { callings: ['tinker'] },
          factions: [
            { name: 'TestFaction', standing: RelationshipStanding.Hostile },
          ],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '5',
          name: 'Char5',
          facets: { callings: ['tinker'] },
          factions: [
            { name: 'TestFaction', standing: RelationshipStanding.Enemy },
          ],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ];

      const stats = calculateCharacterStats(characters);

      expect(stats.factionStandings.TestFaction).toEqual({
        Ally: 1,
        Friend: 1,
        Neutral: 1,
        Hostile: 1,
        Enemy: 1,
      });
    });

    describe('Knack Statistics', () => {
      it('should calculate most common knacks', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: {
              callings: ['tinker'],
              knacks: ['hammer_hand', 'steady_hand', 'quick_read'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '2',
            name: 'Char2',
            facets: {
              callings: ['tinker'],
              knacks: ['hammer_hand', 'steady_hand'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '3',
            name: 'Char3',
            facets: { callings: ['tinker'], knacks: ['hammer_hand'] },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);
        const knacks = collectionStats(stats, 'knacks');

        expect(knacks.entries).toHaveLength(3);
        expect(knacks.entries[0]).toEqual({
          id: 'hammer_hand',
          label: 'Hammer Hand',
          count: 3,
        });
        expect(knacks.entries[1].count).toBe(2);
        expect(knacks.entries[2].count).toBe(1);
      });

      it('should handle unknown knack IDs', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: {
              callings: ['tinker'],
              knacks: ['unknown_trait_id', 'hammer_hand'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);
        const knacks = collectionStats(stats, 'knacks');

        expect(knacks.entries).toHaveLength(2);
        const unknownKnack = knacks.entries.find(
          e => e.label === 'Unknown Knack'
        );
        expect(unknownKnack).toBeDefined();
        expect(unknownKnack?.count).toBe(1);
      });

      it('does not limit knacks to a top N — that is a UI concern', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: {
              callings: ['tinker'],
              knacks: [
                'hammer_hand',
                'quick_read',
                'kin_secret',
                'steady_hand',
                'overclock',
                'unknown_trait_a',
                'unknown_trait_b',
              ],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(collectionStats(stats, 'knacks').entries).toHaveLength(7);
      });

      it('should handle characters with no knacks', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: { callings: ['tinker'], knacks: [] },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(collectionStats(stats, 'knacks').entries).toHaveLength(0);
      });

      it('should sort knacks by count descending', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: {
              callings: ['tinker'],
              knacks: ['hammer_hand', 'steady_hand', 'steady_hand'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '2',
            name: 'Char2',
            facets: {
              callings: ['tinker'],
              knacks: ['steady_hand', 'quick_read'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);
        const entries = collectionStats(stats, 'knacks').entries;

        // steady_hand appears 3 times, hammer_hand once, quick_read once
        expect(entries[0].count).toBeGreaterThanOrEqual(entries[1]?.count || 0);
        if (entries[1]) {
          expect(entries[1].count).toBeGreaterThanOrEqual(
            entries[2]?.count || 0
          );
        }
      });
    });

    describe('Temperament Statistics', () => {
      it('should calculate most common temperaments', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: {
              callings: ['tinker'],
              temperaments: ['steadfast', 'reckless', 'unknown_quality_id'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '2',
            name: 'Char2',
            facets: {
              callings: ['tinker'],
              temperaments: ['steadfast', 'reckless'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '3',
            name: 'Char3',
            facets: { callings: ['tinker'], temperaments: ['steadfast'] },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);
        const temperaments = collectionStats(stats, 'temperaments');

        expect(temperaments.entries).toHaveLength(3);
        expect(temperaments.entries[0]).toEqual({
          id: 'steadfast',
          label: 'Steadfast',
          count: 3,
        });
        expect(temperaments.entries[1].count).toBe(2);
        expect(temperaments.entries[2].count).toBe(1);
      });

      it('should handle unknown temperament IDs', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: {
              callings: ['tinker'],
              temperaments: ['unknown_quality_id', 'steadfast'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);
        const temperaments = collectionStats(stats, 'temperaments');

        expect(temperaments.entries).toHaveLength(2);
        const unknownTemperament = temperaments.entries.find(
          e => e.label === 'Unknown Temperament'
        );
        expect(unknownTemperament).toBeDefined();
        expect(unknownTemperament?.count).toBe(1);
      });

      it('does not limit temperaments to a top N — that is a UI concern', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: {
              callings: ['tinker'],
              temperaments: [
                'steadfast',
                'reckless',
                'unknown_a',
                'unknown_b',
                'unknown_c',
                'unknown_d',
                'unknown_e',
              ],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(collectionStats(stats, 'temperaments').entries).toHaveLength(7);
      });

      it('should handle characters with no temperaments', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: { callings: ['tinker'], temperaments: [] },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(collectionStats(stats, 'temperaments').entries).toHaveLength(0);
      });

      it('should sort temperaments by count descending', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            facets: {
              callings: ['tinker'],
              temperaments: ['steadfast', 'reckless', 'reckless'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '2',
            name: 'Char2',
            facets: {
              callings: ['tinker'],
              temperaments: ['reckless', 'unknown_quality_id'],
            },
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);
        const entries = collectionStats(stats, 'temperaments').entries;

        // reckless appears 3 times, steadfast once, unknown once
        expect(entries[0].count).toBeGreaterThanOrEqual(entries[1]?.count || 0);
        if (entries[1]) {
          expect(entries[1].count).toBeGreaterThanOrEqual(
            entries[2]?.count || 0
          );
        }
      });
    });
  });
});
