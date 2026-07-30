import {
  applyGitHubSyncPlan,
  computeGitHubSyncPlan,
  getGitHubConfig,
  getRemoteHeadSha,
  getSyncBaseSnapshot,
  isGitHubConfigured,
  pushDatasetToBranch,
} from '@utils/gitIntegration';
import { hasLocalChanges, type SyncDataset } from '@utils/syncMerge';
import { normalizeDatasetRulesetFields } from '@utils/rulesetFieldMigration';
import { classifySyncError } from '@utils/syncErrors';
import type {
  AutoSyncConflictSummary,
  AutoSyncResult,
  DataStoreAutoSync,
  DataStoreContext,
} from '../types';

const summarizeConflicts = (
  conflicts: ReadonlyArray<{ collection: string; key: string; label: string }>
): AutoSyncConflictSummary[] =>
  conflicts.map(c => ({ key: `${c.collection}:${c.key}`, label: c.label }));

const totalPulledRecords = (
  stats: Record<
    string,
    { added: number; updated: number; removed: number; conflicted: number }
  >
): number =>
  Object.values(stats).reduce(
    (sum, s) => sum + s.added + s.updated + s.removed,
    0
  );

/**
 * The GitHub store's auto-sync implementation (#31).
 *
 * Deliberately does **not** rely on the scheduler's `localChanged` hint for
 * its own push decision. This store already has to read its own merge-base
 * snapshot (`getSyncBaseSnapshot()`) just to answer "can I even run yet", and
 * comparing the current local dataset against that exact snapshot
 * (`hasLocalChanges`) is both cheap — a local file read and a JSON compare,
 * no network call — and authoritative, where the scheduler's dataset
 * fingerprint is a coarser, store-agnostic signal that can lag behind a sync
 * performed through the manual UI (which never touches the scheduler's own
 * bookkeeping). `localChanged` stays part of the contract for a store with
 * no cheaper option of its own.
 */
export const githubAutoSync: DataStoreAutoSync = {
  description:
    'Pull and push changes to the GitHub repository automatically, committing directly instead of opening a pull request for review.',
  defaultIntervalMs: 60_000,
  run: async (ctx: DataStoreContext): Promise<AutoSyncResult> => {
    try {
      if (!(await isGitHubConfigured())) {
        return { outcome: 'skipped', message: 'GitHub token not configured.' };
      }

      const config = await getGitHubConfig();
      const base = await getSyncBaseSnapshot();
      if (!base || !config.sync?.baseCommitSha) {
        // computeSyncPlan degrades to a two-way compare with no base — every
        // difference becomes a conflict. Auto-sync must not be the thing
        // that discovers that for the very first time.
        return {
          outcome: 'skipped',
          message:
            'Run "Sync from GitHub (Merge)" once to establish a merge base before automatic sync can run.',
        };
      }

      const headResult = await getRemoteHeadSha();
      if (!headResult.success || !headResult.sha) {
        return {
          outcome: 'failed',
          errorKind: headResult.errorKind ?? 'unknown',
          message: headResult.error,
        };
      }
      const remoteMoved = headResult.sha !== config.sync.baseCommitSha;

      const normalizedBase = normalizeDatasetRulesetFields(base);
      const localDataset = normalizeDatasetRulesetFields(
        JSON.parse(await ctx.exportDataset()) as SyncDataset
      );
      let localNeedsPush = hasLocalChanges(normalizedBase, localDataset);

      // The cheap common case: one API call (the head-sha check above), no
      // fetch, no images, no write.
      if (!remoteMoved && !localNeedsPush) {
        return { outcome: 'upToDate' };
      }

      let headSha = headResult.sha;
      let pulled = 0;
      let localDataChanged = false;

      if (remoteMoved) {
        const planResult = await computeGitHubSyncPlan();
        if (
          !planResult.success ||
          !planResult.plan ||
          !planResult.remoteCommitSha
        ) {
          return {
            outcome: 'failed',
            errorKind: planResult.errorKind ?? 'unknown',
            message: planResult.error,
          };
        }

        // Never resolve a genuine conflict — surface it and write nothing.
        if (planResult.plan.conflicts.length > 0) {
          return {
            outcome: 'conflicts',
            conflicts: summarizeConflicts(planResult.plan.conflicts),
          };
        }

        const applied = await applyGitHubSyncPlan(
          planResult.plan,
          {},
          planResult.remoteCommitSha
        );
        if (!applied.success) {
          return {
            outcome: 'failed',
            errorKind: 'unknown',
            message: applied.error,
          };
        }

        headSha = planResult.remoteCommitSha;
        pulled = totalPulledRecords(planResult.plan.stats);
        localDataChanged = pulled > 0;

        // `applyMergedDataset` (inside `applyGitHubSyncPlan`) can itself
        // change local data beyond the merge plan — backfilling a location a
        // character references, reconciling quest/event links — so re-check
        // against the dataset the merge just settled on, not the plan's
        // `merged` field, to decide whether anything still needs pushing.
        const remoteBase = normalizeDatasetRulesetFields(
          planResult.plan.merged
        );
        const localAfterMerge = normalizeDatasetRulesetFields(
          JSON.parse(await ctx.exportDataset()) as SyncDataset
        );
        localNeedsPush = hasLocalChanges(remoteBase, localAfterMerge);
      }

      if (!localNeedsPush) {
        return {
          outcome: 'synced',
          stats: { pulled, pushed: 0 },
          localDataChanged,
        };
      }

      const pushResult = await pushDatasetToBranch({
        expectedHeadSha: headSha,
        ruleset: ctx.ruleset,
      });

      if (!pushResult.success) {
        return {
          outcome: 'failed',
          errorKind: pushResult.errorKind ?? 'unknown',
          message: pushResult.error,
        };
      }

      return {
        outcome: 'synced',
        stats: { pulled, pushed: 1 },
        localDataChanged,
      };
    } catch (error) {
      const classified = classifySyncError(error);
      return {
        outcome: 'failed',
        errorKind: classified.kind,
        message: classified.message,
      };
    }
  },
};
