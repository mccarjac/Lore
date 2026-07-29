# GitHub-backed data sync

Campaign data can be shared through a GitHub repository: the app pushes a
`data.json` (plus images) as a pull request, and pulls the merged result back
down. Git provides the version history, and the PR is where a human decides
what actually lands.

The feature is **opt-in**: register `githubDataStore` through
`configureLore({ dataStores })` to offer it. It replaced the ruleset's
`gitSync` flag — see [consuming-lore.md](./consuming-lore.md#data-stores).

## Which repository

`src/utils/gitIntegration.ts` reads three environment variables, defaulting to
the data library this code shipped against:

| Variable                       | Default                       |
| ------------------------------ | ----------------------------- |
| `EXPO_PUBLIC_DATA_REPO_OWNER`  | `mccarjac`                    |
| `EXPO_PUBLIC_DATA_REPO_NAME`   | `AWInvestigationsDataLibrary` |
| `EXPO_PUBLIC_DATA_REPO_BRANCH` | `main`                        |

Set them in `.env` (see `.env.example`) to sync somewhere else. A fork should
set all three explicitly rather than inherit the defaults.

## Setting up a token

1. GitHub → [Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
   → **Generate new token (classic)**.
2. Scope: **`repo`**. Nothing else is needed, and nothing less will work for a
   private data repository.
3. Copy the token — GitHub shows it once.
4. In the app: **Data Management** → **GitHub Repository Sync** → **Set Up
   GitHub Token** → paste → save. The token is verified, then stored in the
   app's document directory (`@github_config`).

Revoke the token from that same GitHub page if the device is lost.

## Exporting (push)

**Export to GitHub (Create PR)** does the following:

1. Verifies the repository is reachable with your token.
2. Warns if the repository has moved since your last successful sync — pull
   first, or export anyway against the current state.
3. Creates a timestamped branch.
4. Writes `data.json` (characters, factions, locations, events, quests and
   Discord data) and uploads images under `images/<entity type>/`.
5. Opens a pull request and hands back its URL.

Nothing is merged automatically. `main` only moves when a human merges the PR.

## Importing (pull)

**Import from GitHub** fetches the branch's `data.json`, downloads images that
are new or changed (matching sizes are skipped, so repeat imports are fast),
and reconciles against local data.

This is a **three-way merge**, not an overwrite. The app stores the dataset as
it stood at the end of the last successful sync, plus the remote commit SHA
(`@github_sync_base.json`), so a later sync can distinguish "you changed this"
from "they changed this" instead of only comparing current states. Genuine
conflicts — both sides edited the same entity — are surfaced in a modal for
per-entity resolution rather than silently resolved.

The merge logic itself is I/O-free and lives in `src/utils/syncMerge.ts`
(`computeSyncPlan` / `applyResolutions`); network and offline failures are
classified by `src/utils/syncErrors.ts` rather than surfaced as raw fetch text.
Keep new merge or conflict logic in `syncMerge.ts`, not in `gitIntegration.ts`.

**Ruleset field migration runs on all three sides** — base, local and remote —
before the diff. Normalizing only the written side would report every character
as conflicting on the first sync after an upgrade.

## Repository layout

```
<owner>/<name>/
├── data.json
└── images/
    ├── characters/   characterId_0.jpg
    ├── factions/     Faction_Name_0.jpg
    ├── locations/    locationId_0.jpg
    └── events/       eventId_0.jpg
```

```json
{
  "characters": [],
  "factions": [],
  "locations": [],
  "events": [],
  "quests": [],
  "discord": {},
  "version": "1.0",
  "lastUpdated": "2026-07-27T22:00:00.000Z"
}
```

Faction images are keyed by name because `StoredFaction` has no id — factions
are name-keyed throughout.

## Deterministic ordering

Every export runs through `sortDatasetDeterministically()`
(`src/utils/datasetSorting.ts`) before it is written, so a PR diff shows what
actually changed instead of a re-ordering of the whole file:

- **Characters** — by name (case-insensitive), tie-broken by id.
- **Factions** — by name (case-insensitive).
- **Locations** — by name, tie-broken by id.
- **Events** — by date descending (timelines read newest-first), tie-broken by
  id.
- **Nested arrays** — factions, relationships, trait/quality ids,
  modifications, `imageUris`, `characterIds`, `factionNames` — are sorted too,
  so adding one member does not reshuffle a list.

It is applied in `exportDataset()` (`characterStorage.ts`), `exportToGitHub()`
(`gitIntegration.ts`) and the JSON data store's export
(`src/datastores/json/index.ts`) — all three, so file exports and PRs agree. Sorting is O(n log n) per entity type
and runs only on export. Adding an entity type or a nested array means adding
it here and to `tst/utils/datasetSorting.test.ts`.

**Known gap:** `quests` and `discord` are in the exported dataset but are not
sorted, so those two sections can still produce reordering noise in a diff.

The first export after ordering changed will still show one large diff, as the
file is re-sorted once.

## Troubleshooting

**"Repository not found"** — the repo does not exist under the configured
owner/name, or the token cannot see it. A private repo needs `repo` scope.

**"Invalid token"** — expired, mistyped, whitespace, or missing `repo` scope.

**Export fails** — check connectivity and write access; GitHub rate-limits, so
retry after a minute.

**Import fails** — the branch must contain a valid `data.json`, and the token
needs read access.

**Everything looks conflicted after upgrading** — that is the symptom of
migration running on only one side. All three sides normalize; if you see it,
the bug is in `migrateRulesetFields` usage, not in your data.

**Diffs are still huge** — the first post-sort export re-orders the file once.
If it persists, something is regenerating ids or timestamps on every export.
