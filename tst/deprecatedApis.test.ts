import fs from 'fs';
import path from 'path';

/**
 * Deprecation warnings from a peer's SDK only show up at runtime, in a console
 * a consumer is looking at — never in a green test suite. `MediaTypeOptions`
 * was live in four form screens and nothing here noticed, because no test
 * exercises the image-pick path.
 *
 * The realistic way it comes back is copy-paste: a fifth form screen cloned
 * from one of the four. A source scan catches exactly that, and costs nothing.
 * Add an entry when a peer deprecates something and you have replaced its uses.
 */

const DEPRECATED: { pattern: RegExp; use: string }[] = [
  {
    pattern: /ImagePicker\.MediaTypeOptions/,
    use: "an array of MediaType string literals, e.g. mediaTypes: ['images']",
  },
];

const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

describe('deprecated peer APIs', () => {
  const files = sourceFiles(path.join(process.cwd(), 'src'));

  it('scans a plausible number of files', () => {
    // Without this, a bad root path would make every case below pass silently.
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(DEPRECATED)('does not use $pattern', ({ pattern, use }) => {
    const offenders = files
      .filter(file => pattern.test(fs.readFileSync(file, 'utf8')))
      .map(file => path.relative(process.cwd(), file));

    expect({ offenders, use }).toEqual({ offenders: [], use });
  });
});
