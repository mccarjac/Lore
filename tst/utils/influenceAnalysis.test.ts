import {
  calculateCharacterInfluence,
  getTopInfluencers,
  analyzeFactionInfluence,
  buildRelationshipNetwork,
  findFactionConnections,
  findMutualRelationships,
  findKeyConnectors,
  findPowerCenters,
} from '@/utils/influenceAnalysis';
import { GameCharacter } from '@/models/types';
import { makeCharacter, makeStoredFaction } from '../helpers/factories';
import { getStorageMock, primeStorageDefaults } from '../helpers/storage';

jest.mock('@utils/characterStorage');

describe('influenceAnalysis', () => {
  describe('calculateCharacterInfluence', () => {
    it('scores positive relationships, negative relationships, and factions', () => {
      const character = makeCharacter({
        id: '1',
        name: 'Alice',
        factions: [{ name: 'Brotherhood', relationshipTypeId: 'ally' }],
        relationships: [
          { characterName: 'Bob', relationshipTypeId: 'ally' },
          {
            characterName: 'Carl',
            relationshipTypeId: 'enemy',
          },
        ],
      });

      const influence = calculateCharacterInfluence(character, [character]);

      // 1 positive * 3 - 1 negative * 2 + 1 faction * 5 = 6
      expect(influence.influenceScore).toBe(6);
      expect(influence.relationshipCount).toBe(2);
      expect(influence.positiveRelationships).toBe(1);
      expect(influence.negativeRelationships).toBe(1);
      expect(influence.factionCount).toBe(1);
      expect(influence.factions).toEqual(['Brotherhood']);
    });

    it('collects connections from both outgoing relationships and reverse references', () => {
      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        relationships: [{ characterName: 'Bob', relationshipTypeId: 'ally' }],
      });
      const bob = makeCharacter({
        id: '2',
        name: 'Bob',
        relationships: [],
      });
      const carl = makeCharacter({
        id: '3',
        name: 'Carl',
        relationships: [
          {
            characterName: 'Alice',
            relationshipTypeId: 'friend',
          },
        ],
      });

      const influence = calculateCharacterInfluence(alice, [alice, bob, carl]);

      expect(influence.connections.sort()).toEqual(['Bob', 'Carl']);
    });

    it('handles characters with no relationships or factions', () => {
      const character = makeCharacter({ relationships: [], factions: [] });

      const influence = calculateCharacterInfluence(character, [character]);

      expect(influence.influenceScore).toBe(0);
      expect(influence.connections).toEqual([]);
    });
  });

  describe('getTopInfluencers', () => {
    it('filters out characters with zero or negative influence and sorts descending', () => {
      const influential = makeCharacter({
        id: '1',
        name: 'Influential',
        factions: [{ name: 'Brotherhood', relationshipTypeId: 'ally' }],
      });
      const neutral = makeCharacter({ id: '2', name: 'Neutral' });
      const negative = makeCharacter({
        id: '3',
        name: 'Negative',
        relationships: [
          {
            characterName: 'Influential',
            relationshipTypeId: 'enemy',
          },
        ],
      });

      const top = getTopInfluencers([influential, neutral, negative]);

      expect(top.map(inf => inf.character.name)).toEqual(['Influential']);
    });

    it('respects the limit parameter', () => {
      const characters: GameCharacter[] = Array.from({ length: 15 }, (_, i) =>
        makeCharacter({
          id: `${i}`,
          name: `Char ${i}`,
          factions: [{ name: 'Brotherhood', relationshipTypeId: 'ally' }],
        })
      );

      expect(getTopInfluencers(characters, 3)).toHaveLength(3);
      expect(getTopInfluencers(characters)).toHaveLength(10);
    });
  });

  describe('analyzeFactionInfluence', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      primeStorageDefaults();
    });

    it('groups characters by faction and computes total/average influence', async () => {
      const storage = getStorageMock();
      storage.loadFactions.mockResolvedValue([]);

      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        factions: [{ name: 'Brotherhood', relationshipTypeId: 'ally' }],
        relationships: [{ characterName: 'Bob', relationshipTypeId: 'ally' }],
      });
      const bob = makeCharacter({
        id: '2',
        name: 'Bob',
        factions: [{ name: 'Brotherhood', relationshipTypeId: 'friend' }],
      });

      const result = await analyzeFactionInfluence([alice, bob]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Brotherhood');
      expect(result[0].memberCount).toBe(2);
      expect(result[0].averageInfluence).toBe(
        result[0].totalInfluence / result[0].memberCount
      );
    });

    it('excludes retired factions from the analysis', async () => {
      const storage = getStorageMock();
      storage.loadFactions.mockResolvedValue([
        makeStoredFaction({ name: 'Retired Faction', retired: true }),
      ]);

      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        factions: [{ name: 'Retired Faction', relationshipTypeId: 'ally' }],
      });

      const result = await analyzeFactionInfluence([alice]);

      expect(result).toEqual([]);
    });

    it('identifies allied and enemy factions from member faction standings', async () => {
      const storage = getStorageMock();
      storage.loadFactions.mockResolvedValue([]);

      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        factions: [
          { name: 'Brotherhood', relationshipTypeId: 'ally' },
          { name: 'Raiders', relationshipTypeId: 'enemy' },
          { name: 'Scavengers', relationshipTypeId: 'ally' },
        ],
      });

      const result = await analyzeFactionInfluence([alice]);

      const brotherhood = result.find(f => f.name === 'Brotherhood');
      expect(brotherhood?.allies).toEqual(['Scavengers']);
      expect(brotherhood?.enemies).toEqual(['Raiders']);
    });
  });

  describe('buildRelationshipNetwork', () => {
    it('buckets related characters by relationship role', () => {
      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        relationships: [
          { characterName: 'Bob', relationshipTypeId: 'ally' },
          { characterName: 'Carl', relationshipTypeId: 'friend' },
          { characterName: 'Dana', relationshipTypeId: 'neutral' },
          { characterName: 'Eve', relationshipTypeId: 'hostile' },
          { characterName: 'Frank', relationshipTypeId: 'enemy' },
          { characterName: 'Unknown Person', relationshipTypeId: 'ally' },
        ],
      });
      const others = ['Bob', 'Carl', 'Dana', 'Eve', 'Frank'].map(name =>
        makeCharacter({ id: name, name })
      );

      const network = buildRelationshipNetwork(alice, [alice, ...others]);

      expect(network.positive.map(c => c.name).sort()).toEqual(['Bob', 'Carl']);
      expect(network.neutral.map(c => c.name)).toEqual(['Dana']);
      expect(network.negative.map(c => c.name).sort()).toEqual([
        'Eve',
        'Frank',
      ]);
    });
  });

  describe('findFactionConnections', () => {
    it('maps each of a character faction to its other members, excluding the character itself', () => {
      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        factions: [{ name: 'Brotherhood', relationshipTypeId: 'ally' }],
      });
      const bob = makeCharacter({
        id: '2',
        name: 'Bob',
        factions: [{ name: 'Brotherhood', relationshipTypeId: 'friend' }],
      });
      const carl = makeCharacter({ id: '3', name: 'Carl', factions: [] });

      const connections = findFactionConnections(alice, [alice, bob, carl]);

      expect(connections.get('Brotherhood')?.map(c => c.name)).toEqual(['Bob']);
      expect(connections.size).toBe(1);
    });

    it('omits factions with no other members', () => {
      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        factions: [{ name: 'Solo Faction', relationshipTypeId: 'ally' }],
      });

      const connections = findFactionConnections(alice, [alice]);

      expect(connections.size).toBe(0);
    });
  });

  describe('findMutualRelationships', () => {
    it('finds pairs of characters who reference each other, without duplicates', () => {
      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        relationships: [{ characterName: 'Bob', relationshipTypeId: 'ally' }],
      });
      const bob = makeCharacter({
        id: '2',
        name: 'Bob',
        relationships: [
          {
            characterName: 'Alice',
            relationshipTypeId: 'friend',
          },
        ],
      });
      const carl = makeCharacter({
        id: '3',
        name: 'Carl',
        relationships: [
          {
            characterName: 'Alice',
            relationshipTypeId: 'neutral',
          },
        ],
      });

      const mutuals = findMutualRelationships([alice, bob, carl]);

      expect(mutuals).toHaveLength(1);
      expect(mutuals[0].character1.name).toBe('Alice');
      expect(mutuals[0].character2.name).toBe('Bob');
      expect(mutuals[0].relationship1).toBe('ally');
      expect(mutuals[0].relationship2).toBe('friend');
    });

    it('returns an empty array when no relationships are mutual', () => {
      const alice = makeCharacter({
        id: '1',
        name: 'Alice',
        relationships: [{ characterName: 'Bob', relationshipTypeId: 'ally' }],
      });
      const bob = makeCharacter({ id: '2', name: 'Bob', relationships: [] });

      expect(findMutualRelationships([alice, bob])).toEqual([]);
    });
  });

  describe('findKeyConnectors', () => {
    it('only includes characters with more than one faction and more than two relationships', () => {
      const qualifies = makeCharacter({
        id: '1',
        name: 'Connector',
        factions: [
          { name: 'A', relationshipTypeId: 'ally' },
          { name: 'B', relationshipTypeId: 'ally' },
        ],
        relationships: [
          { characterName: 'X', relationshipTypeId: 'ally' },
          { characterName: 'Y', relationshipTypeId: 'ally' },
          { characterName: 'Z', relationshipTypeId: 'ally' },
        ],
      });
      const singleFaction = makeCharacter({
        id: '2',
        name: 'Single Faction',
        factions: [{ name: 'A', relationshipTypeId: 'ally' }],
        relationships: [
          { characterName: 'X', relationshipTypeId: 'ally' },
          { characterName: 'Y', relationshipTypeId: 'ally' },
          { characterName: 'Z', relationshipTypeId: 'ally' },
        ],
      });
      const fewRelationships = makeCharacter({
        id: '3',
        name: 'Few Relationships',
        factions: [
          { name: 'A', relationshipTypeId: 'ally' },
          { name: 'B', relationshipTypeId: 'ally' },
        ],
        relationships: [{ characterName: 'X', relationshipTypeId: 'ally' }],
      });

      const connectors = findKeyConnectors([
        qualifies,
        singleFaction,
        fewRelationships,
      ]);

      expect(connectors.map(c => c.character.name)).toEqual(['Connector']);
    });

    it('respects the limit parameter', () => {
      const characters = Array.from({ length: 10 }, (_, i) =>
        makeCharacter({
          id: `${i}`,
          name: `Char ${i}`,
          factions: [
            { name: 'A', relationshipTypeId: 'ally' },
            { name: 'B', relationshipTypeId: 'ally' },
          ],
          relationships: [
            {
              characterName: 'X',
              relationshipTypeId: 'ally',
            },
            {
              characterName: 'Y',
              relationshipTypeId: 'ally',
            },
            {
              characterName: 'Z',
              relationshipTypeId: 'ally',
            },
          ],
        })
      );

      expect(findKeyConnectors(characters, 2)).toHaveLength(2);
    });
  });

  describe('findPowerCenters', () => {
    it('boosts score for allies who are themselves influential and filters below the threshold', () => {
      const influentialAlly = makeCharacter({
        id: '1',
        name: 'Influential Ally',
        factions: [
          { name: 'A', relationshipTypeId: 'ally' },
          { name: 'B', relationshipTypeId: 'ally' },
          { name: 'C', relationshipTypeId: 'ally' },
        ],
      });
      const powerCenter = makeCharacter({
        id: '2',
        name: 'Power Center',
        factions: [
          { name: 'A', relationshipTypeId: 'ally' },
          { name: 'B', relationshipTypeId: 'ally' },
          { name: 'C', relationshipTypeId: 'ally' },
        ],
        relationships: [
          {
            characterName: 'Influential Ally',
            relationshipTypeId: 'ally',
          },
        ],
      });
      const weakCharacter = makeCharacter({ id: '3', name: 'Weak' });

      const centers = findPowerCenters([
        influentialAlly,
        powerCenter,
        weakCharacter,
      ]);

      expect(centers.map(c => c.character.name)).toContain('Power Center');
      expect(centers.map(c => c.character.name)).not.toContain('Weak');
    });
  });
});
