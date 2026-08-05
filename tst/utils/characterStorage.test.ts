import {
  saveCharacters,
  loadCharacters,
  addCharacter,
  updateCharacter,
  deleteCharacter,
  exportDataset,
  importDataset,
  clearStorage,
  saveFactions,
  loadFactions,
  createFaction,
  updateFaction,
  deleteFaction,
  deleteFactionCompletely,
  saveLocations,
  loadLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  saveEvents,
  loadEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  saveQuests,
  loadQuests,
  createQuest,
  updateQuest,
  deleteQuest,
  type StoredFaction,
} from '@/utils/characterStorage';
import * as CharacterStorage from '@/utils/characterStorage';
import { SafeAsyncStorageJSONParser } from '@/utils/safeAsyncStorageJSONParser';
import {
  GameCharacter,
  GameLocation,
  GameEvent,
  GameQuest,
  QuestStatus,
  FactionMembership,
} from '@/models/types';

// Mock the SafeAsyncStorageJSONParser
jest.mock('@/utils/safeAsyncStorageJSONParser');

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('characterStorage', () => {
  const mockDate = '2025-01-01T00:00:00.000Z';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Character CRUD Operations', () => {
    const mockCharacter: GameCharacter = {
      id: 'char-1',
      name: 'Test Character',
      facets: {
        archetypes: ['Human'],
        traits: ['perk1'],
        qualities: ['dist1'],
      },
      factions: [{ name: 'Brotherhood', relationshipTypeId: 'ally' }],
      relationships: [],
      retired: false,
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    describe('loadCharacters', () => {
      it('should return empty array when no data exists', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          null
        );

        const result = await loadCharacters();

        expect(result).toEqual([]);
      });

      it('should return characters from storage', async () => {
        const mockDataset = {
          characters: [mockCharacter],
          version: '1.0',
          lastUpdated: mockDate,
        };
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          mockDataset
        );

        const result = await loadCharacters();

        expect(result).toEqual([mockCharacter]);
        expect(SafeAsyncStorageJSONParser.getItem).toHaveBeenCalledWith(
          'gameCharacterManager'
        );
      });

      it('should apply backward compatibility defaults', async () => {
        const oldCharacter = {
          id: 'char-1',
          name: 'Old Character',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          createdAt: mockDate,
          updatedAt: mockDate,
        };
        const mockDataset = {
          characters: [oldCharacter],
          version: '1.0',
          lastUpdated: mockDate,
        };
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          mockDataset
        );

        const result = await loadCharacters();

        expect(result[0].retired).toBe(false);
        expect(result[0].relationships).toEqual([]);
      });

      it('should return empty array when dataset has no characters property', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await loadCharacters();

        expect(result).toEqual([]);
      });
    });

    describe('saveCharacters', () => {
      it('should save characters with proper dataset structure', async () => {
        const characters = [mockCharacter];

        await saveCharacters(characters);

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager',
          {
            characters,
            version: '1.0',
            lastUpdated: mockDate,
          }
        );
      });

      it('should save empty array', async () => {
        await saveCharacters([]);

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager',
          {
            characters: [],
            version: '1.0',
            lastUpdated: mockDate,
          }
        );
      });
    });

    describe('addCharacter', () => {
      it('should add a new character with generated ID and timestamps', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const newCharacterData = {
          name: 'New Character',
          facets: { archetypes: ['Mutant'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
        };

        const result = await addCharacter(newCharacterData);

        expect(result.id).toBe('mock-uuid-1234');
        expect(result.name).toBe('New Character');
        expect(result.retired).toBe(false);
        expect(result.createdAt).toBe(mockDate);
        expect(result.updatedAt).toBe(mockDate);
      });

      it('should add character to existing list', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [mockCharacter],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const newCharacterData = {
          name: 'Second Character',
          facets: { archetypes: ['Android'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
        };

        await addCharacter(newCharacterData);

        const savedData = (SafeAsyncStorageJSONParser.setItem as jest.Mock).mock
          .calls[0][1];
        expect(savedData.characters).toHaveLength(2);
        expect(savedData.characters[0]).toEqual(mockCharacter);
        expect(savedData.characters[1].name).toBe('Second Character');
      });

      it('should ensure relationships array exists', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const newCharacterData = {
          name: 'Character Without Relationships',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
        } as any;

        const result = await addCharacter(newCharacterData);

        expect(result.relationships).toEqual([]);
      });
    });

    describe('updateCharacter', () => {
      it('should update existing character', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [mockCharacter],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const updates = {
          name: 'Updated Name',
          retired: true,
        };

        const result = await updateCharacter('char-1', updates);

        expect(result).not.toBeNull();
        expect(result?.name).toBe('Updated Name');
        expect(result?.retired).toBe(true);
        expect(result?.updatedAt).toBe(mockDate);
      });

      it('should return null for non-existent character', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [mockCharacter],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateCharacter('non-existent-id', {
          name: 'New Name',
        });

        expect(result).toBeNull();
      });

      it('should preserve unchanged properties', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [mockCharacter],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateCharacter('char-1', { retired: true });

        expect(result?.name).toBe('Test Character');
        expect(result?.facets?.archetypes).toEqual(['Human']);
        expect(result?.retired).toBe(true);
      });
    });

    describe('deleteCharacter', () => {
      it('should delete existing character', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [mockCharacter],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteCharacter('char-1');

        expect(result).toBe(true);
        const savedData = (SafeAsyncStorageJSONParser.setItem as jest.Mock).mock
          .calls[0][1];
        expect(savedData.characters).toHaveLength(0);
      });

      it('should return false for non-existent character', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [mockCharacter],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteCharacter('non-existent-id');

        expect(result).toBe(false);
      });

      it('should delete only the specified character', async () => {
        const character2 = { ...mockCharacter, id: 'char-2', name: 'Char 2' };
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          characters: [mockCharacter, character2],
          version: '1.0',
          lastUpdated: mockDate,
        });

        await deleteCharacter('char-1');

        const savedData = (SafeAsyncStorageJSONParser.setItem as jest.Mock).mock
          .calls[0][1];
        expect(savedData.characters).toHaveLength(1);
        expect(savedData.characters[0].id).toBe('char-2');
      });
    });
  });

  describe('Data Import/Export', () => {
    describe('exportDataset', () => {
      it('should export all data types', async () => {
        const mockCharacters = {
          characters: [
            {
              id: 'char-1',
              name: 'Test',
              facets: { archetypes: ['Human'], traits: [], qualities: [] },
              factions: [],
              relationships: [],
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          version: '1.0',
          lastUpdated: mockDate,
        };
        const mockFactions = {
          factions: [
            {
              name: 'TestFaction',
              description: 'Test',
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          version: '1.0',
          lastUpdated: mockDate,
        };
        const mockLocations = {
          locations: [
            {
              id: 'loc-1',
              name: 'TestLocation',
              description: 'Test',
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          version: '1.0',
          lastUpdated: mockDate,
        };
        const mockEvents = {
          events: [
            {
              id: 'event-1',
              name: 'TestEvent',
              description: 'Test',
              date: mockDate,
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          version: '1.0',
          lastUpdated: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce(mockCharacters)
          .mockResolvedValueOnce(mockFactions)
          .mockResolvedValueOnce(mockLocations)
          .mockResolvedValueOnce(mockEvents);

        const result = await exportDataset();
        const parsed = JSON.parse(result);

        expect(parsed.characters).toHaveLength(1);
        expect(parsed.factions).toHaveLength(1);
        expect(parsed.locations).toHaveLength(1);
        expect(parsed.events).toHaveLength(1);
        expect(parsed.version).toBe('1.0');
      });

      it('should handle missing data gracefully', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          null
        );

        const result = await exportDataset();
        const parsed = JSON.parse(result);

        expect(parsed.characters).toEqual([]);
        expect(parsed.factions).toEqual([]);
        expect(parsed.locations).toEqual([]);
        expect(parsed.events).toEqual([]);
      });
    });

    describe('importDataset', () => {
      it('should import valid dataset', async () => {
        const dataset = {
          characters: [
            {
              id: 'char-1',
              name: 'Imported',
              facets: { archetypes: ['Human'], traits: [], qualities: [] },
              factions: [],
              relationships: [],
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          factions: [
            {
              name: 'ImportedFaction',
              description: 'Test',
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          locations: [],
          events: [],
          version: '1.0',
          lastUpdated: mockDate,
        };

        // Mock loadLocations to return empty array
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await importDataset(JSON.stringify(dataset));

        expect(result).toBe(true);
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalled();
      });

      it('should return false for invalid JSON', async () => {
        const result = await importDataset('invalid-json{');

        expect(result).toBe(false);
      });

      it('should handle dataset without optional fields', async () => {
        const minimalDataset = {
          characters: [],
          version: '1.0',
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await importDataset(JSON.stringify(minimalDataset));

        expect(result).toBe(true);
      });
    });
  });

  describe('Faction Operations', () => {
    const mockFaction = {
      name: 'Brotherhood',
      description: 'Test faction',
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    describe('loadFactions', () => {
      it('should return empty array when no factions exist', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          null
        );

        const result = await loadFactions();

        expect(result).toEqual([]);
      });

      it('should return factions from storage', async () => {
        const mockDataset = {
          factions: [mockFaction],
          version: '1.0',
          lastUpdated: mockDate,
        };
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          mockDataset
        );

        const result = await loadFactions();

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Brotherhood');
        expect(result[0].description).toBe('Test faction');
      });

      it('should apply backward compatibility defaults', async () => {
        const oldFaction = {
          name: 'OldFaction',
          description: 'Test',
          createdAt: mockDate,
          updatedAt: mockDate,
        };
        const mockDataset = {
          factions: [oldFaction],
          version: '1.0',
          lastUpdated: mockDate,
        };
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          mockDataset
        );

        const result = await loadFactions();

        expect(result[0].retired).toBe(false);
      });
    });

    describe('saveFactions', () => {
      it('should save factions with proper dataset structure', async () => {
        const factions = [mockFaction];

        await saveFactions(factions);

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          {
            factions,
            version: '1.0',
            lastUpdated: mockDate,
          }
        );
      });
    });

    describe('createFaction', () => {
      it('should create a new faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const newFactionData = {
          name: 'New Faction',
          description: 'New faction description',
        };

        const result = await createFaction(newFactionData);

        expect(result).toBe(true);
        const savedData = (SafeAsyncStorageJSONParser.setItem as jest.Mock).mock
          .calls[0][1];
        expect(savedData.factions[0].name).toBe('New Faction');
        expect(savedData.factions[0].description).toBe(
          'New faction description'
        );
      });

      it('should add faction to existing list', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [mockFaction],
          version: '1.0',
          lastUpdated: mockDate,
        });

        await createFaction({ name: 'Second Faction', description: 'Test' });

        const savedData = (SafeAsyncStorageJSONParser.setItem as jest.Mock).mock
          .calls[0][1];
        expect(savedData.factions).toHaveLength(2);
      });
    });

    describe('updateFaction', () => {
      it('should update existing faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [mockFaction],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateFaction('Brotherhood', {
          description: 'Updated description',
        });

        expect(result).not.toBeNull();
        expect(result?.description).toBe('Updated description');
      });

      it('should return null for non-existent faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [mockFaction],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateFaction('NonExistent', {
          description: 'Test',
        });

        expect(result).toBeNull();
      });
    });

    describe('deleteFaction', () => {
      it('should delete existing faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [mockFaction],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteFaction('Brotherhood');

        expect(result).toBe(true);
        const savedData = (SafeAsyncStorageJSONParser.setItem as jest.Mock).mock
          .calls[0][1];
        expect(savedData.factions).toHaveLength(0);
      });

      it('should return false for non-existent faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteFaction('NonExistent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Location Operations', () => {
    const mockLocation: GameLocation = {
      id: 'loc-1',
      name: 'Test Location',
      description: 'Test location description',
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    describe('loadLocations', () => {
      it('should return empty array when no locations exist', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          null
        );

        const result = await loadLocations();

        expect(result).toEqual([]);
      });

      it('should return locations from storage', async () => {
        const mockDataset = {
          locations: [mockLocation],
          version: '1.0',
          lastUpdated: mockDate,
        };
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          mockDataset
        );

        const result = await loadLocations();

        expect(result).toEqual([mockLocation]);
      });
    });

    describe('saveLocations', () => {
      it('should save locations with proper dataset structure', async () => {
        const locations = [mockLocation];

        await saveLocations(locations);

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_locations',
          {
            locations,
            version: '1.0',
            lastUpdated: mockDate,
          }
        );
      });
    });

    describe('createLocation', () => {
      it('should create a new location with generated ID', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const newLocationData = {
          name: 'New Location',
          description: 'New location description',
        };

        const result = await createLocation(newLocationData);

        expect(result).not.toBeNull();
        expect(result?.id).toBe('mock-uuid-1234');
        expect(result?.name).toBe('New Location');
        expect(result?.createdAt).toBe(mockDate);
        expect(result?.updatedAt).toBe(mockDate);
      });

      it('should persist mapImageUri when creating a location', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await createLocation({
          name: 'Portland 2026',
          description: '',
          mapImageUri: 'file:///portland-map.jpg',
        });

        expect(result?.mapImageUri).toBe('file:///portland-map.jpg');
      });
    });

    describe('updateLocation', () => {
      it('should update existing location', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [mockLocation],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateLocation('loc-1', {
          name: 'Updated Location',
        });

        expect(result).not.toBeNull();
        expect(result?.name).toBe('Updated Location');
      });

      it('should return null for non-existent location', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateLocation('non-existent', { name: 'Test' });

        expect(result).toBeNull();
      });

      it('should persist mapPins added to a location', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [mockLocation],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateLocation('loc-1', {
          mapPins: [{ id: 'pin-1', locationId: 'loc-2', x: 0.5, y: 0.5 }],
        });

        expect(result?.mapPins).toEqual([
          { id: 'pin-1', locationId: 'loc-2', x: 0.5, y: 0.5 },
        ]);
      });
    });

    describe('deleteLocation', () => {
      it('should delete existing location', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [mockLocation],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteLocation('loc-1');

        expect(result).toBe(true);
      });

      it('should return false for non-existent location', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteLocation('non-existent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Event Operations', () => {
    const mockEvent: GameEvent = {
      id: 'event-1',
      title: 'Test Event',
      description: 'Test event description',
      date: mockDate,
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    describe('loadEvents', () => {
      it('should return empty array when no events exist', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          null
        );

        const result = await loadEvents();

        expect(result).toEqual([]);
      });

      it('should return events from storage', async () => {
        const mockDataset = {
          events: [mockEvent],
          version: '1.0',
          lastUpdated: mockDate,
        };
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          mockDataset
        );

        const result = await loadEvents();

        expect(result).toEqual([mockEvent]);
      });
    });

    describe('saveEvents', () => {
      it('should save events with proper dataset structure', async () => {
        const events = [mockEvent];

        await saveEvents(events);

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_events',
          {
            events,
            version: '1.0',
            lastUpdated: mockDate,
          }
        );
      });
    });

    describe('createEvent', () => {
      it('should create a new event with generated ID', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          events: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const newEventData = {
          title: 'New Event',
          description: 'New event description',
          date: mockDate,
        };

        const result = await createEvent(newEventData);

        expect(result).not.toBeNull();
        expect(result?.id).toBe('mock-uuid-1234');
        expect(result?.title).toBe('New Event');
        expect(result?.createdAt).toBe(mockDate);
        expect(result?.updatedAt).toBe(mockDate);
      });
    });

    describe('updateEvent', () => {
      it('should update existing event', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          events: [mockEvent],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateEvent('event-1', { title: 'Updated Event' });

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Updated Event');
      });

      it('should return null for non-existent event', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          events: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateEvent('non-existent', { title: 'Test' });

        expect(result).toBeNull();
      });
    });

    describe('deleteEvent', () => {
      it('should delete existing event', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          events: [mockEvent],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteEvent('event-1');

        expect(result).toBe(true);
      });

      it('should return false for non-existent event', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          events: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteEvent('non-existent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Quest Operations', () => {
    const mockQuest: GameQuest = {
      id: 'quest-1',
      name: 'Test Quest',
      status: QuestStatus.NotStarted,
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    describe('loadQuests', () => {
      it('should return empty array when no quests exist', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          null
        );

        const result = await loadQuests();

        expect(result).toEqual([]);
      });

      it('should return quests from storage', async () => {
        const mockDataset = {
          quests: [mockQuest],
          version: '1.0',
          lastUpdated: mockDate,
        };
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          mockDataset
        );

        const result = await loadQuests();

        expect(result).toEqual([mockQuest]);
      });
    });

    describe('saveQuests', () => {
      it('should save quests with proper dataset structure', async () => {
        const quests = [mockQuest];

        await saveQuests(quests);

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_quests',
          {
            quests,
            version: '1.0',
            lastUpdated: mockDate,
          }
        );
      });
    });

    describe('createQuest', () => {
      it('should create a new quest with generated ID', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          quests: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const newQuestData = {
          name: 'New Quest',
          status: QuestStatus.NotStarted,
        };

        const result = await createQuest(newQuestData);

        expect(result).not.toBeNull();
        expect(result?.id).toBe('mock-uuid-1234');
        expect(result?.name).toBe('New Quest');
        expect(result?.createdAt).toBe(mockDate);
        expect(result?.updatedAt).toBe(mockDate);
      });
    });

    describe('updateQuest', () => {
      it('should update existing quest', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          quests: [mockQuest],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateQuest('quest-1', { name: 'Updated Quest' });

        expect(result).not.toBeNull();
        expect(result?.name).toBe('Updated Quest');
      });

      it('should return null for non-existent quest', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          quests: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await updateQuest('non-existent', { name: 'Test' });

        expect(result).toBeNull();
      });
    });

    describe('deleteQuest', () => {
      it('should delete existing quest', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          quests: [mockQuest],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteQuest('quest-1');

        expect(result).toBe(true);
      });

      it('should return false for non-existent quest', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          quests: [],
          version: '1.0',
          lastUpdated: mockDate,
        });

        const result = await deleteQuest('non-existent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Storage Management', () => {
    describe('clearStorage', () => {
      it('should remove all storage keys', async () => {
        await clearStorage();

        expect(SafeAsyncStorageJSONParser.removeItem).toHaveBeenCalledTimes(5);
        expect(SafeAsyncStorageJSONParser.removeItem).toHaveBeenCalledWith(
          'gameCharacterManager'
        );
        expect(SafeAsyncStorageJSONParser.removeItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions'
        );
        expect(SafeAsyncStorageJSONParser.removeItem).toHaveBeenCalledWith(
          'gameCharacterManager_locations'
        );
        expect(SafeAsyncStorageJSONParser.removeItem).toHaveBeenCalledWith(
          'gameCharacterManager_events'
        );
        expect(SafeAsyncStorageJSONParser.removeItem).toHaveBeenCalledWith(
          'gameCharacterManager_quests'
        );
      });
    });
  });

  describe('Advanced Features (Exported Functions)', () => {
    describe('importDataset with location migration paths', () => {
      it('should migrate old location field to locationId during import', async () => {
        const oldCharacterData = {
          characters: [
            {
              id: 'char-1',
              name: 'Test',
              location: 'Old Town', // Old location field
              facets: { archetypes: ['Human'], traits: [], qualities: [] },
              factions: [],
              relationships: [],
              retired: false,
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          factions: [],
          locations: [],
          events: [],
        };

        // Mock loadCharacters, loadFactions, loadLocations, loadEvents
        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ events: [], version: '1.0' });

        const result = await importDataset(JSON.stringify(oldCharacterData));

        expect(result).toBe(true);
        // Should have created a new location during migration
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_locations',
          expect.objectContaining({
            locations: expect.arrayContaining([
              expect.objectContaining({
                name: 'Old Town',
                description: expect.stringContaining('Migrated from old'),
              }),
            ]),
          })
        );
      });

      it('should create placeholder location for missing locationId during import', async () => {
        const characterWithMissingLocation = {
          characters: [
            {
              id: 'char-1',
              name: 'Test',
              locationId: 'nonexistent-location-id',
              facets: { archetypes: ['Human'], traits: [], qualities: [] },
              factions: [],
              relationships: [],
              retired: false,
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          factions: [],
          locations: [],
          events: [],
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ events: [], version: '1.0' });

        const result = await importDataset(
          JSON.stringify(characterWithMissingLocation)
        );

        expect(result).toBe(true);
        // Should have auto-created placeholder location
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_locations',
          expect.objectContaining({
            locations: expect.arrayContaining([
              expect.objectContaining({
                id: 'nonexistent-location-id',
                name: expect.stringContaining('Imported Location'),
              }),
            ]),
          })
        );
      });
    });

    describe('Faction Description Management', () => {
      it('should save faction description for existing faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [{ name: 'Brotherhood', description: 'Old description' }],
          version: '1.0',
        });

        await CharacterStorage.saveFactionDescription(
          'Brotherhood',
          'New description'
        );

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: [
              expect.objectContaining({
                name: 'Brotherhood',
                description: 'New description',
              }),
            ],
          })
        );
      });

      it('should create new faction when saving description for non-existent faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [],
          version: '1.0',
        });

        await CharacterStorage.saveFactionDescription(
          'NewFaction',
          'New description'
        );

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: [
              expect.objectContaining({
                name: 'NewFaction',
                description: 'New description',
              }),
            ],
          })
        );
      });
    });

    describe('deleteFactionCompletely', () => {
      it('should remove faction from all characters and delete faction', async () => {
        const characterWithFaction: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [
            { name: 'ToDelete', relationshipTypeId: 'ally' },
            { name: 'ToKeep', relationshipTypeId: 'neutral' },
          ],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [characterWithFaction],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({
            factions: [
              { name: 'ToDelete', description: 'Will be deleted' },
              { name: 'ToKeep', description: 'Will be kept' },
            ],
            version: '1.0',
          });

        const result =
          await CharacterStorage.deleteFactionCompletely('ToDelete');

        expect(result.success).toBe(true);
        expect(result.charactersUpdated).toBe(1);
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager',
          expect.objectContaining({
            characters: [
              expect.objectContaining({
                factions: [{ name: 'ToKeep', relationshipTypeId: 'neutral' }],
              }),
            ],
          })
        );
      });

      it('should return error on failure', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockRejectedValue(
          new Error('Storage error')
        );

        const result =
          await CharacterStorage.deleteFactionCompletely('ToDelete');

        expect(result.success).toBe(false);
        expect(result.charactersUpdated).toBe(0);
      });
    });

    describe('Faction Bidirectional Relationships', () => {
      it('should create bidirectional relationships when creating faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [{ name: 'ExistingFaction', relationships: [] }],
          version: '1.0',
        });

        const newFaction = {
          name: 'NewFaction',
          description: 'Test',
          relationships: [
            {
              factionName: 'ExistingFaction',
              relationshipTypeId: 'ally',
            },
          ],
        };

        await createFaction(newFaction);

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: expect.arrayContaining([
              expect.objectContaining({
                name: 'ExistingFaction',
                relationships: [
                  {
                    factionName: 'NewFaction',
                    relationshipTypeId: 'ally',
                  },
                ],
              }),
            ]),
          })
        );
      });

      it('should handle faction name changes and update all references', async () => {
        const faction1 = {
          name: 'OldName',
          description: 'Test',
          relationships: [],
        };
        const faction2 = {
          name: 'OtherFaction',
          description: 'Other',
          relationships: [
            {
              factionName: 'OldName',
              relationshipTypeId: 'ally',
            },
          ],
        };

        const character: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [{ name: 'OldName', relationshipTypeId: 'ally' }],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            factions: [faction1, faction2],
            version: '1.0',
          })
          .mockResolvedValueOnce({
            characters: [character],
            version: '1.0',
            lastUpdated: mockDate,
          });

        const result = await updateFaction('OldName', { name: 'NewName' });

        expect(result?.name).toBe('NewName');
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager',
          expect.objectContaining({
            characters: [
              expect.objectContaining({
                factions: [{ name: 'NewName', relationshipTypeId: 'ally' }],
              }),
            ],
          })
        );
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: expect.arrayContaining([
              expect.objectContaining({
                name: 'OtherFaction',
                relationships: [
                  {
                    factionName: 'NewName',
                    relationshipTypeId: 'ally',
                  },
                ],
              }),
            ]),
          })
        );
      });

      it('should return null when new faction name already exists', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [
            { name: 'ExistingFaction', description: 'Test' },
            { name: 'AnotherFaction', description: 'Test2' },
          ],
          version: '1.0',
        });

        const result = await updateFaction('ExistingFaction', {
          name: 'AnotherFaction',
        });

        expect(result).toBeNull();
      });

      it('should handle removed relationships by removing reciprocals', async () => {
        const faction1 = {
          name: 'Faction1',
          description: 'Test',
          relationships: [
            {
              factionName: 'Faction2',
              relationshipTypeId: 'ally',
            },
          ],
        };
        const faction2 = {
          name: 'Faction2',
          description: 'Test',
          relationships: [
            {
              factionName: 'Faction1',
              relationshipTypeId: 'ally',
            },
          ],
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [faction1, faction2],
          version: '1.0',
        });

        await updateFaction('Faction1', { relationships: [] });

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: expect.arrayContaining([
              expect.objectContaining({
                name: 'Faction2',
                relationships: [],
              }),
            ]),
          })
        );
      });

      it('should handle added relationships by creating reciprocals', async () => {
        const faction1 = {
          name: 'Faction1',
          description: 'Test',
          relationships: [],
        };
        const faction2 = {
          name: 'Faction2',
          description: 'Test',
          relationships: [],
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [faction1, faction2],
          version: '1.0',
        });

        await updateFaction('Faction1', {
          relationships: [
            {
              factionName: 'Faction2',
              relationshipTypeId: 'enemy',
            },
          ],
        });

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: expect.arrayContaining([
              expect.objectContaining({
                name: 'Faction2',
                relationships: [
                  {
                    factionName: 'Faction1',
                    relationshipTypeId: 'enemy',
                  },
                ],
              }),
            ]),
          })
        );
      });

      it('should handle changed relationship types by updating reciprocals', async () => {
        const faction1 = {
          name: 'Faction1',
          description: 'Test',
          relationships: [
            {
              factionName: 'Faction2',
              relationshipTypeId: 'ally',
            },
          ],
        };
        const faction2 = {
          name: 'Faction2',
          description: 'Test',
          relationships: [
            {
              factionName: 'Faction1',
              relationshipTypeId: 'ally',
            },
          ],
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [faction1, faction2],
          version: '1.0',
        });

        await updateFaction('Faction1', {
          relationships: [
            {
              factionName: 'Faction2',
              relationshipTypeId: 'enemy',
            },
          ],
        });

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: expect.arrayContaining([
              expect.objectContaining({
                name: 'Faction2',
                relationships: [
                  {
                    factionName: 'Faction1',
                    relationshipTypeId: 'enemy',
                  },
                ],
              }),
            ]),
          })
        );
      });
    });

    describe('toggleFactionRetired', () => {
      it('should toggle faction retired status', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [{ name: 'TestFaction', retired: false }],
          version: '1.0',
        });

        const result =
          await CharacterStorage.toggleFactionRetired('TestFaction');

        expect(result).toBe(true);
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: [
              expect.objectContaining({
                name: 'TestFaction',
                retired: true,
              }),
            ],
          })
        );
      });

      it('should return false for non-existent faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [],
          version: '1.0',
        });

        const result =
          await CharacterStorage.toggleFactionRetired('NonExistent');

        expect(result).toBe(false);
      });
    });

    describe('migrateFactionDescriptions', () => {
      it('should migrate faction descriptions from characters to centralized storage', async () => {
        const character: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [
            {
              name: 'Brotherhood',
              relationshipTypeId: 'ally',
              description: 'A powerful faction from character data',
            },
          ],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [character],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' });

        await CharacterStorage.migrateFactionDescriptions();

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: [
              expect.objectContaining({
                name: 'Brotherhood',
                description: 'A powerful faction from character data',
              }),
            ],
          })
        );
      });

      it('should not overwrite existing faction descriptions', async () => {
        const character: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [
            {
              name: 'Brotherhood',
              relationshipTypeId: 'ally',
              description: 'From character',
            },
          ],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [character],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({
            factions: [
              {
                name: 'Brotherhood',
                description: 'Existing description',
              },
            ],
            version: '1.0',
          });

        await CharacterStorage.migrateFactionDescriptions();

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: [
              expect.objectContaining({
                name: 'Brotherhood',
                description: 'Existing description',
              }),
            ],
          })
        );
      });
    });

    describe('migrateImageUris', () => {
      it('backfills a legacy imageUri into imageUris and strips it, for every entity type', async () => {
        const character = {
          id: 'char-1',
          name: 'Test',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          imageUri: 'legacy-character.jpg',
          createdAt: mockDate,
          updatedAt: mockDate,
        };
        const faction = {
          name: 'Brotherhood',
          description: '',
          imageUri: 'legacy-faction.jpg',
          createdAt: mockDate,
          updatedAt: mockDate,
        };
        const location = {
          id: 'loc-1',
          name: 'Test Location',
          description: '',
          imageUri: 'legacy-location.jpg',
          createdAt: mockDate,
          updatedAt: mockDate,
        };
        const event = {
          id: 'event-1',
          title: 'Test Event',
          date: '2025-01-01',
          imageUri: 'legacy-event.jpg',
          createdAt: mockDate,
          updatedAt: mockDate,
        };
        const quest = {
          id: 'quest-1',
          name: 'Test Quest',
          status: QuestStatus.NotStarted,
          imageUri: 'legacy-quest.jpg',
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [character],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({
            factions: [faction],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({
            locations: [location],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({
            events: [event],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({
            quests: [quest],
            version: '1.0',
            lastUpdated: mockDate,
          });

        await CharacterStorage.migrateImageUris();

        const setItemMock = SafeAsyncStorageJSONParser.setItem as jest.Mock;

        const savedCharacters = setItemMock.mock.calls.find(
          c => c[0] === 'gameCharacterManager'
        )?.[1];
        expect(savedCharacters.characters[0].imageUris).toEqual([
          'legacy-character.jpg',
        ]);
        expect(savedCharacters.characters[0].imageUri).toBeUndefined();

        const savedFactions = setItemMock.mock.calls.find(
          c => c[0] === 'gameCharacterManager_factions'
        )?.[1];
        expect(savedFactions.factions[0].imageUris).toEqual([
          'legacy-faction.jpg',
        ]);
        expect(savedFactions.factions[0].imageUri).toBeUndefined();

        const savedLocations = setItemMock.mock.calls.find(
          c => c[0] === 'gameCharacterManager_locations'
        )?.[1];
        expect(savedLocations.locations[0].imageUris).toEqual([
          'legacy-location.jpg',
        ]);
        expect(savedLocations.locations[0].imageUri).toBeUndefined();

        const savedEvents = setItemMock.mock.calls.find(
          c => c[0] === 'gameCharacterManager_events'
        )?.[1];
        expect(savedEvents.events[0].imageUris).toEqual(['legacy-event.jpg']);
        expect(savedEvents.events[0].imageUri).toBeUndefined();

        const savedQuests = setItemMock.mock.calls.find(
          c => c[0] === 'gameCharacterManager_quests'
        )?.[1];
        expect(savedQuests.quests[0].imageUris).toEqual(['legacy-quest.jpg']);
        expect(savedQuests.quests[0].imageUri).toBeUndefined();
      });

      it('does not write to storage when no records have a legacy imageUri', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [
              { id: 'char-1', name: 'Test', imageUris: ['already-multi.jpg'] },
            ],
            version: '1.0',
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ events: [], version: '1.0' })
          .mockResolvedValueOnce({ quests: [], version: '1.0' });

        await CharacterStorage.migrateImageUris();

        expect(SafeAsyncStorageJSONParser.setItem).not.toHaveBeenCalled();
      });

      it('preserves an existing imageUris array rather than overwriting it with the legacy value', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [
              {
                id: 'char-1',
                name: 'Test',
                imageUri: 'legacy.jpg',
                imageUris: ['already-multi.jpg'],
              },
            ],
            version: '1.0',
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ events: [], version: '1.0' })
          .mockResolvedValueOnce({ quests: [], version: '1.0' });

        await CharacterStorage.migrateImageUris();

        const saved = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.find(c => c[0] === 'gameCharacterManager')?.[1];
        expect(saved.characters[0].imageUris).toEqual(['already-multi.jpg']);
        expect(saved.characters[0].imageUri).toBeUndefined();
      });

      it('is a no-op (idempotent) when storage is empty for every key', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          null
        );

        await expect(
          CharacterStorage.migrateImageUris()
        ).resolves.toBeUndefined();
        expect(SafeAsyncStorageJSONParser.setItem).not.toHaveBeenCalled();
      });
    });

    describe('migrateLegacyLocationMapCoordinates', () => {
      it('converts every legacy mapCoordinates pin onto a synthetic "Legacy Map" location', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [
            {
              id: 'loc-1',
              name: 'The Docks',
              description: '',
              mapCoordinates: { x: 0.25, y: 0.75 },
              createdAt: mockDate,
              updatedAt: mockDate,
            },
            {
              id: 'loc-2',
              name: 'Rust Alley',
              description: '',
              createdAt: mockDate,
              updatedAt: mockDate,
            },
          ],
          version: '1.0',
        });

        await CharacterStorage.migrateLegacyLocationMapCoordinates();

        const saved = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.find(c => c[0] === 'gameCharacterManager_locations')?.[1];

        expect(saved.locations).toHaveLength(3);
        const docks = saved.locations.find(
          (l: GameLocation) => l.id === 'loc-1'
        );
        expect(docks.mapCoordinates).toBeUndefined();
        const legacyMap = saved.locations.find(
          (l: GameLocation) => l.name === 'Legacy Map'
        );
        expect(legacyMap).toBeDefined();
        expect(legacyMap.mapPins).toEqual([
          { id: 'mock-uuid-1234', locationId: 'loc-1', x: 0.25, y: 0.75 },
        ]);
      });

      it('does not write to storage when no location has legacy mapCoordinates', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [{ id: 'loc-1', name: 'The Docks', description: '' }],
          version: '1.0',
        });

        await CharacterStorage.migrateLegacyLocationMapCoordinates();

        expect(SafeAsyncStorageJSONParser.setItem).not.toHaveBeenCalled();
      });

      it('is idempotent — a second run is a no-op since the field is already gone', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValueOnce(
          {
            locations: [
              {
                id: 'loc-1',
                name: 'The Docks',
                description: '',
                mapCoordinates: { x: 0.5, y: 0.5 },
                createdAt: mockDate,
                updatedAt: mockDate,
              },
            ],
            version: '1.0',
          }
        );
        await CharacterStorage.migrateLegacyLocationMapCoordinates();
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledTimes(1);

        const savedAfterFirstRun = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls[0][1];
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValueOnce(
          savedAfterFirstRun
        );

        await CharacterStorage.migrateLegacyLocationMapCoordinates();

        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledTimes(1);
      });

      it('is a no-op when storage is empty', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(
          null
        );

        await expect(
          CharacterStorage.migrateLegacyLocationMapCoordinates()
        ).resolves.toBeUndefined();
        expect(SafeAsyncStorageJSONParser.setItem).not.toHaveBeenCalled();
      });
    });

    describe('Location Management Advanced', () => {
      it('should return null when creating location with duplicate name', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [
            { id: 'loc-1', name: 'Existing Location', description: 'Test' },
          ],
          version: '1.0',
        });

        const result = await createLocation({
          name: 'Existing Location',
          description: 'Duplicate',
        });

        expect(result).toBeNull();
      });

      it('should delete location and remove references from characters', async () => {
        const character: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          locationId: 'loc-to-delete',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [character],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({
            locations: [
              { id: 'loc-to-delete', name: 'ToDelete', description: 'Test' },
            ],
            version: '1.0',
          });

        const result =
          await CharacterStorage.deleteLocationCompletely('loc-to-delete');

        expect(result.success).toBe(true);
        expect(result.charactersUpdated).toBe(1);
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager',
          expect.objectContaining({
            characters: [
              expect.objectContaining({
                locationId: undefined,
              }),
            ],
          })
        );
      });

      it('should return error when deleteLocationCompletely fails', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockRejectedValue(
          new Error('Storage error')
        );

        const result =
          await CharacterStorage.deleteLocationCompletely('loc-id');

        expect(result.success).toBe(false);
        expect(result.charactersUpdated).toBe(0);
      });
    });

    describe('getLocation', () => {
      it('should return location by ID', async () => {
        const mockLocation: GameLocation = {
          id: 'loc-123',
          name: 'Test Location',
          description: 'Test description',
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [mockLocation],
          version: '1.0',
        });

        const result = await CharacterStorage.getLocation('loc-123');

        expect(result).toEqual(mockLocation);
      });

      it('should return null for non-existent location ID', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          locations: [],
          version: '1.0',
        });

        const result = await CharacterStorage.getLocation('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('mergeDatasets with location updates', () => {
      it('should update existing location when imported one is newer', async () => {
        const oldLocation: GameLocation = {
          id: 'loc-1',
          name: 'Old Location Name',
          description: 'Old description',
          createdAt: mockDate,
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        const newerLocation: GameLocation = {
          id: 'loc-1',
          name: 'New Location Name',
          description: 'New description',
          createdAt: mockDate,
          updatedAt: '2025-12-01T00:00:00.000Z',
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [oldLocation], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [],
          factions: [],
          locations: [newerLocation],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);

        expect(result).toBe(true);
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_locations',
          expect.objectContaining({
            locations: [newerLocation],
          })
        );
      });

      it('should add new location when ID does not exist', async () => {
        const existingLocation: GameLocation = {
          id: 'loc-1',
          name: 'Existing',
          description: 'Existing location',
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        const newLocation: GameLocation = {
          id: 'loc-2',
          name: 'New',
          description: 'New location',
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({
            locations: [existingLocation],
            version: '1.0',
          }) // for migrateOldLocationData
          .mockResolvedValueOnce({
            locations: [existingLocation],
            version: '1.0',
          }) // for ensureLocationsExist
          .mockResolvedValueOnce({
            locations: [existingLocation],
            version: '1.0',
          }); // for mergeDatasets actual merge logic

        const jsonData = JSON.stringify({
          characters: [],
          factions: [],
          locations: [newLocation],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);

        expect(result).toBe(true);
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_locations',
          expect.objectContaining({
            locations: expect.arrayContaining([existingLocation, newLocation]),
          })
        );
      });

      it('should not update location when existing one is newer', async () => {
        const newerLocation: GameLocation = {
          id: 'loc-1',
          name: 'Current Name',
          description: 'Current description',
          createdAt: mockDate,
          updatedAt: '2025-12-01T00:00:00.000Z',
        };

        const olderLocation: GameLocation = {
          id: 'loc-1',
          name: 'Old Name',
          description: 'Old description',
          createdAt: mockDate,
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({
            locations: [newerLocation],
            version: '1.0',
          }) // for migrateOldLocationData
          .mockResolvedValueOnce({
            locations: [newerLocation],
            version: '1.0',
          }) // for ensureLocationsExist
          .mockResolvedValueOnce({
            locations: [newerLocation],
            version: '1.0',
          }); // for mergeDatasets actual merge logic

        const jsonData = JSON.stringify({
          characters: [],
          factions: [],
          locations: [olderLocation],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);

        expect(result).toBe(true);
        // Should keep the newer version
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_locations',
          expect.objectContaining({
            locations: [newerLocation],
          })
        );
      });
    });

    describe('getFactionDescription edge cases', () => {
      it('should return empty string when faction has no description', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [{ name: 'Brotherhood' }],
          version: '1.0',
        });

        const result =
          await CharacterStorage.getFactionDescription('Brotherhood');

        expect(result).toBe('');
      });

      it('should return empty string for non-existent faction', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [],
          version: '1.0',
        });

        const result =
          await CharacterStorage.getFactionDescription('NonExistent');

        expect(result).toBe('');
      });
    });

    describe('mergeDatasetWithConflictResolution', () => {
      it('should detect conflicts when character properties differ', async () => {
        const existingChar: GameCharacter = {
          id: 'char-1',
          name: 'John',
          notes: 'Original notes',
          facets: { archetypes: ['Human'], traits: ['perk1'], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        const importedChar: GameCharacter = {
          id: 'char-1',
          name: 'Jane',
          notes: 'Different notes',
          facets: { archetypes: ['Mutant'], traits: ['perk2'], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [existingChar],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [importedChar],
          factions: [],
          locations: [],
        });

        const result =
          await CharacterStorage.mergeDatasetWithConflictResolution(jsonData);

        expect(result.success).toBe(true);
        expect(result.conflicts.length).toBeGreaterThan(0);
        expect(result.conflicts[0].conflicts).toContain('name');
        expect(result.conflicts[0].conflicts).toContain('facets');
        expect(result.conflicts[0].conflicts).toContain('notes');
      });

      it('should merge perks, distinctions, and factions without conflicts', async () => {
        const existingChar: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          facets: {
            archetypes: ['Human'],
            traits: ['perk1'],
            qualities: ['dist1'],
          },
          factions: [{ name: 'Faction1', relationshipTypeId: 'ally' }],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        const importedChar: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          facets: {
            archetypes: ['Human'],
            traits: ['perk2'],
            qualities: ['dist2'],
          },
          factions: [{ name: 'Faction2', relationshipTypeId: 'neutral' }],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [existingChar],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [importedChar],
          factions: [],
          locations: [],
        });

        const result =
          await CharacterStorage.mergeDatasetWithConflictResolution(jsonData);

        expect(result.success).toBe(true);
        expect(result.conflicts).toHaveLength(0);
        expect(result.merged[0].facets?.traits).toEqual(['perk1', 'perk2']);
        expect(result.merged[0].facets?.qualities).toEqual(['dist1', 'dist2']);
        expect(result.merged[0].factions).toHaveLength(2);
      });

      it('should use imported value when existing property is empty', async () => {
        const existingChar: GameCharacter = {
          id: 'char-1',
          name: '',
          notes: '',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        const importedChar: GameCharacter = {
          id: 'char-1',
          name: 'Imported Name',
          notes: 'Imported notes',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [existingChar],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [importedChar],
          factions: [],
          locations: [],
        });

        const result =
          await CharacterStorage.mergeDatasetWithConflictResolution(jsonData);

        expect(result.success).toBe(true);
        expect(result.conflicts).toHaveLength(0);
        expect(result.merged[0].name).toBe('Imported Name');
        expect(result.merged[0].notes).toBe('Imported notes');
      });

      it('should merge and update relationships', async () => {
        const existingChar: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          relationships: [
            {
              characterName: 'Alice',
              relationshipTypeId: 'friend',
              description: 'Old friend',
            },
          ],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        const importedChar: GameCharacter = {
          id: 'char-1',
          name: 'Test',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          relationships: [
            {
              characterName: 'Alice',
              relationshipTypeId: 'ally',
              description: 'Best friend now',
            },
            {
              characterName: 'Bob',
              relationshipTypeId: 'enemy',
              description: 'New enemy',
            },
          ],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [existingChar],
            version: '1.0',
            lastUpdated: mockDate,
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [importedChar],
          factions: [],
          locations: [],
        });

        const result =
          await CharacterStorage.mergeDatasetWithConflictResolution(jsonData);

        expect(result.success).toBe(true);
        expect(result.merged[0].relationships).toHaveLength(2);
        expect(result.merged[0].relationships[0].relationshipTypeId).toBe(
          'ally'
        );
        expect(result.merged[0].relationships[0].description).toBe(
          'Best friend now'
        );
        expect(result.merged[0].relationships[1].characterName).toBe('Bob');
      });

      it('should return error result on failure', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockRejectedValue(
          new Error('Storage error')
        );

        const result =
          await CharacterStorage.mergeDatasetWithConflictResolution('{}');

        expect(result.success).toBe(false);
        expect(result.conflicts).toEqual([]);
      });
    });

    describe('createFaction with duplicate detection', () => {
      it('should return false when faction name already exists', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [
            { name: 'ExistingFaction', description: 'Already exists' },
          ],
          version: '1.0',
        });

        const result = await createFaction({
          name: 'ExistingFaction',
          description: 'Duplicate',
        });

        expect(result).toBe(false);
      });

      it('should create faction with bidirectional relationships', async () => {
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
          factions: [
            {
              name: 'TargetFaction',
              description: 'Target',
              relationships: [],
            },
          ],
          version: '1.0',
        });

        const result = await createFaction({
          name: 'NewFaction',
          description: 'New',
          relationships: [
            {
              factionName: 'TargetFaction',
              relationshipTypeId: 'hostile',
            },
          ],
        });

        expect(result).toBe(true);
        // Check that reciprocal relationship was created
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager_factions',
          expect.objectContaining({
            factions: expect.arrayContaining([
              expect.objectContaining({
                name: 'TargetFaction',
                relationships: expect.arrayContaining([
                  expect.objectContaining({
                    factionName: 'NewFaction',
                    relationshipTypeId: 'hostile',
                  }),
                ]),
              }),
            ]),
          })
        );
      });
    });

    describe('mergeDatasets error handling', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockReset();
        (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockReset();
      });

      it('should return false when JSON parsing fails', async () => {
        const result = await CharacterStorage.mergeDatasets('invalid json');
        expect(result).toBe(false);
      });

      it('should return false when storage operations fail', async () => {
        const testChar: GameCharacter = {
          id: 'test-1',
          name: 'Test',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockRejectedValue(
          new Error('Storage error')
        );

        const jsonData = JSON.stringify({
          characters: [testChar],
          factions: [],
          locations: [],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);
        expect(result).toBe(false);
      });
    });

    describe('mergeDatasets with faction updates', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockReset();
        (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockReset();
      });

      it('should add new faction when name does not exist', async () => {
        const existingFaction: StoredFaction = {
          name: 'ExistingFaction',
          description: 'Existing',
          relationships: [],
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        const newFaction: StoredFaction = {
          name: 'NewFaction',
          description: 'New',
          relationships: [],
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({
            factions: [existingFaction],
            version: '1.0',
          })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [],
          factions: [newFaction],
          locations: [],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);

        expect(result).toBe(true);
        const factionCalls = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.filter(
          call => call[0] === 'gameCharacterManager_factions'
        );
        expect(factionCalls.length).toBeGreaterThan(0);
        const savedFactions = factionCalls[0][1].factions;
        expect(savedFactions).toHaveLength(2);
        expect(savedFactions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'ExistingFaction',
              description: 'Existing',
            }),
            expect.objectContaining({
              name: 'NewFaction',
              description: 'New',
            }),
          ])
        );
      });

      it('should update faction when imported one is newer', async () => {
        jest.clearAllMocks();

        const olderFaction: StoredFaction = {
          name: 'TestFaction',
          description: 'Old description',
          relationships: [],
          createdAt: mockDate,
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        const newerFaction: StoredFaction = {
          name: 'TestFaction',
          description: 'New description',
          relationships: [],
          createdAt: mockDate,
          updatedAt: '2025-12-01T00:00:00.000Z',
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({
            factions: [olderFaction],
            version: '1.0',
          })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [],
          factions: [newerFaction],
          locations: [],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);

        expect(result).toBe(true);
        const factionCalls = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.filter(
          call => call[0] === 'gameCharacterManager_factions'
        );
        expect(factionCalls.length).toBeGreaterThan(0);
        const savedFactions = factionCalls[0][1].factions;
        expect(savedFactions).toHaveLength(1);
        expect(savedFactions[0]).toEqual(
          expect.objectContaining({
            name: 'TestFaction',
            description: 'New description',
            updatedAt: '2025-12-01T00:00:00.000Z',
          })
        );
      });

      it('should not update faction when existing one is newer', async () => {
        jest.clearAllMocks();

        const newerFaction: StoredFaction = {
          name: 'TestFaction',
          description: 'Current description',
          relationships: [],
          createdAt: mockDate,
          updatedAt: '2025-12-01T00:00:00.000Z',
        };

        const olderFaction: StoredFaction = {
          name: 'TestFaction',
          description: 'Old description',
          relationships: [],
          createdAt: mockDate,
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({
            factions: [newerFaction],
            version: '1.0',
          })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [],
          factions: [olderFaction],
          locations: [],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);

        expect(result).toBe(true);
        const factionCalls = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.filter(
          call => call[0] === 'gameCharacterManager_factions'
        );
        expect(factionCalls.length).toBeGreaterThan(0);
        const savedFactions = factionCalls[0][1].factions;
        expect(savedFactions).toHaveLength(1);
        expect(savedFactions[0]).toEqual(
          expect.objectContaining({
            name: 'TestFaction',
            description: 'Current description',
            updatedAt: '2025-12-01T00:00:00.000Z',
          })
        );
      });
    });

    describe('mergeDatasetWithConflictResolution with location updates', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockReset();
        (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockReset();
      });

      it('should add new location when ID does not exist', async () => {
        const existingLocation: GameLocation = {
          id: 'loc-1',
          name: 'Existing Location',
          description: 'Existing',
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        const newLocation: GameLocation = {
          id: 'loc-2',
          name: 'New Location',
          description: 'New',
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({
            locations: [existingLocation],
            version: '1.0',
          })
          .mockResolvedValueOnce({
            locations: [existingLocation],
            version: '1.0',
          })
          .mockResolvedValueOnce({
            locations: [existingLocation],
            version: '1.0',
          });

        const jsonData = JSON.stringify({
          characters: [],
          factions: [],
          locations: [newLocation],
        });

        const result =
          await CharacterStorage.mergeDatasetWithConflictResolution(jsonData);

        expect(result.success).toBe(true);
        const locationCalls = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.filter(
          call => call[0] === 'gameCharacterManager_locations'
        );
        expect(locationCalls.length).toBeGreaterThan(0);
        const savedLocations = locationCalls[0][1].locations;
        expect(savedLocations).toHaveLength(2);
        expect(savedLocations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'loc-1',
              name: 'Existing Location',
            }),
            expect.objectContaining({
              id: 'loc-2',
              name: 'New Location',
            }),
          ])
        );
      });

      it('should update location when imported one is newer', async () => {
        jest.clearAllMocks();

        const olderLocation: GameLocation = {
          id: 'loc-1',
          name: 'Old Name',
          description: 'Old description',
          createdAt: mockDate,
          updatedAt: '2024-01-01T00:00:00.000Z',
        };

        const newerLocation: GameLocation = {
          id: 'loc-1',
          name: 'New Name',
          description: 'New description',
          createdAt: mockDate,
          updatedAt: '2025-12-01T00:00:00.000Z',
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({ characters: [], version: '1.0' })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({
            locations: [olderLocation],
            version: '1.0',
          })
          .mockResolvedValueOnce({
            locations: [olderLocation],
            version: '1.0',
          })
          .mockResolvedValueOnce({
            locations: [olderLocation],
            version: '1.0',
          });

        const jsonData = JSON.stringify({
          characters: [],
          factions: [],
          locations: [newerLocation],
        });

        const result =
          await CharacterStorage.mergeDatasetWithConflictResolution(jsonData);

        expect(result.success).toBe(true);
        const locationCalls = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.filter(
          call => call[0] === 'gameCharacterManager_locations'
        );
        expect(locationCalls.length).toBeGreaterThan(0);
        const savedLocations = locationCalls[0][1].locations;
        expect(savedLocations).toHaveLength(1);
        expect(savedLocations[0]).toEqual(
          expect.objectContaining({
            id: 'loc-1',
            name: 'New Name',
            updatedAt: '2025-12-01T00:00:00.000Z',
          })
        );
      });
    });

    describe('deleteFactionCompletely with character cleanup', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockReset();
        (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockReset();
      });

      it('should update characters when they have the faction being deleted', async () => {
        const factionToDelete: FactionMembership = {
          name: 'ToDelete',
          relationshipTypeId: 'neutral',
        };
        const factionToKeep: FactionMembership = {
          name: 'ToKeep',
          relationshipTypeId: 'ally',
        };

        const characterWithFaction: GameCharacter = {
          id: 'char-1',
          name: 'Test Character',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [factionToDelete, factionToKeep],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [characterWithFaction],
            version: '1.0',
          })
          .mockResolvedValueOnce({
            factions: [
              {
                name: 'ToDelete',
                description: 'Will be deleted',
                relationships: [],
              },
            ],
            version: '1.0',
          });

        const result = await deleteFactionCompletely('ToDelete');

        expect(result.success).toBe(true);
        expect(result.charactersUpdated).toBe(1);
        expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
          'gameCharacterManager',
          expect.objectContaining({
            characters: [
              expect.objectContaining({
                id: 'char-1',
                factions: [factionToKeep],
              }),
            ],
          })
        );
      });

      it('should not save characters if none were updated', async () => {
        const otherFaction: FactionMembership = {
          name: 'OtherFaction',
          relationshipTypeId: 'ally',
        };

        const characterWithoutFaction: GameCharacter = {
          id: 'char-2',
          name: 'Other Character',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [otherFaction],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [characterWithoutFaction],
            version: '1.0',
          })
          .mockResolvedValueOnce({
            factions: [
              {
                name: 'ToDelete',
                description: 'Will be deleted',
                relationships: [],
              },
            ],
            version: '1.0',
          });

        // Clear previous mock calls
        (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockClear();

        const result = await deleteFactionCompletely('ToDelete');

        expect(result.success).toBe(true);
        expect(result.charactersUpdated).toBe(0);

        // Should only call setItem once for deleting faction, not for characters
        const calls = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.filter(call => call[0] === 'gameCharacterManager');
        expect(calls.length).toBe(0);
      });
    });

    describe('mergeDatasets with character merging branches', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockReset();
        (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockReset();
      });

      it('should add new character when ID does not exist', async () => {
        const existingChar: GameCharacter = {
          id: 'char-1',
          name: 'Existing',
          facets: { archetypes: ['Human'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        const newChar: GameCharacter = {
          id: 'char-2',
          name: 'New Character',
          facets: { archetypes: ['Mutant'], traits: [], qualities: [] },
          factions: [],
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [existingChar],
            version: '1.0',
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [newChar],
          factions: [],
          locations: [],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);

        expect(result).toBe(true);
        const charCalls = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.filter(call => call[0] === 'gameCharacterManager');
        expect(charCalls.length).toBeGreaterThan(0);
        const savedCharacters = charCalls[0][1].characters;
        expect(savedCharacters).toHaveLength(2);
        expect(savedCharacters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'char-1', name: 'Existing' }),
            expect.objectContaining({ id: 'char-2', name: 'New Character' }),
          ])
        );
      });

      it('should merge character arrays when ID already exists', async () => {
        const faction1: FactionMembership = {
          name: 'Faction1',
          relationshipTypeId: 'ally',
        };
        const faction2: FactionMembership = {
          name: 'Faction2',
          relationshipTypeId: 'neutral',
        };

        const existingChar: GameCharacter = {
          id: 'char-1',
          name: 'Test Character',
          facets: {
            archetypes: ['Human'],
            traits: ['perk1'],
            qualities: ['dist1'],
          },
          factions: [faction1],
          relationships: [],
          notes: 'Original notes',
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        // `mergeDatasets` (unlike `importDataset`/
        // `mergeDatasetWithConflictResolution`) does not run imported data
        // through `normalizeDatasetRulesetFields`, so the import must already
        // be in the current `facets` shape.
        const importedChar: GameCharacter = {
          id: 'char-1',
          name: 'Test Character',
          facets: {
            archetypes: ['Human'],
            traits: ['perk2', 'perk3'], // New perks
            qualities: ['dist2'], // New distinction
          },
          factions: [faction2], // New faction
          relationships: [],
          retired: false,
          createdAt: mockDate,
          updatedAt: mockDate,
        };

        (SafeAsyncStorageJSONParser.getItem as jest.Mock)
          .mockResolvedValueOnce({
            characters: [existingChar],
            version: '1.0',
          })
          .mockResolvedValueOnce({ factions: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' })
          .mockResolvedValueOnce({ locations: [], version: '1.0' });

        const jsonData = JSON.stringify({
          characters: [importedChar],
          factions: [],
          locations: [],
        });

        const result = await CharacterStorage.mergeDatasets(jsonData);

        expect(result).toBe(true);
        const charCalls = (
          SafeAsyncStorageJSONParser.setItem as jest.Mock
        ).mock.calls.filter(call => call[0] === 'gameCharacterManager');
        expect(charCalls.length).toBeGreaterThan(0);
        const savedCharacters = charCalls[0][1].characters;
        expect(savedCharacters).toHaveLength(1);
        // Should merge arrays - combining perks, distinctions, and factions
        expect(savedCharacters[0]).toEqual(
          expect.objectContaining({
            id: 'char-1',
            facets: expect.objectContaining({
              archetypes: ['Human'],
              traits: ['perk1', 'perk2', 'perk3'],
              qualities: ['dist1', 'dist2'],
            }),
            factions: [faction1, faction2],
          })
        );
      });
    });
  });
});
