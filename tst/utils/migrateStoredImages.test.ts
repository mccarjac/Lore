import * as FileSystem from 'expo-file-system/legacy';
import { migrateStoredImages } from '@/utils/characterStorage';
import { SafeAsyncStorageJSONParser } from '@/utils/safeAsyncStorageJSONParser';

jest.mock('@/utils/safeAsyncStorageJSONParser');
jest.mock('uuid', () => ({ v4: () => 'generated-uuid' }));

const DOCS = 'file://mock-document-directory/';
const CACHE = 'file://mock-cache-directory/';

const CHARACTER_KEY = 'gameCharacterManager';
const DISCORD_MESSAGES_KEY = 'gameCharacterManager_discord_messages';

/**
 * A stateful stand-in for storage: writes are readable back.
 *
 * Fidelity that matters here — `migrateStoredImages()` runs the legacy
 * `imageUri` fold first and then re-reads what it wrote, so a mock that always
 * replays the original value would hide the second stage entirely.
 */
const storage = (contents: Record<string, unknown>) => {
  const backing: Record<string, unknown> = { ...contents };
  (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockImplementation(
    (key: string) => Promise.resolve(backing[key] ?? null)
  );
  (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockImplementation(
    (key: string, value: unknown) => {
      backing[key] = value;
      return Promise.resolve();
    }
  );
};

const savedUnder = (key: string): unknown =>
  (SafeAsyncStorageJSONParser.setItem as jest.Mock).mock.calls
    .filter(call => call[0] === key)
    .pop()?.[1];

const character = (imageUris: string[]) => ({
  id: 'char-1',
  name: 'Test',
  facets: {},
  factions: [],
  relationships: [],
  imageUris,
  createdAt: '',
  updatedAt: '',
});

describe('migrateStoredImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(
      undefined
    );
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rewrites a documents path and drops one the cache clear took', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) =>
      Promise.resolve({
        exists: path === `${DOCS}images/characters/kept.jpg`,
        isDirectory: false,
      })
    );
    storage({
      [CHARACTER_KEY]: {
        characters: [
          character([
            `${DOCS}images/characters/kept.jpg`,
            `${CACHE}ImagePicker/gone.jpg`,
          ]),
        ],
      },
    });

    await migrateStoredImages();

    const saved = savedUnder(CHARACTER_KEY) as {
      characters: { imageUris: string[] }[];
    };
    expect(saved.characters[0].imageUris).toEqual([
      'lore-file://images/characters/kept.jpg',
    ]);
  });

  it('folds a legacy singular imageUri in before re-homing it', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockImplementation((path: string) =>
      Promise.resolve({
        exists: path === `${DOCS}images/characters/legacy.jpg`,
        isDirectory: false,
      })
    );
    const legacy = {
      ...character([]),
      imageUri: `${DOCS}images/characters/legacy.jpg`,
    };
    delete (legacy as { imageUris?: string[] }).imageUris;
    storage({ [CHARACTER_KEY]: { characters: [legacy] } });

    await migrateStoredImages();

    const saved = savedUnder(CHARACTER_KEY) as {
      characters: { imageUris: string[] }[];
    };
    expect(saved.characters[0].imageUris).toEqual([
      'lore-file://images/characters/legacy.jpg',
    ]);
  });

  it('writes nothing when every reference is already current', async () => {
    storage({
      [CHARACTER_KEY]: {
        characters: [character(['lore-file://images/characters/a.jpg'])],
      },
    });

    await migrateStoredImages();

    expect(savedUnder(CHARACTER_KEY)).toBeUndefined();
  });

  it('sweeps files no collection refers to, discord messages included', async () => {
    (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(
      (dir: string) => {
        if (dir === `${DOCS}images/`) return Promise.resolve(['kept.jpg']);
        if (dir === `${DOCS}discord_images/`)
          return Promise.resolve(['msg.png', 'orphan.png']);
        return Promise.reject(new Error('no such directory'));
      }
    );
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      isDirectory: false,
    });
    storage({
      [CHARACTER_KEY]: {
        characters: [character(['lore-file://images/kept.jpg'])],
      },
      [DISCORD_MESSAGES_KEY]: [
        { id: 'm1', imageUris: ['lore-file://discord_images/msg.png'] },
      ],
    });

    await migrateStoredImages();

    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      `${DOCS}discord_images/orphan.png`,
      { idempotent: true }
    );
  });

  it('refuses to sweep when a collection could not be read', async () => {
    // A keep-list built from a partial read looks like proof that live images
    // are orphans. Deleting on that basis would be this bug, self-inflicted.
    (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(
      (dir: string) =>
        dir === `${DOCS}images/`
          ? Promise.resolve(['live.jpg'])
          : Promise.reject(new Error('no such directory'))
    );
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      isDirectory: false,
    });
    storage({});
    (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockImplementation(
      (key: string) =>
        key === CHARACTER_KEY
          ? Promise.reject(new Error('storage unavailable'))
          : Promise.resolve(null)
    );

    await migrateStoredImages();

    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
