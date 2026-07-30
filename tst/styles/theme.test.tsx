import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { RulesetProvider } from '@/ruleset';
import {
  mergeColors,
  getActiveColors,
  useTheme,
  DEFAULT_COLORS,
} from '@/styles/theme';
import { genericRuleset } from '../fixtures/genericRuleset';
import { resetLoreConfig, configureLore } from '@/activeRuleset';

describe('mergeColors', () => {
  it('returns the defaults unchanged when there is no override', () => {
    expect(mergeColors(undefined)).toBe(DEFAULT_COLORS);
    expect(mergeColors({})).toEqual(DEFAULT_COLORS);
  });

  it('merges a top-level token without touching the rest', () => {
    const merged = mergeColors({ primary: '#123456' });
    expect(merged.primary).toBe('#123456');
    expect(merged.secondary).toBe(DEFAULT_COLORS.secondary);
  });

  it('merges a nested group without dropping its other keys', () => {
    const merged = mergeColors({ accent: { primary: '#ABCDEF' } });
    expect(merged.accent.primary).toBe('#ABCDEF');
    expect(merged.accent.secondary).toBe(DEFAULT_COLORS.accent.secondary);
    expect(merged.accent.success).toBe(DEFAULT_COLORS.accent.success);
  });
});

describe('getActiveColors', () => {
  afterEach(() => resetLoreConfig());

  it('reads the active ruleset’s branding.colors override', () => {
    configureLore({
      ruleset: {
        ...genericRuleset,
        branding: {
          ...genericRuleset.branding,
          colors: { primary: '#654321' },
        },
      },
    });
    expect(getActiveColors().primary).toBe('#654321');
  });

  it('falls back to the defaults when unconfigured', () => {
    expect(getActiveColors()).toEqual(DEFAULT_COLORS);
  });
});

describe('useTheme', () => {
  it('resolves colors from the ruleset in context', () => {
    const ruleset = {
      ...genericRuleset,
      branding: {
        ...genericRuleset.branding,
        colors: { surface: '#0F1A0F' },
      },
    };
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <RulesetProvider ruleset={ruleset}>{children}</RulesetProvider>
      ),
    });
    expect(result.current.colors.surface).toBe('#0F1A0F');
    expect(result.current.colors.primary).toBe(DEFAULT_COLORS.primary);
    expect(result.current.shadows.small.shadowColor).toBe(
      DEFAULT_COLORS.shadow
    );
  });

  it('defaults to the engine palette when the ruleset declares no colors', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <RulesetProvider ruleset={genericRuleset}>{children}</RulesetProvider>
      ),
    });
    expect(result.current.colors).toEqual(DEFAULT_COLORS);
  });
});
