import { calculateCharacterStats as calculateWith } from '@/utils/characterStats';
import { GameCharacter, RelationshipStanding } from '@/models/types';
import { mechanicsRuleset } from '../fixtures/mechanicsRuleset';

/**
 * Aggregation is ruleset-independent for counts and only consults the ruleset
 * to turn trait/quality ids into names — so this runs against the neutral
 * fixture. Asserting on Afterworlds ids here would have proved the util works
 * for exactly one ruleset.
 */
const calculateCharacterStats = (characters: GameCharacter[]) =>
  calculateWith(characters, mechanicsRuleset);

describe('characterStats', () => {
  describe('calculateCharacterStats', () => {
    const mockCharacters: GameCharacter[] = [
      {
        id: '1',
        name: 'Alice',
        archetypeId: 'tinker',
        traitIds: [],
        qualityIds: [],
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
        archetypeId: 'sentinel',
        traitIds: [],
        qualityIds: [],
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
        archetypeId: 'tinker',
        traitIds: [],
        qualityIds: [],
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

    it('should calculate species distribution', () => {
      const stats = calculateCharacterStats(mockCharacters);

      expect(stats.archetypeDistribution).toEqual({
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
          archetypeId: 'artisan',
          traitIds: [],
          qualityIds: [],
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
          archetypeId: 'revenant',
          traitIds: [],
          qualityIds: [],
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
      expect(stats.archetypeDistribution).toEqual({ revenant: 1 });
      expect(stats.factionDistribution).toEqual({ Machines: 1 });
    });

    it('should accumulate multiple faction memberships per character', () => {
      const characters: GameCharacter[] = [
        {
          id: '1',
          name: 'Multi-faction',
          archetypeId: 'tinker',
          traitIds: [],
          qualityIds: [],
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

    it('should handle diverse species distribution', () => {
      const characters: GameCharacter[] = [
        {
          id: '1',
          name: 'Char1',
          archetypeId: 'tinker',
          traitIds: [],
          qualityIds: [],
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '2',
          name: 'Char2',
          archetypeId: 'sentinel',
          traitIds: [],
          qualityIds: [],
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '3',
          name: 'Char3',
          archetypeId: 'revenant',
          traitIds: [],
          qualityIds: [],
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
        {
          id: '4',
          name: 'Char4',
          archetypeId: 'tinker',
          traitIds: [],
          qualityIds: [],
          factions: [],
          relationships: [],
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ];

      const stats = calculateCharacterStats(characters);

      expect(stats.archetypeDistribution).toEqual({
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
          archetypeId: 'tinker',
          traitIds: [],
          qualityIds: [],
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
          archetypeId: 'tinker',
          traitIds: [],
          qualityIds: [],
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
          archetypeId: 'tinker',
          traitIds: [],
          qualityIds: [],
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
          archetypeId: 'tinker',
          traitIds: [],
          qualityIds: [],
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
          archetypeId: 'tinker',
          traitIds: [],
          qualityIds: [],
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

    describe('Perk Statistics', () => {
      it('should calculate most common perks', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: ['hammer_hand', 'steady_hand', 'quick_read'],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '2',
            name: 'Char2',
            archetypeId: 'tinker',
            traitIds: ['hammer_hand', 'steady_hand'],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '3',
            name: 'Char3',
            archetypeId: 'tinker',
            traitIds: ['hammer_hand'],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(stats.commonPerks).toHaveLength(3);
        expect(stats.commonPerks[0]).toEqual({
          name: 'Hammer Hand',
          count: 3,
        });
        expect(stats.commonPerks[1].count).toBe(2);
        expect(stats.commonPerks[2].count).toBe(1);
      });

      it('should handle unknown perk IDs', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: ['unknown_trait_id', 'hammer_hand'],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(stats.commonPerks).toHaveLength(2);
        const unknownPerk = stats.commonPerks.find(
          p => p.name === 'Unknown Knack'
        );
        expect(unknownPerk).toBeDefined();
        expect(unknownPerk?.count).toBe(1);
      });

      it('should limit common perks to top 5', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: [
              'hammer_hand',
              'quick_read',
              'kin_secret',
              'steady_hand',
              'overclock',
              'unknown_trait_a',
              'unknown_trait_b',
            ],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(stats.commonPerks).toHaveLength(5);
      });

      it('should handle characters with no perks', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(stats.commonPerks).toHaveLength(0);
      });

      it('should sort perks by count descending', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: ['hammer_hand', 'steady_hand', 'steady_hand'],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '2',
            name: 'Char2',
            archetypeId: 'tinker',
            traitIds: ['steady_hand', 'quick_read'],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        // defense_1 appears 3 times, agility_1 once, strength_1 once
        expect(stats.commonPerks[0].count).toBeGreaterThanOrEqual(
          stats.commonPerks[1]?.count || 0
        );
        if (stats.commonPerks[1]) {
          expect(stats.commonPerks[1].count).toBeGreaterThanOrEqual(
            stats.commonPerks[2]?.count || 0
          );
        }
      });
    });

    describe('Distinction Statistics', () => {
      it('should calculate most common distinctions', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: ['steadfast', 'reckless', 'unknown_quality_id'],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '2',
            name: 'Char2',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: ['steadfast', 'reckless'],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '3',
            name: 'Char3',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: ['steadfast'],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(stats.commonDistinctions).toHaveLength(3);
        expect(stats.commonDistinctions[0]).toEqual({
          name: 'Steadfast',
          count: 3,
        });
        expect(stats.commonDistinctions[1].count).toBe(2);
        expect(stats.commonDistinctions[2].count).toBe(1);
      });

      it('should handle unknown distinction IDs', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: ['unknown_quality_id', 'steadfast'],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(stats.commonDistinctions).toHaveLength(2);
        const unknownDistinction = stats.commonDistinctions.find(
          d => d.name === 'Unknown Quality'
        );
        expect(unknownDistinction).toBeDefined();
        expect(unknownDistinction?.count).toBe(1);
      });

      it('should limit common distinctions to top 5', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: [
              'steadfast',
              'reckless',
              'unknown_a',
              'unknown_b',
              'unknown_c',
              'unknown_d',
              'unknown_e',
            ],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(stats.commonDistinctions).toHaveLength(5);
      });

      it('should handle characters with no distinctions', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: [],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        expect(stats.commonDistinctions).toHaveLength(0);
      });

      it('should sort distinctions by count descending', () => {
        const characters: GameCharacter[] = [
          {
            id: '1',
            name: 'Char1',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: ['steadfast', 'reckless', 'reckless'],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
          {
            id: '2',
            name: 'Char2',
            archetypeId: 'tinker',
            traitIds: [],
            qualityIds: ['reckless', 'unknown_quality_id'],
            factions: [],
            relationships: [],
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ];

        const stats = calculateCharacterStats(characters);

        // d2 appears 3 times, d1 once, d3 once
        expect(stats.commonDistinctions[0].count).toBeGreaterThanOrEqual(
          stats.commonDistinctions[1]?.count || 0
        );
        if (stats.commonDistinctions[1]) {
          expect(stats.commonDistinctions[1].count).toBeGreaterThanOrEqual(
            stats.commonDistinctions[2]?.count || 0
          );
        }
      });
    });
  });
});
