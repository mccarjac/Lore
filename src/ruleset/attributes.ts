/**
 * The extensible attribute primitive (issue #22).
 *
 * Before this, the ruleset schema carried seven parallel `Record<string, X>`
 * maps — baseValues, caps, capabilities, values, caps, categoryModifiers,
 * grants — split by *value type* rather than by meaning. That is an attribute
 * system supporting only numbers and booleans, with the type baked into the
 * field name, and it left no way to declare a text-valued property or a
 * GM-defined per-character field.
 *
 * `AttributeValue` is a tagged union in the spirit of DynamoDB's AttributeValue.
 * It deliberately does NOT copy DynamoDB's wire encoding: DDB stores numbers as
 * strings (`{"N": "5"}`) so 38 digits survive across language SDKs, which would
 * only buy Lore a `parseFloat` at every arithmetic site — including derived.ts,
 * the path every stat number flows through. Lore is one TypeScript app
 * persisting JSON of small integers, so numbers stay numbers.
 *
 * `ref` has no DynamoDB counterpart and earns its place: the ruleset schema is
 * full of id cross-references, and making them first-class lets the validator
 * check integrity generically instead of per-field.
 *
 * Everything here must stay JSON-serializable — `validate.ts` enforces it, and
 * the backlogged in-app ruleset editor (#18) depends on it.
 */

export type AttributeValue =
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'flag'; value: boolean }
  | { type: 'ref'; value: string }
  | { type: 'list'; value: AttributeValue[] }
  | { type: 'map'; value: Record<string, AttributeValue> };

export type AttributeType = AttributeValue['type'];

/** Ruleset collections a `ref` attribute can point into. */
export type RefCollection =
  | 'archetypes'
  | 'traits'
  | 'qualities'
  | 'traitCategories'
  | 'groups'
  | 'recipes';

/**
 * What an attribute *means*, as opposed to what it stores.
 *
 * Roles are the guard against over-generalizing this refactor into untyped
 * soup: the tagged union is storage, roles are semantics, and `derived.ts`
 * dispatches on role rather than on hardcoded ids.
 *
 * They also express a behavior that used to be an accident. Trait cap
 * modifiers have never been applied — Afterworlds' `smarts_20` declares
 * `limitCap: +1` and the engine ignores it — and the parity fixture pins that.
 * Rather than preserve it as an unexplained special case, the rule is now
 * stated in terms of roles:
 *
 * - traits may modify only `resource`
 * - modifications may modify `resource` and `cap`
 * - category bonuses grant to `resource`
 */
export type AttributeRole = 'resource' | 'cap' | 'capability' | 'freeform';

export interface AttributeDefinition {
  id: string;
  label: string;
  type: AttributeType;
  /** Defaults to 'freeform' — declared but inert in derived-stat computation. */
  role?: AttributeRole;
  /** For role 'resource': the id of the `cap` attribute holding its ceiling. */
  capAttributeId?: string;
  /** For type 'ref': which collection the id must resolve into. */
  refCollection?: RefCollection;
  /** For type 'number': inclusive bounds enforced by the validator. */
  min?: number;
  max?: number;
  /** Whether a character may carry its own value for this attribute. */
  perCharacter?: boolean;
}

export type AttributeBag = Record<string, AttributeValue>;

export const roleOf = (definition: AttributeDefinition): AttributeRole =>
  definition.role ?? 'freeform';

// --- Constructors -----------------------------------------------------------
// Hand-authored rulesets are TypeScript today, so terseness here matters.

export const num = (value: number): AttributeValue => ({
  type: 'number',
  value,
});
export const text = (value: string): AttributeValue => ({
  type: 'text',
  value,
});
export const flag = (value: boolean): AttributeValue => ({
  type: 'flag',
  value,
});
export const ref = (value: string): AttributeValue => ({ type: 'ref', value });

// --- Typed accessors --------------------------------------------------------
// These exist so narrowing happens in one place rather than at every read.

export const getNumber = (
  bag: AttributeBag | undefined,
  id: string,
  fallback = 0
): number => {
  const entry = bag?.[id];
  return entry?.type === 'number' ? entry.value : fallback;
};

export const getText = (
  bag: AttributeBag | undefined,
  id: string,
  fallback = ''
): string => {
  const entry = bag?.[id];
  return entry?.type === 'text' ? entry.value : fallback;
};

export const getFlag = (
  bag: AttributeBag | undefined,
  id: string,
  fallback = false
): boolean => {
  const entry = bag?.[id];
  return entry?.type === 'flag' ? entry.value : fallback;
};

export const getRef = (
  bag: AttributeBag | undefined,
  id: string,
  fallback = ''
): string => {
  const entry = bag?.[id];
  return entry?.type === 'ref' ? entry.value : fallback;
};

/** Human-readable rendering for display and search, independent of type. */
export const formatAttributeValue = (value: AttributeValue): string => {
  switch (value.type) {
    case 'number':
      return String(value.value);
    case 'text':
    case 'ref':
      return value.value;
    case 'flag':
      return value.value ? 'Yes' : 'No';
    case 'list':
      return value.value.map(formatAttributeValue).join(', ');
    case 'map':
      return Object.entries(value.value)
        .map(([key, entry]) => `${key}: ${formatAttributeValue(entry)}`)
        .join(', ');
  }
};

// --- Validation -------------------------------------------------------------

export interface AttributeIssue {
  path: string;
  message: string;
}

const VALID_TYPES: readonly AttributeType[] = [
  'number',
  'text',
  'flag',
  'ref',
  'list',
  'map',
];

const isAttributeValue = (value: unknown): value is AttributeValue =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  VALID_TYPES.includes((value as { type: AttributeType }).type);

/**
 * Checks a bag against its declared definitions. Reports rather than throws,
 * so a user-authored ruleset can surface problems in UI (#18).
 *
 * `resolveRef` is injected rather than imported so this module stays free of
 * any dependency on RulesetDefinition — it is the lowest layer.
 */
export const validateAttributeBag = (
  bag: AttributeBag | undefined,
  definitions: AttributeDefinition[],
  path: string,
  options: {
    /** Ids that must be present. Omit to require none. */
    required?: string[];
    resolveRef?: (collection: RefCollection, id: string) => boolean;
  } = {}
): AttributeIssue[] => {
  const issues: AttributeIssue[] = [];
  const byId = new Map(definitions.map(d => [d.id, d]));

  options.required?.forEach(id => {
    if (bag?.[id] === undefined) {
      issues.push({
        path: `${path}.${id}`,
        message: `Missing required attribute '${id}'`,
      });
    }
  });

  Object.entries(bag ?? {}).forEach(([id, value]) => {
    const entryPath = `${path}.${id}`;
    const definition = byId.get(id);

    if (!definition) {
      issues.push({
        path: entryPath,
        message: `Unknown attribute id '${id}' (not declared in ruleset.attributes)`,
      });
      return;
    }

    if (!isAttributeValue(value)) {
      issues.push({
        path: entryPath,
        message: `Value at '${entryPath}' is not a valid AttributeValue`,
      });
      return;
    }

    if (value.type !== definition.type) {
      issues.push({
        path: entryPath,
        message: `Attribute '${id}' is declared as '${definition.type}' but holds '${value.type}'`,
      });
      return;
    }

    if (value.type === 'number') {
      if (definition.min !== undefined && value.value < definition.min) {
        issues.push({
          path: entryPath,
          message: `Attribute '${id}' is ${value.value}, below its minimum of ${definition.min}`,
        });
      }
      if (definition.max !== undefined && value.value > definition.max) {
        issues.push({
          path: entryPath,
          message: `Attribute '${id}' is ${value.value}, above its maximum of ${definition.max}`,
        });
      }
    }

    if (
      value.type === 'ref' &&
      definition.refCollection &&
      options.resolveRef
    ) {
      if (!options.resolveRef(definition.refCollection, value.value)) {
        issues.push({
          path: entryPath,
          message: `Attribute '${id}' references unknown ${definition.refCollection} id '${value.value}'`,
        });
      }
    }
  });

  return issues;
};

/**
 * Checks a delta map (attribute id -> numeric change) against the definitions.
 *
 * Validates only that each id is declared and numeric. Which *roles* a given
 * modifier source actually applies is an application rule enforced in
 * `derived.ts`, deliberately not a validity rule here: the real Afterworlds
 * ruleset declares a trait cap delta (`smarts_20`) that the engine has never
 * applied, and treating that as invalid would make the shipped ruleset fail
 * validation — which `RulesetProvider` turns into a throw under `__DEV__`.
 * The data stays faithful; the engine states what it honors.
 */
export const validateAttributeDeltas = (
  deltas: Record<string, number> | undefined,
  definitions: AttributeDefinition[],
  path: string
): AttributeIssue[] => {
  const issues: AttributeIssue[] = [];
  const byId = new Map(definitions.map(d => [d.id, d]));

  Object.keys(deltas ?? {}).forEach(id => {
    const definition = byId.get(id);
    if (!definition) {
      issues.push({
        path: `${path}.${id}`,
        message: `Unknown attribute id '${id}'`,
      });
      return;
    }
    if (definition.type !== 'number') {
      issues.push({
        path: `${path}.${id}`,
        message: `Attribute '${id}' is '${definition.type}'; only 'number' attributes accept deltas`,
      });
    }
  });

  return issues;
};
