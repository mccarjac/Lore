/**
 * Categorical palette for charts and legends.
 *
 * Chart series are keyed by ruleset ids — archetypes, trait categories — whose
 * count and names a flavor chooses freely, so colors cannot be a fixed map
 * keyed by an enum the way FactionStatsScreen's used to be. A ruleset may
 * declare a color of its own (`TraitCategory.color`); this is the fallback for
 * everything that does not, and it cycles rather than running out.
 *
 * These fifteen are the values CharacterStatsScreen carried inline, twice.
 */
export const CHART_PALETTE = [
  '#E74C3C', // Red
  '#3498DB', // Blue
  '#F39C12', // Orange
  '#2ECC71', // Green
  '#9B59B6', // Purple
  '#1ABC9C', // Teal
  '#E67E22', // Dark Orange
  '#34495E', // Dark Blue-Gray
  '#F1C40F', // Yellow
  '#95A5A6', // Gray
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FF9800', // Amber
  '#4CAF50', // Light Green
  '#673AB7', // Deep Purple
] as const;

/** Never returns undefined — an out-of-range index wraps. */
export const colorForIndex = (index: number): string =>
  CHART_PALETTE[
    ((index % CHART_PALETTE.length) + CHART_PALETTE.length) %
      CHART_PALETTE.length
  ];

/**
 * Assigns a stable color per key in iteration order, for a chart and its
 * legend to agree without computing the palette twice.
 */
export const colorsForKeys = (keys: string[]): Record<string, string> => {
  const map: Record<string, string> = {};
  keys.forEach((key, index) => {
    map[key] = colorForIndex(index);
  });
  return map;
};
