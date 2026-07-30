/**
 * The one and only change signal in `src/` (#31).
 *
 * Auto-sync needs to know that local data moved without polling for it, and
 * before this existed nothing in the app emitted anything — screens reloaded on
 * focus and that was the whole mechanism.
 *
 * **The signal is a trigger, not a fact.** It says "something might have
 * changed"; it does not say what, or by whom. That is deliberate, and it is
 * what makes the obvious feedback loop impossible: a sync that pulls remote
 * changes writes storage, which fires this signal, which wakes the scheduler —
 * and the scheduler then compares a dataset fingerprint against the baseline it
 * recorded after that very sync, finds nothing to push, and stops. Idempotence
 * replaces provenance, so no caller has to thread a "this write came from sync"
 * flag through `applyMergedDataset` and five storage mutators. Getting that flag
 * wrong on one path would mean device A pushes what it just pulled, device B
 * pulls and pushes it back, forever.
 *
 * **A listener must not block.** It fires from inside a storage mutator, while
 * that key's `runExclusive` lock is held. Schedule work and return; never await
 * storage here, and never call a mutator for the same key (that deadlocks).
 *
 * Deliberately dependency-free: `characterStorage` imports the notifier and the
 * auto-sync controller imports the subscriber, so any import here would close a
 * cycle back through the data-store registry.
 */

export type LocalDataChangeListener = () => void;

const listeners = new Set<LocalDataChangeListener>();

/** Subscribe to local dataset writes. Returns the unsubscribe function. */
export const onLocalDataChanged = (
  listener: LocalDataChangeListener
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Announce that local game data was written. Called by `characterStorage`'s
 * `writeDataset` helper, which every dataset write goes through.
 *
 * A throwing listener is contained: one bad subscriber must not fail the
 * storage write that fired the signal.
 */
export const notifyLocalDataChanged = (): void => {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A subscriber's problem is not the writer's problem.
    }
  }
};

/** Test-only: drop every subscriber, so one suite cannot leak into the next. */
export const resetLocalDataChangeListeners = (): void => {
  listeners.clear();
};
