import {
  CHART_PALETTE,
  colorForIndex,
  colorsForKeys,
} from '@/styles/chartPalette';

describe('chartPalette', () => {
  it('never returns undefined, however far past the end you index', () => {
    // The point of the helper: a ruleset may declare more categories than the
    // palette has entries, and a chart cannot render `undefined`.
    for (let i = 0; i < CHART_PALETTE.length * 3; i += 1) {
      expect(colorForIndex(i)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('wraps rather than running off the end', () => {
    expect(colorForIndex(CHART_PALETTE.length)).toBe(CHART_PALETTE[0]);
    expect(colorForIndex(CHART_PALETTE.length + 2)).toBe(CHART_PALETTE[2]);
  });

  it('handles a negative index without returning undefined', () => {
    expect(colorForIndex(-1)).toBe(CHART_PALETTE[CHART_PALETTE.length - 1]);
  });

  it('assigns one color per key, in order', () => {
    expect(colorsForKeys(['a', 'b', 'c'])).toEqual({
      a: CHART_PALETTE[0],
      b: CHART_PALETTE[1],
      c: CHART_PALETTE[2],
    });
  });

  it('gives more keys than colors a color each', () => {
    const keys = Array.from(
      { length: CHART_PALETTE.length + 3 },
      (_, i) => `key-${i}`
    );
    const assigned = colorsForKeys(keys);

    expect(Object.keys(assigned)).toHaveLength(keys.length);
    Object.values(assigned).forEach(color => expect(color).toBeTruthy());
  });
});
