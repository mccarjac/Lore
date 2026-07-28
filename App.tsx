import React from 'react';
import { LoreApp } from './src/LoreApp';

/**
 * Lore's own dev app.
 *
 * Deliberately a two-line consumer of `LoreApp` — the same entry point a
 * dependent app uses — so `npm run web` exercises exactly what ships rather
 * than a parallel copy of the provider stack.
 *
 * There is no `configureLore()` call: without one the registry serves
 * `src/ruleset/exampleRuleset.ts`, which is what running the engine bare is
 * supposed to show.
 */
export default function App() {
  return <LoreApp />;
}
