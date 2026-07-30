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

describe('useCharacterFilterFields', () => {
  it('labels its fields using the ruleset terminology', () => {
    const fields = renderFields();

    expect(findField(fields, 'perkId').label).toBe('Talent');
    expect(findField(fields, 'distinctionId').label).toBe('Virtue');

    const perkField = findField(fields, 'perkId') as SelectFilterField;
    expect(perkField.options.map(o => o.label)).toEqual(
      expect.arrayContaining(['Well Read', 'Strong Back'])
    );
  });

  it('hides the recipe filter when the ruleset disables recipes', () => {
    const fields = renderFields();
    expect(fields.find(f => f.key === 'recipeId')).toBeUndefined();
  });

  it('shows the recipe filter, populated from the ruleset, when enabled', () => {
    const withRecipes: RulesetDefinition = {
      ...genericRuleset,
      features: { ...genericRuleset.features, recipes: true },
      recipes: [
        { id: 'stew', name: 'Stew', description: '', materials: ['Pot'] },
      ],
    };
    const fields = renderFields(withRecipes);
    const recipeField = findField(fields, 'recipeId') as SelectFilterField;
    expect(recipeField.options.map(o => o.label)).toContain('Stew');
  });

  it('matches a character by trait/quality id', () => {
    const fields = renderFields();
    const perkField = findField(fields, 'perkId') as SelectFilterField;
    const character = makeCharacter({ traitIds: ['well_read'] });

    expect(perkField.matches(character, 'well_read', {})).toBe(true);
    expect(perkField.matches(character, 'strong_back', {})).toBe(false);
  });

  it('scores trait categories using sibling field values', () => {
    const fields = renderFields();
    const minScoreField = findField(fields, 'minTagScore') as NumberFilterField;
    const character = makeCharacter({ traitIds: ['well_read'] });

    // 'lore' category: well_read counts, so a threshold of 1 passes.
    expect(minScoreField.matches(character, 1, { traitCategory: 'lore' })).toBe(
      true
    );
    // 'might' category: well_read doesn't count.
    expect(
      minScoreField.matches(character, 1, { traitCategory: 'might' })
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
