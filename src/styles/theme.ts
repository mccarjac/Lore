/**
 * Centralized theme configuration
 * Contains colors, typography, spacing, and other design tokens
 *
 * **Colors are ruleset-configurable (branding.colors); everything else in
 * this file is not.** A ruleset's `branding.colors` (`ColorPaletteOverrides`,
 * declared in `@/ruleset/types` so the engine schema has no dependency on
 * this module) is deep-merged over `DEFAULT_COLORS` below. Two ways to read
 * the result:
 *
 * - **`useTheme()`** (components) — reactive to the active ruleset, returns
 *   `{ colors, shadows, componentStyles, typography, spacing, borderRadius,
 *   layout }`. Prefer this for anything that should pick up a ruleset's
 *   brand colors.
 * - **`getActiveColors()`** (non-component code, mirroring `getLabel`) —
 *   same resolution, no hook.
 *
 * `colors`, `shadows`, `componentStyles`, and `theme` below remain as
 * **static exports of the engine's default palette**, for backward
 * compatibility with code that hasn't migrated to `useTheme()` yet — they
 * do not reflect a ruleset's `branding.colors` override. A ruleset that
 * declares no color overrides is unaffected either way, which is why this
 * is a non-breaking addition rather than a migration every consumer must
 * make at once.
 *
 * **Why colors need a hook but can't just be a mutated constant:** a
 * consumer's `configureLore()` call runs *after* `lore`'s whole module
 * graph — including every screen's module-scope `StyleSheet.create()`
 * call — has already been evaluated (ES module imports resolve
 * depth-first, before the importing file's own statements run). A color
 * baked into a `StyleSheet.create()` result at module load is frozen
 * before `configureLore()` ever runs; only a value resolved at *render*
 * time (a hook reading from `RulesetProvider`'s context, the same
 * mechanism `useLabels()`/`useFeature()` already use) can reflect it.
 */
import { useMemo } from 'react';
import { useRuleset } from '@/ruleset';
import { getActiveRuleset } from '@/activeRuleset';
import type { ColorPalette, ColorPaletteOverrides } from '@/ruleset/types';

export type { ColorPalette };

// The engine's default dark palette — what every ruleset gets unless it
// declares `branding.colors` overrides.
export const DEFAULT_COLORS: ColorPalette = {
  // Background colors
  primary: '#0F0F23', // Deep dark blue-purple (main background)
  secondary: '#1B1B3A', // Slightly lighter dark
  surface: '#262647', // Card/surface color
  elevated: '#2D2D54', // Elevated surfaces

  // Text colors
  text: {
    primary: '#FFFFFF', // Primary white text
    secondary: '#B8B8CC', // Secondary lighter text
    muted: '#8E8EA0', // Muted text
    accent: '#8A8A8A', // Accent text color
  },

  // Accent colors
  accent: {
    primary: '#6366F1', // Indigo primary
    secondary: '#8B5CF6', // Purple secondary
    success: '#10B981', // Green
    warning: '#F59E0B', // Amber
    danger: '#EF4444', // Red
    info: '#3B82F6', // Blue
  },

  // Status colors
  status: {
    success: '#00B894',
    warning: '#FDCB6E',
    error: '#E17055',
    info: '#74B9FF',
    present: '#059669', // Green for present
    absent: '#6B7280', // Gray for absent
  },

  // Standing/relationship colors
  standing: {
    allied: '#10B981', // Green
    friendly: '#3B82F6', // Blue
    neutral: '#6B7280', // Gray
    hostile: '#F59E0B', // Amber
    enemy: '#EF4444', // Red
  },

  // Certainty level colors
  certainty: {
    confirmed: '#2ECC71', // Green
    unconfirmed: '#F39C12', // Orange
    disputed: '#E74C3C', // Red
  },

  // Interactive colors
  interactive: {
    hover: 'rgba(108, 92, 231, 0.15)', // Light overlay for hover states
    pressed: 'rgba(108, 92, 231, 0.25)', // Slightly darker for pressed states
    disabled: '#404066', // Disabled state color
  },

  // Border and shadow
  border: '#3F3F65',
  borderLight: '#404066',
  shadow: '#000000',
};

/** Backward-compatible alias — see the module doc for what this does and doesn't reflect. */
export const colors = DEFAULT_COLORS;

/**
 * Deep-merges a ruleset's color overrides over the default palette. Every
 * nested group merges independently, so overriding `accent.primary` alone
 * doesn't drop the rest of `accent`.
 */
export function mergeColors(overrides?: ColorPaletteOverrides): ColorPalette {
  if (!overrides) return DEFAULT_COLORS;
  return {
    ...DEFAULT_COLORS,
    ...overrides,
    text: { ...DEFAULT_COLORS.text, ...overrides.text },
    accent: { ...DEFAULT_COLORS.accent, ...overrides.accent },
    status: { ...DEFAULT_COLORS.status, ...overrides.status },
    standing: { ...DEFAULT_COLORS.standing, ...overrides.standing },
    certainty: { ...DEFAULT_COLORS.certainty, ...overrides.certainty },
    interactive: { ...DEFAULT_COLORS.interactive, ...overrides.interactive },
  };
}

/** Non-hook form, for use outside components — mirrors `getLabel`. */
export function getActiveColors(): ColorPalette {
  return mergeColors(getActiveRuleset().branding.colors);
}

// Typography scales
export const typography = {
  // Font sizes
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
  },

  // Font weights
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights
  lineHeight: {
    tight: 16,
    base: 20,
    relaxed: 22,
    loose: 24,
  },

  // Letter spacing
  letterSpacing: {
    tight: 0.2,
    normal: 0.3,
    wide: 0.5,
    wider: 1.2,
  },
};

// Spacing system (using a 4px base unit)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 50,
};

// Border radius values
export const borderRadius = {
  sm: 6,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999, // For circular elements
};

// Shadow configurations — a function of colors, since shadowColor follows
// the palette (`buildShadows(DEFAULT_COLORS)` below is what `shadows`, the
// backward-compatible static export, freezes in).
export const buildShadows = (c: ColorPalette) => ({
  small: {
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});

export const shadows = buildShadows(DEFAULT_COLORS);

// Component-specific styling presets — likewise a function of colors.
export const buildComponentStyles = (c: ColorPalette) => ({
  // Button variants
  button: {
    primary: {
      backgroundColor: c.accent.primary,
      borderColor: c.accent.primary,
    },
    secondary: {
      backgroundColor: c.accent.secondary,
      borderColor: c.accent.secondary,
    },
    success: {
      backgroundColor: c.accent.success,
      borderColor: c.accent.success,
    },
    warning: {
      backgroundColor: c.accent.warning,
      borderColor: c.accent.warning,
    },
    danger: {
      backgroundColor: c.accent.danger,
      borderColor: c.accent.danger,
    },
    info: {
      backgroundColor: c.accent.info,
      borderColor: c.accent.info,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: c.border,
    },
  },

  // Input field styles
  input: {
    base: {
      backgroundColor: c.elevated,
      borderColor: c.border,
      color: c.text.primary,
    },
    focused: {
      borderColor: c.accent.primary,
    },
    error: {
      borderColor: c.accent.danger,
    },
  },

  // Card styles
  card: {
    base: {
      backgroundColor: c.surface,
      borderColor: c.border,
    },
    elevated: {
      backgroundColor: c.elevated,
      borderColor: c.border,
    },
    present: {
      borderLeftWidth: 4 as const,
      borderLeftColor: c.status.present,
      borderColor: c.status.present,
    },
  },
});

export const componentStyles = buildComponentStyles(DEFAULT_COLORS);

// Layout constants
export const layout = {
  // Extra scrollable space at bottom of screens (prevents content from being cut off)
  extraScrollSpace: 100,
  // Minimum safe area padding when device doesn't report insets
  minSafeAreaPadding: 16,
};

// Export a default theme object — the engine's default palette, same
// caveat as `colors`/`shadows`/`componentStyles` above.
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  componentStyles,
  layout,
};

export type Theme = typeof theme;

export interface ThemeValue {
  colors: ColorPalette;
  shadows: ReturnType<typeof buildShadows>;
  componentStyles: ReturnType<typeof buildComponentStyles>;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  layout: typeof layout;
}

/**
 * The ruleset-aware theme. Reactive to the active ruleset (via
 * `RulesetProvider`'s context, same as `useLabels()`/`useFeature()`) —
 * prefer this over the static `colors`/`shadows`/`componentStyles` exports
 * in any component, and recompute derived styles
 * (`StyleSheet.create()`/`useMemo`) from its `colors`/`shadows`/
 * `componentStyles` rather than the module-scope statics, or a ruleset's
 * `branding.colors` override won't reach that component.
 */
export function useTheme(): ThemeValue {
  const { ruleset } = useRuleset();
  return useMemo(() => {
    const resolvedColors = mergeColors(ruleset.branding.colors);
    return {
      colors: resolvedColors,
      shadows: buildShadows(resolvedColors),
      componentStyles: buildComponentStyles(resolvedColors),
      typography,
      spacing,
      borderRadius,
      layout,
    };
  }, [ruleset]);
}
