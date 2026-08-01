import {
  roleOf,
  validateAttributeBag,
  validateAttributeDeltas,
  type AttributeBag,
  type AttributeDefinition,
} from './attributes';
import { FEATURE_KEYS } from './features';
import type { FacetCollection } from './facets';
import type { RelationshipTypeCollection } from './relationships';
import type { RulesetDefinition } from './types';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const SERIALIZABLE_MESSAGE =
  'must be JSON-serializable (no functions, class instances, or other non-plain values)';

const checkSerializable = (
  value: unknown,
  path: string,
  issues: ValidationIssue[]
): void => {
  if (value === null || value === undefined) return;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      checkSerializable(item, `${path}[${index}]`, issues)
    );
    return;
  }
  if (type === 'object' && (value as object).constructor === Object) {
    Object.entries(value as Record<string, unknown>).forEach(([key, v]) =>
      checkSerializable(v, path ? `${path}.${key}` : key, issues)
    );
    return;
  }
  issues.push({ path, message: `Value at '${path}' ${SERIALIZABLE_MESSAGE}` });
};

const checkUniqueIds = (
  items: { id: string }[],
  collectionPath: string,
  issues: ValidationIssue[]
): void => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      issues.push({
        path: `${collectionPath}[${index}].id`,
        message: `Duplicate id '${item.id}' in ${collectionPath}`,
      });
    }
    seen.add(item.id);
  });
};

/**
 * Checks the attribute *declarations* themselves — the vocabulary every other
 * check is expressed against, so problems here would otherwise surface as
 * confusing downstream errors.
 */
const checkAttributeDefinitions = (
  definitions: AttributeDefinition[],
  issues: ValidationIssue[]
): void => {
  const byId = new Map(definitions.map(d => [d.id, d]));

  definitions.forEach((definition, index) => {
    const path = `attributes[${index}]`;

    if (!definition.id) {
      issues.push({ path: `${path}.id`, message: 'id must be non-empty' });
    }
    if (!definition.label) {
      issues.push({
        path: `${path}.label`,
        message: 'label must be non-empty',
      });
    }

    if (definition.capAttributeId !== undefined) {
      if (roleOf(definition) !== 'resource') {
        issues.push({
          path: `${path}.capAttributeId`,
          message: `Only attributes with role 'resource' may declare a capAttributeId`,
        });
      }
      const cap = byId.get(definition.capAttributeId);
      if (!cap) {
        issues.push({
          path: `${path}.capAttributeId`,
          message: `Unknown attribute id '${definition.capAttributeId}'`,
        });
      } else if (roleOf(cap) !== 'cap') {
        issues.push({
          path: `${path}.capAttributeId`,
          message: `Attribute '${cap.id}' has role '${roleOf(cap)}'; a cap must have role 'cap'`,
        });
      }
    }

    if (definition.refCollection && definition.type !== 'ref') {
      issues.push({
        path: `${path}.refCollection`,
        message: `refCollection is only meaningful for type 'ref'`,
      });
    }

    if (
      (definition.min !== undefined || definition.max !== undefined) &&
      definition.type !== 'number'
    ) {
      issues.push({
        path: `${path}.min/max`,
        message: `min/max are only meaningful for type 'number'`,
      });
    }
  });
};

/**
 * Checks one facet collection: its own id/entry/category/group uniqueness,
 * every cross-reference it can make (`categoryId`, `groups`, `links`,
 * `requires`, `categoryBonuses`, `scoreExclusions`, `defaultEntryId`), and —
 * for a `stage: 'base'` collection — that every entry supplies a value for
 * each resource/cap attribute, the generalized form of the old "every
 * archetype must carry a value for each declared resource and cap".
 *
 * `entryIdsByCollection` (and its group/category counterparts) are built
 * once across every collection before this runs, so an entry can validly
 * reference another collection's ids (`links`, `requires`,
 * `scoreExclusions.whenCollectionId`) as well as its own.
 */
const checkFacetCollection = (
  collection: FacetCollection,
  index: number,
  ruleset: RulesetDefinition,
  entryIdsByCollection: Map<string, Set<string>>,
  groupIdsByCollection: Map<string, Set<string>>,
  categoryIdsByCollection: Map<string, Set<string>>,
  resolveRef: (collectionId: string, id: string) => boolean,
  issues: ValidationIssue[]
): void => {
  const path = `facets[${index}]`;

  if (!collection.id) {
    issues.push({ path: `${path}.id`, message: 'id must be non-empty' });
  }
  if (!collection.singular) {
    issues.push({
      path: `${path}.singular`,
      message: 'singular must be non-empty',
    });
  }
  if (!collection.plural) {
    issues.push({
      path: `${path}.plural`,
      message: 'plural must be non-empty',
    });
  }

  checkUniqueIds(collection.entries, `${path}.entries`, issues);
  if (collection.categories) {
    checkUniqueIds(collection.categories, `${path}.categories`, issues);
  }
  if (collection.groups) {
    checkUniqueIds(collection.groups, `${path}.groups`, issues);
  }

  if (collection.authored && collection.entries.length > 0) {
    issues.push({
      path: `${path}.entries`,
      message: 'an authored collection must declare no catalog entries',
    });
  }
  if (collection.selection === 'catalog' && collection.contributes) {
    issues.push({
      path: `${path}.contributes`,
      message:
        'a catalog collection is never held by a character, so it cannot contribute to derived stats',
    });
  }

  const categoryIds = categoryIdsByCollection.get(collection.id) ?? new Set();
  const groupIds = groupIdsByCollection.get(collection.id) ?? new Set();
  const stage = collection.contributes?.stage ?? 'preBonus';

  // Every 'base' entry must carry a value for each declared resource and
  // cap. (Capability and freeform attributes may be omitted.)
  const requiredAttributes =
    stage === 'base'
      ? ruleset.attributes
          .filter(d => roleOf(d) === 'resource' || roleOf(d) === 'cap')
          .map(d => d.id)
      : [];

  collection.entries.forEach((entry, i) => {
    const entryPath = `${path}.entries[${i}]`;

    if (!entry.id) {
      issues.push({ path: `${entryPath}.id`, message: 'id must be non-empty' });
    }
    if (!entry.label) {
      issues.push({
        path: `${entryPath}.label`,
        message: 'label must be non-empty',
      });
    }

    if (entry.categoryId && !categoryIds.has(entry.categoryId)) {
      issues.push({
        path: `${entryPath}.categoryId`,
        message: `Unknown category id '${entry.categoryId}' in facet collection '${collection.id}'`,
      });
    }
    entry.groups?.forEach((groupId, gi) => {
      if (!groupIds.has(groupId)) {
        issues.push({
          path: `${entryPath}.groups[${gi}]`,
          message: `Unknown group id '${groupId}' in facet collection '${collection.id}'`,
        });
      }
    });

    if (stage === 'base') {
      issues.push(
        ...validateAttributeBag(
          entry.attributes,
          ruleset.attributes,
          `${entryPath}.attributes`,
          { required: requiredAttributes, resolveRef }
        )
      );
    }

    issues.push(
      ...validateAttributeDeltas(
        entry.modifier?.attributeDeltas,
        ruleset.attributes,
        `${entryPath}.modifier.attributeDeltas`
      )
    );

    Object.entries(entry.modifier?.categoryDeltas ?? {}).forEach(
      ([targetCollectionId, deltas]) => {
        const targetCategoryIds =
          categoryIdsByCollection.get(targetCollectionId);
        if (!targetCategoryIds) {
          issues.push({
            path: `${entryPath}.modifier.categoryDeltas.${targetCollectionId}`,
            message: `Unknown facet collection id '${targetCollectionId}'`,
          });
          return;
        }
        Object.keys(deltas).forEach(categoryId => {
          if (!targetCategoryIds.has(categoryId)) {
            issues.push({
              path: `${entryPath}.modifier.categoryDeltas.${targetCollectionId}.${categoryId}`,
              message: `Unknown category id '${categoryId}' in facet collection '${targetCollectionId}'`,
            });
          }
        });
      }
    );

    Object.entries(entry.links ?? {}).forEach(([targetCollectionId, ids]) => {
      const targetIds = entryIdsByCollection.get(targetCollectionId);
      ids.forEach((id, li) => {
        if (!targetIds?.has(id)) {
          issues.push({
            path: `${entryPath}.links.${targetCollectionId}[${li}]`,
            message: `Unknown entry id '${id}' in facet collection '${targetCollectionId}'`,
          });
        }
      });
    });

    Object.entries(entry.requires ?? {}).forEach(
      ([targetCollectionId, ids]) => {
        const targetIds = entryIdsByCollection.get(targetCollectionId);
        ids.forEach((id, ri) => {
          if (!targetIds?.has(id)) {
            issues.push({
              path: `${entryPath}.requires.${targetCollectionId}[${ri}]`,
              message: `Unknown entry id '${id}' in facet collection '${targetCollectionId}'`,
            });
          }
        });
      }
    );
  });

  (collection.categoryBonuses ?? []).forEach((rule, bi) => {
    const bonusPath = `${path}.categoryBonuses[${bi}]`;
    if (!categoryIds.has(rule.categoryId)) {
      issues.push({
        path: `${bonusPath}.categoryId`,
        message: `Unknown category id '${rule.categoryId}' in facet collection '${collection.id}'`,
      });
    }
    if (!Number.isInteger(rule.requiredScore) || rule.requiredScore <= 0) {
      issues.push({
        path: `${bonusPath}.requiredScore`,
        message: 'requiredScore must be a positive integer',
      });
    }
    issues.push(
      ...validateAttributeDeltas(
        rule.grants.attributeDeltas,
        ruleset.attributes,
        `${bonusPath}.grants.attributeDeltas`
      )
    );
  });

  (collection.scoreExclusions ?? []).forEach((rule, ei) => {
    const exclusionPath = `${path}.scoreExclusions[${ei}]`;
    const whenIds = entryIdsByCollection.get(rule.whenCollectionId);
    if (!whenIds) {
      issues.push({
        path: `${exclusionPath}.whenCollectionId`,
        message: `Unknown facet collection id '${rule.whenCollectionId}'`,
      });
    } else if (!whenIds.has(rule.whenEntryId)) {
      issues.push({
        path: `${exclusionPath}.whenEntryId`,
        message: `Unknown entry id '${rule.whenEntryId}' in facet collection '${rule.whenCollectionId}'`,
      });
    }
    // The group lives on `whenCollectionId`, not on this collection —
    // `derived.ts`'s `isRestrictedToGroup` looks up `groupId` against
    // `ruleset.facets.find(c => c.id === rule.whenCollectionId)`'s own
    // `groups`, since a scoreExclusion is about restriction to a group of
    // the *other* collection's entries (e.g. an archetype group).
    const whenGroupIds = groupIdsByCollection.get(rule.whenCollectionId);
    if (!whenGroupIds?.has(rule.groupId)) {
      issues.push({
        path: `${exclusionPath}.groupId`,
        message: `Unknown group id '${rule.groupId}' in facet collection '${rule.whenCollectionId}'`,
      });
    }
  });

  if (
    collection.defaultEntryId !== undefined &&
    !entryIdsByCollection.get(collection.id)?.has(collection.defaultEntryId)
  ) {
    issues.push({
      path: `${path}.defaultEntryId`,
      message: `Unknown entry id '${collection.defaultEntryId}' in facet collection '${collection.id}'`,
    });
  }
};

const VALID_RELATIONSHIP_ENTITY_KINDS = [
  'character',
  'faction',
  'event',
  'quest',
  'location',
];

const VALID_RELATIONSHIP_ROLES = ['positive', 'neutral', 'negative'];

/**
 * Checks one relationship-type collection: id/entry uniqueness, that
 * `appliesTo` names two real entity kinds, that every entry has a valid
 * `role`, that a directional (`symmetric: false`) entry supplies an
 * `inverseLabel` to render its reciprocal side with, and that
 * `defaultEntryId` (if set) resolves.
 */
const checkRelationshipTypeCollection = (
  collection: RelationshipTypeCollection,
  index: number,
  issues: ValidationIssue[]
): void => {
  const path = `relationshipTypes[${index}]`;

  if (!collection.id) {
    issues.push({ path: `${path}.id`, message: 'id must be non-empty' });
  }
  if (!collection.singular) {
    issues.push({
      path: `${path}.singular`,
      message: 'singular must be non-empty',
    });
  }
  if (!collection.plural) {
    issues.push({
      path: `${path}.plural`,
      message: 'plural must be non-empty',
    });
  }

  collection.appliesTo.forEach((kind, ki) => {
    if (!VALID_RELATIONSHIP_ENTITY_KINDS.includes(kind)) {
      issues.push({
        path: `${path}.appliesTo[${ki}]`,
        message: `Unknown relationship entity kind '${kind}'`,
      });
    }
  });

  checkUniqueIds(collection.entries, `${path}.entries`, issues);

  const entryIds = new Set(collection.entries.map(e => e.id));

  collection.entries.forEach((entry, ei) => {
    const entryPath = `${path}.entries[${ei}]`;

    if (!entry.id) {
      issues.push({ path: `${entryPath}.id`, message: 'id must be non-empty' });
    }
    if (!entry.label) {
      issues.push({
        path: `${entryPath}.label`,
        message: 'label must be non-empty',
      });
    }
    if (!VALID_RELATIONSHIP_ROLES.includes(entry.role)) {
      issues.push({
        path: `${entryPath}.role`,
        message: `role must be one of ${VALID_RELATIONSHIP_ROLES.join(', ')}`,
      });
    }
    if (entry.symmetric === false && !entry.inverseLabel) {
      issues.push({
        path: `${entryPath}.inverseLabel`,
        message: `inverseLabel is required when symmetric is false`,
      });
    }
  });

  if (
    collection.defaultEntryId !== undefined &&
    !entryIds.has(collection.defaultEntryId)
  ) {
    issues.push({
      path: `${path}.defaultEntryId`,
      message: `Unknown entry id '${collection.defaultEntryId}' in relationship type collection '${collection.id}'`,
    });
  }
};

export function validateRuleset(ruleset: RulesetDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!ruleset.id) issues.push({ path: 'id', message: 'id must be non-empty' });
  if (!ruleset.name) {
    issues.push({ path: 'name', message: 'name must be non-empty' });
  }
  if (!ruleset.version) {
    issues.push({ path: 'version', message: 'version must be non-empty' });
  }

  checkUniqueIds(ruleset.attributes, 'attributes', issues);
  checkAttributeDefinitions(ruleset.attributes, issues);
  checkUniqueIds(ruleset.facets, 'facets', issues);
  checkUniqueIds(ruleset.relationshipTypes, 'relationshipTypes', issues);
  ruleset.relationshipTypes.forEach((collection, index) =>
    checkRelationshipTypeCollection(collection, index, issues)
  );

  // Every collection's own entry/group/category ids, built once so an entry
  // in one collection can validly cross-reference another's (`links`,
  // `requires`, `scoreExclusions.whenCollectionId`).
  const entryIdsByCollection = new Map<string, Set<string>>();
  const groupIdsByCollection = new Map<string, Set<string>>();
  const categoryIdsByCollection = new Map<string, Set<string>>();
  ruleset.facets.forEach(collection => {
    entryIdsByCollection.set(
      collection.id,
      new Set(collection.entries.map(e => e.id))
    );
    groupIdsByCollection.set(
      collection.id,
      new Set((collection.groups ?? []).map(g => g.id))
    );
    categoryIdsByCollection.set(
      collection.id,
      new Set((collection.categories ?? []).map(c => c.id))
    );
  });

  /** Generic `ref` resolution, so a ref attribute needs no bespoke check. */
  const resolveRef = (collectionId: string, id: string): boolean =>
    entryIdsByCollection.get(collectionId)?.has(id) ?? false;

  ruleset.facets.forEach((collection, index) =>
    checkFacetCollection(
      collection,
      index,
      ruleset,
      entryIdsByCollection,
      groupIdsByCollection,
      categoryIdsByCollection,
      resolveRef,
      issues
    )
  );

  // Flags gate navigation registration (#10), so a missing one would silently
  // hide a whole subsystem rather than fail loudly.
  FEATURE_KEYS.forEach(key => {
    if (typeof ruleset.features?.[key] !== 'boolean') {
      issues.push({
        path: `features.${key}`,
        message: `features.${key} must be a boolean`,
      });
    }
  });

  if (ruleset.map && !ruleset.map.imageKey) {
    issues.push({
      path: 'map.imageKey',
      message: 'imageKey must be non-empty when map is present',
    });
  }
  if (ruleset.branding.iconKey === '') {
    issues.push({
      path: 'branding.iconKey',
      message: 'iconKey must be non-empty when present',
    });
  }
  if (ruleset.branding.splashKey === '') {
    issues.push({
      path: 'branding.splashKey',
      message: 'splashKey must be non-empty when present',
    });
  }

  checkSerializable(ruleset, '', issues);

  return { valid: issues.length === 0, issues };
}

/**
 * Validates a character's own attribute values against the ruleset. Separate
 * from `validateRuleset` because it checks *data*, not the ruleset itself —
 * and because an unknown attribute id on one character should not invalidate
 * the whole ruleset.
 */
export function validateCharacterAttributes(
  attributes: AttributeBag | undefined,
  ruleset: RulesetDefinition,
  path = 'character.attributes'
): ValidationResult {
  const perCharacter = ruleset.attributes.filter(d => d.perCharacter !== false);
  const issues = validateAttributeBag(attributes, perCharacter, path);
  return { valid: issues.length === 0, issues };
}
