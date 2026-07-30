import { AppState, type AppStateStatus } from 'react-native';

export type { AppStateStatus };

/**
 * The auto-sync scheduler's only touch of React Native. Isolating it here
 * means `controller.ts` imports no React Native at all, and a test mocks this
 * two-function module instead of `AppState` itself — the repo has never
 * mocked `AppState`, and going through a thin seam here is far less fragile
 * than reaching into RN's own event-emitter internals from a test.
 */

export const getAppStateStatus = (): AppStateStatus => AppState.currentState;

export const subscribeAppState = (
  listener: (status: AppStateStatus) => void
): (() => void) => {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
};
