# Building for Android

Builds run on EAS (Expo's cloud build service). For the CI route — the "Build
Android APK" workflow — see [github-actions.md](./github-actions.md); this page
covers building by hand.

## Prerequisites

- Node and npm (already needed for development)
- A free [Expo account](https://expo.dev)
- `npm install -g eas-cli`

## Build

```bash
npm install
eas login
eas init      # only once per repo — paste the printed id into .env as EAS_PROJECT_ID
eas build --platform android --profile preview
```

The first build asks to generate an Android keystore; answer yes. Expo stores
the credentials, and every later build — including CI — reuses them.

Builds take 10–20 minutes (the first can take 30) and EAS prints a URL to watch
progress.

## App identity

Identity is **not** hardcoded. `src/branding.ts` reads the environment and falls
back to Lore's defaults; `app.config.ts` reads `src/branding.ts` and holds no
literals of its own. To build under a different name, slug or package, set the
values in `.env` (see `.env.example`):

```bash
EXPO_PUBLIC_APP_NAME=My Flavor
EXPO_PUBLIC_APP_SLUG=my-flavor
EXPO_PUBLIC_BUNDLE_IDENTIFIER=com.example.myflavor
EAS_PROJECT_ID=…
EXPO_OWNER=…
```

Check what Expo actually resolved before building:

```bash
npx expo config --type public
```

`EXPO_PUBLIC_BUNDLE_IDENTIFIER` is both the Android package and the iOS bundle
identifier. Changing it on a published app orphans every installed copy —
installs do not upgrade across a package rename.

## Profiles

| Profile       | Output | Use                                      |
| ------------- | ------ | ---------------------------------------- |
| `preview`     | APK    | Testing on devices, sharing with testers |
| `production`  | APK    | Distribution outside the Play Store      |
| `development` | APK    | Development client, with debugging tools |

Defined in `eas.json`.

## Installing the APK

Download the artifact EAS links, transfer it to the device, and allow
installation from unknown sources (Settings → Security, or the per-app prompt
on newer Android). Android 5.0 or later.

## Local builds

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

Output lands in `android/app/build/outputs/apk/release/`. Note `/android` and
`/ios` are git-ignored generated directories — treat them as build output, not
source.

## Troubleshooting

**Build fails** — read the log on the Expo site first. Most failures are a
dependency mismatch or an invalid resolved config; check
`npx expo config --type public`.

**"Generating a new Keystore is not supported in --non-interactive mode"** —
run one interactive build locally so the credentials exist, then retry CI.

**Wrong app name or package in the build** — the environment did not reach the
build. Remote EAS builds read _their own_ environment, not your shell: put the
values in `eas.json`'s `env` for the profile, or set them on the EAS project.

## Resources

- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Creating your first build](https://docs.expo.dev/build/setup/)
- [Android build reference](https://docs.expo.dev/build-reference/android-builds/)
