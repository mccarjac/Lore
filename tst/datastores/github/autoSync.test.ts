import { githubAutoSync } from '@/datastores/github/autoSync';
import { createDataStoreContext } from '@/datastores/context';
import * as characterStorage from '@utils/characterStorage';
import * as gitIntegration from '@utils/gitIntegration';
import { genericRuleset } from '../../fixtures/genericRuleset';
import { makeCharacter, makeLocation } from '../../helpers/factories';

// Mirrors GitHubSection.test.tsx's mocking pattern: automocking
// @utils/gitIntegration still loads the real module once to infer the mock
// shape, which imports the real @octokit/rest — whose transitive
// universal-user-agent dependency ships ESM outside transformIgnorePatterns.
jest.mock('@utils/characterStorage');
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('@utils/gitIntegration');

const storage = jest.mocked(characterStorage);
const git = jest.mocked(gitIntegration);

const emptyDataset = () => ({
  characters: [],
  factions: [],
  locations: [],
  events: [],
  quests: [],
});

const emptyStats = () => ({
  characters: { added: 0, updated: 0, removed: 0, conflicted: 0 },
  factions: { added: 0, updated: 0, removed: 0, conflicted: 0 },
  locations: { added: 0, updated: 0, removed: 0, conflicted: 0 },
  events: { added: 0, updated: 0, removed: 0, conflicted: 0 },
  quests: { added: 0, updated: 0, removed: 0, conflicted: 0 },
});

const ctx = () => createDataStoreContext(genericRuleset);

describe('githubAutoSync.run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips when GitHub is not configured', async () => {
    git.isGitHubConfigured.mockResolvedValue(false);

    const result = await githubAutoSync.run(ctx(), {
      reason: 'interval',
      localChanged: false,
    });

    expect(result.outcome).toBe('skipped');
    expect(git.getSyncBaseSnapshot).not.toHaveBeenCalled();
  });

  it('skips when there is no merge base yet', async () => {
    git.isGitHubConfigured.mockResolvedValue(true);
    git.getSyncBaseSnapshot.mockResolvedValue(null);
    git.getGitHubConfig.mockResolvedValue({ token: 'abc123' });

    const result = await githubAutoSync.run(ctx(), {
      reason: 'interval',
      localChanged: false,
    });

    expect(result.outcome).toBe('skipped');
    expect(git.getRemoteHeadSha).not.toHaveBeenCalled();
  });

  it('fails when the head-sha check fails', async () => {
    git.isGitHubConfigured.mockResolvedValue(true);
    git.getSyncBaseSnapshot.mockResolvedValue(emptyDataset());
    git.getGitHubConfig.mockResolvedValue({
      token: 'abc123',
      sync: { baseCommitSha: 'base-sha' },
    });
    git.getRemoteHeadSha.mockResolvedValue({
      success: false,
      errorKind: 'offline',
      error: 'offline',
    });

    const result = await githubAutoSync.run(ctx(), {
      reason: 'interval',
      localChanged: false,
    });

    expect(result.outcome).toBe('failed');
    expect(result.errorKind).toBe('offline');
  });

  it('reports upToDate with exactly one API call when nothing changed', async () => {
    const base = emptyDataset();
    git.isGitHubConfigured.mockResolvedValue(true);
    git.getSyncBaseSnapshot.mockResolvedValue(base);
    git.getGitHubConfig.mockResolvedValue({
      token: 'abc123',
      sync: { baseCommitSha: 'base-sha' },
    });
    git.getRemoteHeadSha.mockResolvedValue({ success: true, sha: 'base-sha' });
    storage.exportDataset.mockResolvedValue(JSON.stringify(base));

    const result = await githubAutoSync.run(ctx(), {
      reason: 'interval',
      localChanged: false,
    });

    expect(result).toEqual({ outcome: 'upToDate' });
    expect(git.computeGitHubSyncPlan).not.toHaveBeenCalled();
    expect(git.pushDatasetToBranch).not.toHaveBeenCalled();
  });

  it('pushes directly when only local data changed and the remote has not moved', async () => {
    const base = emptyDataset();
    const local = {
      ...emptyDataset(),
      characters: [makeCharacter({ id: 'c1', name: 'Alice' })],
    };
    git.isGitHubConfigured.mockResolvedValue(true);
    git.getSyncBaseSnapshot.mockResolvedValue(base);
    git.getGitHubConfig.mockResolvedValue({
      token: 'abc123',
      sync: { baseCommitSha: 'base-sha' },
    });
    git.getRemoteHeadSha.mockResolvedValue({ success: true, sha: 'base-sha' });
    storage.exportDataset.mockResolvedValue(JSON.stringify(local));
    git.pushDatasetToBranch.mockResolvedValue({
      success: true,
      commitSha: 'new-commit-sha',
    });

    const result = await githubAutoSync.run(ctx(), {
      reason: 'localChange',
      localChanged: true,
    });

    expect(git.computeGitHubSyncPlan).not.toHaveBeenCalled();
    expect(git.pushDatasetToBranch).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHeadSha: 'base-sha' })
    );
    expect(result).toEqual({
      outcome: 'synced',
      stats: { pulled: 0, pushed: 1 },
      localDataChanged: false,
    });
  });

  it('merges cleanly when the remote moved, then pushes when local still differs after the merge', async () => {
    const base = emptyDataset();
    const local = {
      ...emptyDataset(),
      characters: [makeCharacter({ id: 'local-1', name: 'Local Only' })],
    };
    const merged = {
      ...emptyDataset(),
      characters: [
        makeCharacter({ id: 'remote-1', name: 'Remote Only' }),
        ...local.characters,
      ],
    };
    git.isGitHubConfigured.mockResolvedValue(true);
    git.getSyncBaseSnapshot.mockResolvedValue(base);
    git.getGitHubConfig.mockResolvedValue({
      token: 'abc123',
      sync: { baseCommitSha: 'base-sha' },
    });
    git.getRemoteHeadSha.mockResolvedValue({
      success: true,
      sha: 'new-remote-sha',
    });
    // The second export simulates what `applyMergedDataset` can do beyond the
    // plan itself — e.g. backfilling a location a character references — so
    // local storage ends up with something the merge plan's `merged` field
    // alone didn't capture, and a push is still needed after the pull.
    const storageAfterMerge = {
      ...merged,
      locations: [makeLocation({ id: 'loc-1', name: 'Backfilled Camp' })],
    };
    storage.exportDataset
      .mockResolvedValueOnce(JSON.stringify(local)) // pre-merge check
      .mockResolvedValueOnce(JSON.stringify(storageAfterMerge)); // post-merge re-check
    git.computeGitHubSyncPlan.mockResolvedValue({
      success: true,
      remoteCommitSha: 'new-remote-sha',
      plan: {
        merged,
        conflicts: [],
        stats: {
          ...emptyStats(),
          characters: { added: 1, updated: 0, removed: 0, conflicted: 0 },
        },
      },
    });
    git.applyGitHubSyncPlan.mockResolvedValue({ success: true });
    git.pushDatasetToBranch.mockResolvedValue({
      success: true,
      commitSha: 'pushed-sha',
    });

    const result = await githubAutoSync.run(ctx(), {
      reason: 'interval',
      localChanged: false,
    });

    expect(git.applyGitHubSyncPlan).toHaveBeenCalledWith(
      expect.objectContaining({ merged }),
      {},
      'new-remote-sha'
    );
    expect(git.pushDatasetToBranch).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHeadSha: 'new-remote-sha' })
    );
    expect(result.outcome).toBe('synced');
    expect(result.stats).toEqual({ pulled: 1, pushed: 1 });
    expect(result.localDataChanged).toBe(true);
  });

  it('reports conflicts and writes nothing when the merge plan has any', async () => {
    const base = emptyDataset();
    git.isGitHubConfigured.mockResolvedValue(true);
    git.getSyncBaseSnapshot.mockResolvedValue(base);
    git.getGitHubConfig.mockResolvedValue({
      token: 'abc123',
      sync: { baseCommitSha: 'base-sha' },
    });
    git.getRemoteHeadSha.mockResolvedValue({
      success: true,
      sha: 'new-remote-sha',
    });
    storage.exportDataset.mockResolvedValue(JSON.stringify(base));
    git.computeGitHubSyncPlan.mockResolvedValue({
      success: true,
      remoteCommitSha: 'new-remote-sha',
      plan: {
        merged: base,
        conflicts: [
          {
            collection: 'characters',
            key: 'c1',
            label: 'Alice',
            fields: ['notes'],
            local: {},
            remote: {},
          },
        ],
        stats: {
          ...emptyStats(),
          characters: { added: 0, updated: 0, removed: 0, conflicted: 1 },
        },
      },
    });

    const result = await githubAutoSync.run(ctx(), {
      reason: 'interval',
      localChanged: false,
    });

    expect(git.applyGitHubSyncPlan).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: 'conflicts',
      conflicts: [{ key: 'characters:c1', label: 'Alice' }],
    });
  });

  it('surfaces a push race as a failure so the next tick can retry', async () => {
    const base = emptyDataset();
    const local = {
      ...emptyDataset(),
      characters: [makeCharacter({ id: 'c1', name: 'Alice' })],
    };
    git.isGitHubConfigured.mockResolvedValue(true);
    git.getSyncBaseSnapshot.mockResolvedValue(base);
    git.getGitHubConfig.mockResolvedValue({
      token: 'abc123',
      sync: { baseCommitSha: 'base-sha' },
    });
    git.getRemoteHeadSha.mockResolvedValue({ success: true, sha: 'base-sha' });
    storage.exportDataset.mockResolvedValue(JSON.stringify(local));
    git.pushDatasetToBranch.mockResolvedValue({
      success: false,
      remoteMoved: true,
      errorKind: 'conflict',
    });

    const result = await githubAutoSync.run(ctx(), {
      reason: 'localChange',
      localChanged: true,
    });

    expect(result.outcome).toBe('failed');
    expect(result.errorKind).toBe('conflict');
  });

  it('classifies an unexpected throw as a failure', async () => {
    git.isGitHubConfigured.mockRejectedValue(new Error('boom'));

    const result = await githubAutoSync.run(ctx(), {
      reason: 'interval',
      localChanged: false,
    });

    expect(result.outcome).toBe('failed');
  });
});
