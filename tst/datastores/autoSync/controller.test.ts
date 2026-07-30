import {
  autoSyncController,
  resetAutoSyncController,
} from '@/datastores/autoSync/controller';
import * as autoSyncPreferences from '@utils/autoSyncPreferences';
import type { AutoSyncPreferences } from '@utils/autoSyncPreferences';
import * as appState from '@/datastores/autoSync/appState';
import type { AppStateStatus } from '@/datastores/autoSync/appState';
import { notifyLocalDataChanged } from '@utils/dataChangeSignal';
import type { DataStore, DataStoreContext } from '@/datastores/types';
import type { RulesetDefinition } from '@/ruleset/types';

// This is the repo's first fake-timer suite, kept file-scoped (never in
// jest.setup.js) so no other suite's real-timer `waitFor` calls are
// affected. `advanceTimersByTimeAsync` (not the sync variant) is required
// because every tick's work — exportDataset, preferences reads, `run` — is
// async; the sync variant fires the timer but leaves the promise chain
// unresolved before the next assertion runs.
jest.mock('@utils/autoSyncPreferences');
jest.mock('@/datastores/autoSync/appState');

const prefs = jest.mocked(autoSyncPreferences);
const appStateMock = jest.mocked(appState);

const emptyDatasetJson = () =>
  JSON.stringify({
    characters: [],
    factions: [],
    locations: [],
    events: [],
    quests: [],
  });

const makeCtx = (): DataStoreContext => ({
  ruleset: {} as RulesetDefinition,
  exportDataset: jest.fn().mockResolvedValue(emptyDatasetJson()),
  importDataset: jest.fn(),
  mergeDataset: jest.fn(),
});

const makeStore = (run: jest.Mock, intervalMs = 60_000): DataStore => ({
  id: 'test-store',
  label: 'Test Store',
  autoSync: { run, defaultIntervalMs: intervalMs },
});

const withPrefs = (
  overrides: Partial<AutoSyncPreferences> = {}
): AutoSyncPreferences => ({
  stores: {},
  state: {},
  ...overrides,
});

const enabledPrefs = (intervalMs = 60_000): AutoSyncPreferences =>
  withPrefs({ stores: { 'test-store': { enabled: true, intervalMs } } });

let currentAppState: AppStateStatus = 'active';
let appStateListener: ((status: AppStateStatus) => void) | undefined;

describe('autoSyncController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    currentAppState = 'active';
    appStateListener = undefined;

    appStateMock.getAppStateStatus.mockImplementation(() => currentAppState);
    appStateMock.subscribeAppState.mockImplementation(listener => {
      appStateListener = listener;
      return jest.fn();
    });

    prefs.getAutoSyncPreferences.mockResolvedValue(withPrefs());
    prefs.recordAutoSyncRun.mockResolvedValue(withPrefs());
  });

  afterEach(() => {
    resetAutoSyncController();
    jest.useRealTimers();
  });

  it('does not run a disabled store', async () => {
    const run = jest.fn();
    prefs.getAutoSyncPreferences.mockResolvedValue(
      withPrefs({
        stores: { 'test-store': { enabled: false, intervalMs: 60_000 } },
      })
    );

    autoSyncController.start({ stores: [makeStore(run)], ctx: makeCtx() });
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(run).not.toHaveBeenCalled();
  });

  it('runs an enabled store on its configured interval', async () => {
    const run = jest.fn().mockResolvedValue({ outcome: 'upToDate' });
    prefs.getAutoSyncPreferences.mockResolvedValue(enabledPrefs());

    autoSyncController.start({
      stores: [makeStore(run, 60_000)],
      ctx: makeCtx(),
    });
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst of local-data-change signals into one debounced run', async () => {
    const run = jest.fn().mockResolvedValue({ outcome: 'upToDate' });
    prefs.getAutoSyncPreferences.mockResolvedValue(enabledPrefs());

    autoSyncController.start({
      stores: [makeStore(run, 60_000)],
      ctx: makeCtx(),
    });
    await jest.advanceTimersByTimeAsync(0);

    notifyLocalDataChanged();
    notifyLocalDataChanged();
    notifyLocalDataChanged();
    await jest.advanceTimersByTimeAsync(5_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('stops polling while backgrounded and resumes on foreground', async () => {
    const run = jest.fn().mockResolvedValue({ outcome: 'upToDate' });
    prefs.getAutoSyncPreferences.mockResolvedValue(enabledPrefs());

    autoSyncController.start({
      stores: [makeStore(run, 60_000)],
      ctx: makeCtx(),
    });
    await jest.advanceTimersByTimeAsync(0);

    currentAppState = 'background';
    appStateListener?.('background');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(run).not.toHaveBeenCalled();

    currentAppState = 'active';
    appStateListener?.('active');
    await jest.advanceTimersByTimeAsync(1_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('clears every timer on stop()', async () => {
    const run = jest.fn().mockResolvedValue({ outcome: 'upToDate' });
    prefs.getAutoSyncPreferences.mockResolvedValue(enabledPrefs());

    autoSyncController.start({
      stores: [makeStore(run, 60_000)],
      ctx: makeCtx(),
    });
    await jest.advanceTimersByTimeAsync(0);

    autoSyncController.stop();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('suspends the schedule after an auth failure rather than backing off', async () => {
    const run = jest
      .fn()
      .mockResolvedValue({ outcome: 'failed', errorKind: 'auth' });
    prefs.getAutoSyncPreferences.mockResolvedValue(enabledPrefs());

    autoSyncController.start({
      stores: [makeStore(run, 60_000)],
      ctx: makeCtx(),
    });
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(run).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('exposes the last outcome via getStatus', async () => {
    const run = jest.fn().mockResolvedValue({
      outcome: 'synced',
      stats: { pulled: 1, pushed: 0 },
    });
    prefs.getAutoSyncPreferences.mockResolvedValue(enabledPrefs());

    autoSyncController.start({
      stores: [makeStore(run, 60_000)],
      ctx: makeCtx(),
    });
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(60_000);

    const status = autoSyncController.getStatus('test-store');
    expect(status?.enabled).toBe(true);
    expect(status?.lastOutcome).toBe('synced');
  });
});
