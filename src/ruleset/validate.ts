import {
  roleOf,
  validateAttributeBag,
  validateAttributeDeltas,
  type AttributeDefinition,
  type RefCollection,
} from './attributes';
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
  checkUniqueIds(ruleset.groups, 'groups', issues);
  checkUniqueIds(ruleset.archetypes, 'archetypes', issues);
  checkUniqueIds(ruleset.traitCategories, 'traitCategories', issues);
  checkUniqueIds(ruleset.traits, 'traits', issues);
  checkUniqueIds(ruleset.qualities, 'qualities', issues);
  if (ruleset.recipes) checkUniqueIds(ruleset.recipes, 'recipes', issues);

  checkAttributeDefinitions(ruleset.attributes, issues);

  const groupIds = new Set(ruleset.groups.map(g => g.id));
  const categoryIds = new Set(ruleset.traitCategories.map(c => c.id));
  const archetypeIds = new Set(ruleset.archetypes.map(a => a.id));
  const recipeIds = new Set((ruleset.recipes ?? []).map(r => r.id));
  const traitIds = new Set(ruleset.traits.map(t => t.id));
  const qualityIds = new Set(ruleset.qualities.map(q => q.id));

  /** Generic `ref` resolution, so a ref attribute needs no bespoke check. */
  const resolveRef = (collection: RefCollection, id: string): boolean => {
    switch (collection) {
      case 'archetypes':
        return archetypeIds.has(id);
      case 'traits':
        return traitIds.has(id);
      case 'qualities':
        return qualityIds.has(id);
      case 'traitCategories':
        return categoryIds.has(id);
      case 'groups':
        return groupIds.has(id);
      case 'recipes':
        return recipeIds.has(id);
    }
  };

  // Every archetype must carry a value for each declared resource and cap.
  // (Capability and freeform attributes may be omitted.)
  const requiredArchetypeAttributes = ruleset.attributes
    .filter(d => roleOf(d) === 'resource' || roleOf(d) === 'cap')
    .map(d => d.id);

  ruleset.archetypes.forEach((archetype, index) => {
    archetype.groups.forEach((groupId, i) => {
      if (!groupIds.has(groupId)) {
        issues.push({
          path: `archetypes[${index}].groups[${i}]`,
          message: `Unknown group id '${groupId}'`,
        });
      }
    });

    issues.push(
      ...validateAttributeBag(
        archetype.attributes,
        ruleset.attributes,
        `archetypes[${index}].attributes`,
        { required: requiredArchetypeAttributes, resolveRef }
      )
    );
  });

  ruleset.traits.forEach((trait, index) => {
    if (!categoryIds.has(trait.categoryId)) {
      issues.push({
        path: `traits[${index}].categoryId`,
        message: `Unknown traitCategory id '${trait.categoryId}'`,
      });
    }
    trait.allowedArchetypeIds?.forEach((id, i) => {
      if (!archetypeIds.has(id)) {
        issues.push({
          path: `traits[${index}].allowedArchetypeIds[${i}]`,
          message: `Unknown archetype id '${id}'`,
        });
      }
    });
    trait.recipeIds?.forEach((id, i) => {
      if (!recipeIds.has(id)) {
        issues.push({
          path: `traits[${index}].recipeIds[${i}]`,
          message: `Unknown recipe id '${id}'`,
        });
      }
    });

    issues.push(
      ...validateAttributeDeltas(
        trait.modifier?.attributeDeltas,
        ruleset.attributes,
        `traits[${index}].modifier.attributeDeltas`
      )
    );
    Object.keys(trait.modifier?.categoryDeltas ?? {}).forEach(id => {
      if (!categoryIds.has(id)) {
        issues.push({
          path: `traits[${index}].modifier.categoryDeltas.${id}`,
          message: `Unknown traitCategory id '${id}'`,
        });
      }
    });
  });

  ruleset.qualities.forEach((quality, index) => {
    quality.allowedArchetypeIds?.forEach((id, i) => {
      if (!archetypeIds.has(id)) {
        issues.push({
          path: `qualities[${index}].allowedArchetypeIds[${i}]`,
          message: `Unknown archetype id '${id}'`,
        });
      }
    });
  });

  ruleset.categoryBonuses.forEach((rule, index) => {
    if (!categoryIds.has(rule.categoryId)) {
      issues.push({
        path: `categoryBonuses[${index}].categoryId`,
        message: `Unknown traitCategory id '${rule.categoryId}'`,
      });
    }
    if (!Number.isInteger(rule.requiredScore) || rule.requiredScore <= 0) {
      issues.push({
        path: `categoryBonuses[${index}].requiredScore`,
        message: 'requiredScore must be a positive integer',
      });
    }
    issues.push(
      ...validateAttributeDeltas(
        rule.grants.attributeDeltas,
        ruleset.attributes,
        `categoryBonuses[${index}].grants.attributeDeltas`
      )
    );
  });

  ruleset.archetypeRules?.forEach((rule, index) => {
    if (!archetypeIds.has(rule.archetypeId)) {
      issues.push({
        path: `archetypeRules[${index}].archetypeId`,
        message: `Unknown archetype id '${rule.archetypeId}'`,
      });
    }
    if (!groupIds.has(rule.groupId)) {
      issues.push({
        path: `archetypeRules[${index}].groupId`,
        message: `Unknown group id '${rule.groupId}'`,
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
  attributes: RulesetDefinition['archetypes'][number]['attributes'] | undefined,
  ruleset: RulesetDefinition,
  path = 'character.attributes'
): ValidationResult {
  const perCharacter = ruleset.attributes.filter(d => d.perCharacter !== false);
  const issues = validateAttributeBag(attributes, perCharacter, path);
  return { valid: issues.length === 0, issues };
}
