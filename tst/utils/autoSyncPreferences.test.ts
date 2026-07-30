import {
  DEFAULT_AUTO_SYNC_PREFERENCES,
  DEFAULT_AUTO_SYNC_INTERVAL_MS,
  MIN_AUTO_SYNC_INTERVAL_MS,
  MAX_AUTO_SYNC_INTERVAL_MS,
  getAutoSyncPreferences,
  getAutoSyncStorePreferences,
  setAutoSyncEnabled,
  setAutoSyncInterval,
  recordAutoSyncRun,
  clearAutoSyncConflicts,
  resetAutoSyncPreferences,
} from '@/utils/autoSyncPreferences';
import { SafeAsyncStorageJSONParser } from '@/utils/safeAsyncStorageJSONParser';

jest.mock('@/utils/safeAsyncStorageJSONParser');

const KEY = 'gameCharacterManager_autosync_prefs';

describe('autoSyncPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAutoSyncPreferences', () => {
    it('returns the defaults when nothing is stored', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(null);

      expect(await getAutoSyncPreferences()).toEqual(
        DEFAULT_AUTO_SYNC_PREFERENCES
      );
    });

    it('clamps an out-of-range stored interval', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
        stores: { github: { enabled: true, intervalMs: 1 } },
      });

      const prefs = await getAutoSyncPreferences();
      expect(prefs.stores.github).toEqual({
        enabled: true,
        intervalMs: MIN_AUTO_SYNC_INTERVAL_MS,
      });
    });

    it('clamps an over-range stored interval', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
        stores: { github: { enabled: true, intervalMs: 999_999_999 } },
      });

      const prefs = await getAutoSyncPreferences();
      expect(prefs.stores.github.intervalMs).toBe(MAX_AUTO_SYNC_INTERVAL_MS);
    });

    it('keeps two stores independent', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
        stores: {
          github: { enabled: true, intervalMs: DEFAULT_AUTO_SYNC_INTERVAL_MS },
        },
      });

      const prefs = await getAutoSyncPreferences();
      expect(prefs.stores.github.enabled).toBe(true);
      expect(prefs.stores.s3).toBeUndefined();
    });
  });

  describe('getAutoSyncStorePreferences', () => {
    it('returns disabled defaults for a store with no preferences yet', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(null);

      expect(await getAutoSyncStorePreferences('github')).toEqual({
        enabled: false,
        intervalMs: DEFAULT_AUTO_SYNC_INTERVAL_MS,
      });
    });
  });

  describe('setAutoSyncEnabled', () => {
    it('enables one store without touching another', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
        stores: { s3: { enabled: true, intervalMs: 45_000 } },
      });
      (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(true);

      const result = await setAutoSyncEnabled('github', true);

      expect(result.stores.github.enabled).toBe(true);
      expect(result.stores.s3).toEqual({ enabled: true, intervalMs: 45_000 });
      expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
        KEY,
        result
      );
    });
  });

  describe('setAutoSyncInterval', () => {
    it('clamps and persists a new interval', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue(null);
      (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(true);

      const result = await setAutoSyncInterval('github', 1);

      expect(result.stores.github.intervalMs).toBe(MIN_AUTO_SYNC_INTERVAL_MS);
    });
  });

  describe('recordAutoSyncRun', () => {
    it('merges over prior state rather than replacing it', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
        state: { github: { lastOutcome: 'synced', lastRunAt: '2026-01-01' } },
      });
      (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(true);

      const result = await recordAutoSyncRun('github', {
        lastRunAt: '2026-01-02',
        lastOutcome: 'failed',
      });

      expect(result.state.github).toEqual({
        lastOutcome: 'failed',
        lastRunAt: '2026-01-02',
      });
    });

    it('omitting a key leaves the prior value intact', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
        state: {
          github: { lastSyncedFingerprint: 'abc123', lastOutcome: 'synced' },
        },
      });
      (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(true);

      const result = await recordAutoSyncRun('github', {
        lastOutcome: 'failed',
      });

      // lastSyncedFingerprint was never mentioned, so it survives.
      expect(result.state.github.lastSyncedFingerprint).toBe('abc123');
      expect(result.state.github.lastOutcome).toBe('failed');
    });
  });

  describe('clearAutoSyncConflicts', () => {
    it('clears pending conflicts and a conflicts pause', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
        state: {
          github: {
            conflictsPending: 3,
            conflictLabels: ['Alice'],
            pausedReason: 'conflicts',
          },
        },
      });
      (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(true);

      const result = await clearAutoSyncConflicts('github');

      expect(result.state.github.conflictsPending).toBeUndefined();
      expect(result.state.github.conflictLabels).toBeUndefined();
      expect(result.state.github.pausedReason).toBeUndefined();
    });

    it('leaves a non-conflicts pause alone', async () => {
      (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockResolvedValue({
        state: { github: { pausedReason: 'auth' } },
      });
      (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(true);

      const result = await clearAutoSyncConflicts('github');

      expect(result.state.github.pausedReason).toBe('auth');
    });
  });

  describe('resetAutoSyncPreferences', () => {
    it('writes and returns the defaults', async () => {
      (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockResolvedValue(true);

      const result = await resetAutoSyncPreferences();

      expect(result).toEqual(DEFAULT_AUTO_SYNC_PREFERENCES);
      expect(SafeAsyncStorageJSONParser.setItem).toHaveBeenCalledWith(
        KEY,
        DEFAULT_AUTO_SYNC_PREFERENCES
      );
    });
  });
});
