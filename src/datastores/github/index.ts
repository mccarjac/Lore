/**
 * The GitHub data store — **opt-in** (#29).
 *
 * Register it to offer repository-backed sync:
 *
 * ```ts
 * configureLore({ ruleset, dataStores: [jsonDataStore, githubDataStore] });
 * ```
 *
 * Registration replaces the old `features.gitSync` ruleset flag. A flag could
 * only say yes or no to the one backend the engine happened to hardcode; the
 * registry says which backends exist at all, so there is now one answer to
 * "where can this build write its data" instead of two mechanisms.
 *
 * Which repository it talks to is still environment-driven —
 * `EXPO_PUBLIC_DATA_REPO_*`, see `utils/gitIntegration.ts`.
 */

import { GitHubSection } from './GitHubSection';
import type { DataStore } from '../types';

export const githubDataStore: DataStore = {
  id: 'github',
  label: 'GitHub Repository Sync',
  // The section renders its own heading and description, since both depend on
  // configured state. These stay for a consumer listing the registry.
  description:
    'Share data with other users through a GitHub repository. Exports create pull requests for review.',
  Section: GitHubSection,
};

export { GitHubSection };
