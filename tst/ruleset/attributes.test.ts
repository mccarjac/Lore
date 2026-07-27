/**
 * Unit tests for the AttributeValue primitive (#22).
 *
 * Covers the accessors' narrowing contract (a wrong-typed entry must fall back
 * rather than leak through) and the bag validator, which is the single check
 * that replaced ~90 lines of hand-written per-map archetype validation.
 */
import {
  flag,
  formatAttributeValue,
  getFlag,
  getNumber,
  getRef,
  getText,
  num,
  ref,
  roleOf,
  text,
  validateAttributeBag,
  validateAttributeDeltas,
  type AttributeDefinition,
} from '@/ruleset/attributes';

const DEFINITIONS: AttributeDefinition[] = [
  { id: 'health', label: 'Health', type: 'number', role: 'resource', min: 0 },
  { id: 'title', label: 'Title', type: 'text' },
  { id: 'sworn', label: 'Sworn', type: 'flag', role: 'capability' },
  {
    id: 'patron',
    label: 'Patron',
    type: 'ref',
    refCollection: 'archetypes',
  },
];

describe('accessors', () => {
  const bag = {
    health: num(3),
    title: text('Scavenger'),
    sworn: flag(true),
    patron: ref('human'),
  };

  it('reads each type', () => {
    expect(getNumber(bag, 'health')).toBe(3);
    expect(getText(bag, 'title')).toBe('Scavenger');
    expect(getFlag(bag, 'sworn')).toBe(true);
    expect(getRef(bag, 'patron')).toBe('human');
  });

  it('falls back when the entry is a different type', () => {
    // The whole point of narrowing in one place: a text value must never be
    // silently treated as a number by arithmetic downstream.
    expect(getNumber(bag, 'title', -1)).toBe(-1);
    expect(getText(bag, 'health', 'none')).toBe('none');
    expect(getFlag(bag, 'health', true)).toBe(true);
    expect(getRef(bag, 'title', 'none')).toBe('none');
  });

  it('falls back on a missing key or an absent bag', () => {
    expect(getNumber(bag, 'nope', 7)).toBe(7);
    expect(getNumber(undefined, 'health', 7)).toBe(7);
  });

  it('defaults role to freeform', () => {
    expect(roleOf({ id: 'x', label: 'X', type: 'text' })).toBe('freeform');
    expect(roleOf(DEFINITIONS[0])).toBe('resource');
  });
});

describe('formatAttributeValue', () => {
  it.each([
    [num(3), '3'],
    [text('Junktown'), 'Junktown'],
    [flag(true), 'Yes'],
    [flag(false), 'No'],
    [ref('human'), 'human'],
  ])('renders %o', (value, expected) => {
    expect(formatAttributeValue(value)).toBe(expected);
  });

  it('renders nested list and map values', () => {
    expect(
      formatAttributeValue({ type: 'list', value: [num(1), text('two')] })
    ).toBe('1, two');
    expect(
      formatAttributeValue({ type: 'map', value: { a: num(1), b: flag(true) } })
    ).toBe('a: 1, b: Yes');
  });
});

describe('validateAttributeBag', () => {
  it('accepts a well-formed bag', () => {
    expect(
      validateAttributeBag(
        { health: num(3), title: text('Scav') },
        DEFINITIONS,
        'x'
      )
    ).toEqual([]);
  });

  it('rejects an undeclared id', () => {
    const issues = validateAttributeBag({ nope: num(1) }, DEFINITIONS, 'x');
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('x.nope');
  });

  it('rejects a type mismatch', () => {
    const issues = validateAttributeBag(
      { health: text('lots') },
      DEFINITIONS,
      'x'
    );
    expect(issues[0].message).toContain(
      "declared as 'number' but holds 'text'"
    );
  });

  it('rejects a value that is not an AttributeValue at all', () => {
    const issues = validateAttributeBag(
      { health: 3 } as never,
      DEFINITIONS,
      'x'
    );
    expect(issues[0].message).toContain('not a valid AttributeValue');
  });

  it('reports required ids that are absent', () => {
    const issues = validateAttributeBag({}, DEFINITIONS, 'x', {
      required: ['health'],
    });
    expect(issues[0].message).toContain("Missing required attribute 'health'");
  });

  it('enforces min and max', () => {
    expect(
      validateAttributeBag({ health: num(-1) }, DEFINITIONS, 'x')[0].message
    ).toContain('below its minimum of 0');
  });

  it('resolves refs through the injected resolver', () => {
    const resolveRef = (_collection: string, id: string) => id === 'human';

    expect(
      validateAttributeBag({ patron: ref('human') }, DEFINITIONS, 'x', {
        resolveRef,
      })
    ).toEqual([]);

    const issues = validateAttributeBag(
      { patron: ref('elf') },
      DEFINITIONS,
      'x',
      { resolveRef }
    );
    expect(issues[0].message).toContain(
      "references unknown archetypes id 'elf'"
    );
  });

  it('skips ref resolution when no resolver is supplied', () => {
    expect(
      validateAttributeBag({ patron: ref('anything') }, DEFINITIONS, 'x')
    ).toEqual([]);
  });
});

describe('validateAttributeDeltas', () => {
  it('accepts deltas on numeric attributes', () => {
    expect(validateAttributeDeltas({ health: 2 }, DEFINITIONS, 'x')).toEqual(
      []
    );
  });

  it('rejects an unknown id', () => {
    expect(
      validateAttributeDeltas({ nope: 1 }, DEFINITIONS, 'x')[0].message
    ).toContain("Unknown attribute id 'nope'");
  });

  it('rejects a delta on a non-numeric attribute', () => {
    expect(
      validateAttributeDeltas({ title: 1 }, DEFINITIONS, 'x')[0].message
    ).toContain("only 'number' attributes accept deltas");
  });

  it('does not police roles', () => {
    // Which roles a modifier applies is an application rule in derived.ts,
    // not a validity rule — the real Afterworlds ruleset declares a trait cap
    // delta the engine ignores, and flagging it here would make the shipped
    // ruleset invalid.
    const withCap: AttributeDefinition[] = [
      ...DEFINITIONS,
      { id: 'healthCap', label: 'Health Cap', type: 'number', role: 'cap' },
    ];
    expect(validateAttributeDeltas({ healthCap: 1 }, withCap, 'x')).toEqual([]);
  });
});

describe('validateAttributeBag — declaration edge cases', () => {
  it('treats a list or map value as valid when declared', () => {
    const definitions: AttributeDefinition[] = [
      { id: 'tags', label: 'Tags', type: 'list' },
      { id: 'meta', label: 'Meta', type: 'map' },
    ];

    expect(
      validateAttributeBag(
        {
          tags: { type: 'list', value: [text('a')] },
          meta: { type: 'map', value: { k: num(1) } },
        },
        definitions,
        'x'
      )
    ).toEqual([]);
  });

  it('rejects a value whose tag is not a known attribute type', () => {
    const issues = validateAttributeBag(
      { health: { type: 'binary', value: 1 } } as never,
      DEFINITIONS,
      'x'
    );
    expect(issues[0].message).toContain('not a valid AttributeValue');
  });
});
