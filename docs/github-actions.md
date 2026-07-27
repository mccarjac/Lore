# GitHub Actions

Three workflows live in `.github/workflows/`:

| Workflow        | Trigger                      | What it does                                                            |
| --------------- | ---------------------------- | ----------------------------------------------------------------------- |
| `pr-checks.yml` | pull request → `main`        | type-check, lint, test — the gate                                       |
| `coverage.yml`  | pull request → `main`        | `npm run test:coverage`, posts a sticky comment scoped to changed files |
| `build-apk.yml` | manual (`workflow_dispatch`) | submits an Android APK build to EAS and cuts a GitHub Release           |

`coverage.yml` is informational: no threshold is enforced, so it never blocks a
merge. `build-apk.yml` is manual on purpose — EAS's free tier is a monthly build
quota, and a per-push trigger burns it on documentation commits.

## Setting up APK builds

### 1. Create an Expo access token

1. Log in at [expo.dev](https://expo.dev).
2. **Account Settings** → **Access Tokens**
   (`https://expo.dev/accounts/<your-account>/settings/access-tokens`).
3. **Create Token**, name it something like "GitHub Actions APK Builder", and
   copy it — it is shown once.

### 2. Add it to the repository

**Settings** → **Secrets and variables** → **Actions** → **New repository
secret**, named `EXPO_TOKEN`.

### 3. Set the identity variables (forks only)

App identity comes from the environment — see [`.env.example`](../.env.example)
and `src/branding.ts`. `build-apk.yml` falls back to Lore's own defaults, so an
unmodified clone needs nothing here. A fork adds **repository variables** (same
settings page, **Variables** tab) to override them:

| Variable                        | Used for                                        |
| ------------------------------- | ----------------------------------------------- |
| `EXPO_OWNER`                    | Expo account that owns the project; build links |
| `EXPO_PUBLIC_APP_NAME`          | display name                                    |
| `EXPO_PUBLIC_APP_SLUG`          | Expo slug; build links                          |
| `EXPO_PUBLIC_BUNDLE_IDENTIFIER` | iOS bundle identifier and Android package       |
| `EAS_PROJECT_ID`                | the id `eas init` printed                       |

These reach the workflow's own config evaluation and the build links it writes.
The build itself runs on EAS's servers with **its own** environment, so set the
same values there too — either in `eas.json` under a profile's `env`, or as
environment variables on the EAS project.

### 4. Initialize Android signing credentials (one time)

EAS cannot generate a keystore in `--non-interactive` mode, so the first build
has to be run by hand:

```bash
npm install -g eas-cli
eas login
eas init          # only if EAS_PROJECT_ID is still empty — paste the id into .env
eas build --platform android --profile preview
```

Answer **yes** when it offers to generate a new Android keystore. The
credentials are then stored on Expo's servers and every later CI build reuses
them.

### 5. Run it

**Actions** → **Build Android APK** → **Run workflow**. It type-checks, lints,
tests, then submits the build and waits (10–20 minutes). On success it creates a
GitHub Release named `APK Build #<run number>` carrying the download link.

## Getting the APK

- **Releases** — the workflow's release has a direct **Download APK** link.
- **Expo dashboard** — `https://expo.dev/accounts/<owner>/projects/<slug>/builds`.

## Build profiles

`eas.json` defines three; the workflow uses `preview`:

- `preview` — APK, internal distribution. Testing and direct install.
- `production` — APK, remote credentials.
- `development` — development client build.

Change the profile by editing the `eas build` line in
`.github/workflows/build-apk.yml`.

## Troubleshooting

**"Generating a new Keystore is not supported in --non-interactive mode"** —
step 4 has not been done. Run one build locally, then retry.

**"Missing EXPO_TOKEN"** — the secret is absent, expired, or was added to the
wrong repository.

**Build never starts** — check the Expo account's remaining build quota, and
that `EAS_PROJECT_ID` is set (an empty id means the project was never
`eas init`-ed).

**No release appears** — the release step only runs when the build status is
`FINISHED` and an artifacts URL came back; check the workflow log for the build
status it parsed.

**Config values look wrong in the build** — remember the two environments
(step 3). A value set only as a repository variable will not reach the remote
EAS build.

## Further reading

- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Building on CI](https://docs.expo.dev/build/building-on-ci/)
- [Programmatic access](https://docs.expo.dev/accounts/programmatic-access/)
