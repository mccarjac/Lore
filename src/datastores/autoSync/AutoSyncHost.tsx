import React, { useEffect } from 'react';
import { useRuleset } from '@/ruleset';
import { getActiveDataStores } from '../registry';
import { createDataStoreContext } from '../context';
import { autoSyncController } from './controller';

/**
 * Mounts the auto-sync scheduler for the lifetime of the app (#31).
 *
 * `LoreApp` renders `RulesetProvider` and therefore cannot call `useRuleset()`
 * itself (see `LoreApp.tsx`); this component sits just inside that provider so
 * it can build a `DataStoreContext` from the *active* ruleset and hand it to
 * the controller. It is a thin wrapper for exactly that reason — the
 * scheduling logic itself lives in `controller.ts`, which needs no React.
 */
export const AutoSyncHost: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { ruleset } = useRuleset();

  useEffect(() => {
    autoSyncController.start({
      stores: getActiveDataStores(),
      ctx: createDataStoreContext(ruleset),
    });
    return () => autoSyncController.stop();
  }, [ruleset]);

  return <>{children}</>;
};
