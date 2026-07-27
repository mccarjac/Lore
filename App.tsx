import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components';
import { RulesetProvider } from './src/ruleset';
import { AppNavigator } from './src/navigation/AppNavigator';

// Dark theme for navigation
const DarkTheme = {
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

/**
 * Provider stack only. The navigators live in `AppNavigator` so they render
 * *inside* `RulesetProvider` and can read feature flags and terminology from
 * the active ruleset — App itself is outside the provider it renders, so it
 * never could.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <RulesetProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView style={appStyles.root}>
            <NavigationContainer theme={DarkTheme}>
              <AppNavigator />
            </NavigationContainer>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </RulesetProvider>
    </ErrorBoundary>
  );
}
