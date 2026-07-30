import { useSyncExternalStore } from 'react';
import { autoSyncController, type AutoSyncStatus } from './controller';

/**
 * Live auto-sync status for one store, for the Data Management screen's
 * toggle row. `autoSyncController` is a module-level singleton external to
 * React, which is exactly what `useSyncExternalStore` exists for — it
 * subscribes to `autoSyncController.subscribe` and re-renders on any change,
 * without the render-loop risk of `setState` inside a `useEffect` body.
 *
 * Works whether or not `AutoSyncHost` happens to be mounted: a bare-rendered
 * screen test simply gets `undefined` (the store was never armed), same as
 * `useRuleset()`'s no-provider fallback.
 */
export const useAutoSyncStatus = (
  storeId: string
): AutoSyncStatus | undefined =>
  useSyncExternalStore(autoSyncController.subscribe, () =>
    autoSyncController.getStatus(storeId)
  );
