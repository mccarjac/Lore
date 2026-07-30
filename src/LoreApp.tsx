import React from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  type Theme,
} from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components';
import { RulesetProvider } from '@/ruleset';
import { AppNavigator } from '@/navigation/AppNavigator';
import { AutoSyncHost } from '@/datastores/autoSync/AutoSyncHost';
import type { RulesetDefinition } from '@/ruleset/types';
import type { RulesetAssets } from '@/ruleset/assets';

/** Dark navigation theme matching `styles/theme.ts`. */
export const loreNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6C5CE7',
    background: '#0F0F23',
    card: '#262647',
    text: '#FFFFFF',
    border: '#404066',
    notification: '#6C5CE7',
  },
};

const appStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export interface LoreAppProps {
  /**
   * The ruleset to run on. Omit it and the app uses whatever
   * `configureLore()` registered — which is the normal path, since storage
   * migrations need the registry regardless of what this component is passed.
   * Supply it only to render a different ruleset than the configured one
   * (a preview screen, a test).
   */
  ruleset?: RulesetDefinition;
  assets?: RulesetAssets;
  /** Override the navigation theme. */
  theme?: Theme;
}

/**
 * The whole app: provider stack, navigation container, and the navigator.
 *
 * This is the engine's entry point for a consumer — an app depending on
 * `lore` calls `configureLore()` and renders this.
 *
 * The navigators deliberately live in `AppNavigator` rather than here, because
 * this component *renders* `RulesetProvider` and therefore sits outside it —
 * nothing in this file can call `useRuleset()`, so feature-flag and
 * terminology reads have to happen a level down. `AutoSyncHost` (#31) is the
 * same story: it needs `useRuleset()` to build the auto-sync scheduler's
 * `DataStoreContext`, so it sits just inside `RulesetProvider` rather than
 * being started from here.
 */
export const LoreApp: React.FC<LoreAppProps> = ({
  ruleset,
  assets,
  theme = loreNavigationTheme,
}) => (
  <ErrorBoundary>
    <RulesetProvider ruleset={ruleset} assets={assets}>
      <AutoSyncHost>
        <SafeAreaProvider>
          <GestureHandlerRootView style={appStyles.root}>
            <NavigationContainer theme={theme}>
              <AppNavigator />
            </NavigationContainer>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </AutoSyncHost>
    </RulesetProvider>
  </ErrorBoundary>
);
