import fs from 'fs';
import path from 'path';

/**
 * The peer set is the contract with a consuming app, and it has been wrong
 * three times — `react-native-get-random-values`, the worklets trio, and
 * `expo-linear-gradient` — each time because a package reached Lore's code by
 * some route a `from '...'` scan cannot see: a bare side-effect import, a
 * transitive dependency of another peer, a `require()` inside a try/catch.
 *
 * Every one of them was already installed in Lore's own `node_modules` as a
 * devDependency, which is exactly why Lore ran fine while the consumer crashed
 * on launch. So the invariant is not "what does src/ import" but:
 *
 *   anything Lore installs that can end up in a bundle must be declared a peer,
 *   at the same version range.
 *
 * A new runtime dependency therefore fails here until it is either declared a
 * peer or explicitly classified as build-time-only below. Adding a name to
 * TOOLING_ONLY is a deliberate claim that it never reaches a consumer's bundle.
 */

const TOOLING_ONLY = new Set([
  // Type definitions — erased before anything bundles.
  '@types/d3-force',
  '@types/jest',
  '@types/node',
  '@types/react',
  '@types/uuid',
  // Lint.
  '@eslint/js',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  'eslint',
  'eslint-config-prettier',
  'eslint-plugin-prettier',
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react-native',
  'prettier',
  // Test.
  '@testing-library/react-native',
  'jest',
  'jest-expo',
  'react-test-renderer',
  'ts-jest',
  // Build and transform. The consumer's own babel/metro pipeline transforms
  // Lore's shipped output; these configure Lore's, not theirs.
  'babel-plugin-dynamic-import-node',
  'babel-plugin-module-resolver',
  'babel-preset-expo',
  'tsc-alias',
  'typescript',
  // Repo hygiene.
  'husky',
  'lint-staged',
  // Lore's own dev loop only — a consumer chooses its own dev client.
  'expo-dev-client',
]);

const pkg = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
) as {
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

describe('package.json peer contract', () => {
  const runtimeDevDeps = Object.keys(pkg.devDependencies).filter(
    name => !TOOLING_ONLY.has(name)
  );

  it.each(runtimeDevDeps)('declares %s as a peer dependency', name => {
    expect(Object.keys(pkg.peerDependencies)).toContain(name);
  });

  it.each(runtimeDevDeps)('pins %s to the same range in both', name => {
    expect(pkg.peerDependencies[name]).toBe(pkg.devDependencies[name]);
  });

  it('installs every peer it declares', () => {
    // The reverse direction: a peer Lore does not install itself is a peer no
    // test and no `npm run web` ever exercises.
    const optional = new Set(
      Object.entries(pkg.peerDependenciesMeta ?? {})
        .filter(([, meta]) => meta.optional)
        .map(([name]) => name)
    );
    const undeclared = Object.keys(pkg.peerDependencies).filter(
      name => !optional.has(name) && !(name in pkg.devDependencies)
    );
    expect(undeclared).toEqual([]);
  });

  it('lists no tooling entry that is not actually a devDependency', () => {
    // Keeps the allowlist from outliving the package it excuses, which would
    // silently re-open the hole when a name is reused.
    const stale = [...TOOLING_ONLY].filter(
      name => !(name in pkg.devDependencies)
    );
    expect(stale).toEqual([]);
  });

  describe('SDK-managed native modules', () => {
    // A package whose JS half must match a native half compiled into the app
    // binary cannot be versioned by taste. Expo publishes the versions its
    // prebuilt native side was compiled against, and that file is the only
    // authority — asserting against it is what `npx expo install --check` does,
    // and it catches drift that no import scan can see.
    const bundled = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'node_modules/expo/bundledNativeModules.json'),
        'utf8'
      )
    ) as Record<string, string>;

    // The one deliberate deviation. SDK 54 declares `~4.1.1`, which admits
    // 4.1.7 — and 4.1.7 *depends on* `react-native-worklets@0.8.x` while the
    // SDK's native worklets is 0.5.1. That pairing is the `installTurboModule`
    // crash. 4.1.3 declares no worklets dependency, so it leaves the SDK's
    // 0.5.1 in place.
    const DELIBERATE: Record<string, string> = {
      'react-native-reanimated': '4.1.3',
    };

    const managed = Object.keys(pkg.peerDependencies).filter(
      name => name in bundled
    );

    it('covers a non-trivial number of peers', () => {
      // Guards the guard: a rename or a missing manifest would empty `managed`
      // and turn every case below into a silent pass.
      expect(managed.length).toBeGreaterThan(10);
    });

    it.each(managed)('declares %s at the version SDK 54 ships', name => {
      expect(pkg.peerDependencies[name]).toBe(
        DELIBERATE[name] ?? bundled[name]
      );
    });

    it('deviates from the SDK only where documented', () => {
      const undocumented = Object.keys(DELIBERATE).filter(
        name => !(name in bundled)
      );
      expect(undocumented).toEqual([]);
    });
  });
});
