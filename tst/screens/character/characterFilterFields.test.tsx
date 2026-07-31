import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useCharacterFilterFields } from '@screens/character/characterFilterFields';
import { RulesetProvider, type RulesetDefinition } from '@/ruleset';
import { genericRuleset } from '../../fixtures/genericRuleset';
import { makeCharacter } from '../../helpers/factories';
import type {
  NumberFilterField,
  SelectFilterField,
} from '@/components/search/filterFieldTypes';

const renderFields = (ruleset: RulesetDefinition = genericRuleset) =>
  renderHook(() => useCharacterFilterFields(), {
    wrapper: ({ children }) => (
      <RulesetProvider ruleset={ruleset} assets={{}}>
        {children}
      </RulesetProvider>
    ),
  }).result.current;

const findField = <T extends { key: string }>(fields: T[], key: string): T => {
  const field = fields.find(f => f.key === key);
  if (!field) {
    throw new Error(`No field with key ${key}`);
  }
  return field;
};

/** A ruleset where `talents`' `well_read` entry links into a catalog collection. */
const rulesetWithCatalogLink: RulesetDefinition = {
  ...genericRuleset,
  facets: genericRuleset.facets
    .map(collection =>
      collection.id === 'talents'
        ? {
            ...collection,
            entries: collection.entries.map(entry =>
              entry.id === 'well_read'
                ? { ...entry, links: { recipes: ['stew'] } }
                : entry
            ),
          }
        : collection
    )
    .concat([
      {
        id: 'recipes',
        singular: 'Recipe',
        plural: 'Recipes',
        selection: 'catalog',
        entries: [
          { id: 'stew', label: 'Stew', description: '', materials: ['Pot'] },
        ],
      },
    ]),
};

describe('useCharacterFilterFields', () => {
  it('labels its fields using the ruleset terminology', () => {
    const fields = renderFields();

    expect(findField(fields, 'facet:talents').label).toBe('Talent');
    expect(findField(fields, 'facet:virtues').label).toBe('Virtue');

    const talentField = findField(fields, 'facet:talents') as SelectFilterField;
    expect(talentField.options.map(o => o.label)).toEqual(
      expect.arrayContaining(['Well Read', 'Strong Back'])
    );
  });

  it('hides a catalog collection filter when nothing links into it', () => {
    const fields = renderFields();
    expect(fields.find(f => f.key.startsWith('facetLink:'))).toBeUndefined();
  });

  it('shows a catalog collection filter, populated from the ruleset, when something links into it', () => {
    const fields = renderFields(rulesetWithCatalogLink);
    const recipeField = findField(
      fields,
      'facetLink:recipes'
    ) as SelectFilterField;
    expect(recipeField.options.map(o => o.label)).toContain('Stew');
  });

  it('matches a character by facet id', () => {
    const fields = renderFields();
    const talentField = findField(fields, 'facet:talents') as SelectFilterField;
    const character = makeCharacter({ facets: { talents: ['well_read'] } });

    expect(talentField.matches(character, 'well_read', {})).toBe(true);
    expect(talentField.matches(character, 'strong_back', {})).toBe(false);
  });

  it('scores facet categories using the sibling category field value', () => {
    const fields = renderFields();
    const minScoreField = findField(
      fields,
      'facetMinScore:talents'
    ) as NumberFilterField;
    const character = makeCharacter({ facets: { talents: ['well_read'] } });

    // 'lore' category: well_read counts, so a threshold of 1 passes.
    expect(
      minScoreField.matches(character, 1, { 'facetCategory:talents': 'lore' })
    ).toBe(true);
    // 'might' category: well_read doesn't count.
    expect(
      minScoreField.matches(character, 1, { 'facetCategory:talents': 'might' })
    ).toBe(false);
    // No category selected — the field is a no-op until paired.
    expect(minScoreField.matches(character, 1, {})).toBe(true);
  });

  it('matches present/retired status', () => {
    const fields = renderFields();
    const presentField = findField(
      fields,
      'presentStatus'
    ) as SelectFilterField;
    const retiredField = findField(
      fields,
      'retiredStatus'
    ) as SelectFilterField;

    const present = makeCharacter({ present: true, retired: false });
    const retired = makeCharacter({ present: false, retired: true });

    expect(presentField.matches(present, 'present', {})).toBe(true);
    expect(presentField.matches(retired, 'present', {})).toBe(false);
    expect(retiredField.matches(retired, 'retired', {})).toBe(true);
    expect(retiredField.matches(present, 'active', {})).toBe(true);
    expect(retiredField.matches(retired, 'active', {})).toBe(false);
  });
});
