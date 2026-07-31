/**
 * Unit tests for the facet accessors (#51) — the seam every screen and util
 * uses instead of reaching for `archetypeId`/`traitIds`/`qualityIds`/
 * `modifications` directly. `derived.ts`, `validate.ts` and the screens all
 * exercise these indirectly; this file pins their behavior in isolation.
 */
import {
  findFacetCollection,
  getFacetIds,
  getAuthoredFacets,
  getSingleFacetId,
  getPrimaryFacetLabel,
  setFacetIds,
  resolveFacetEntries,
  getCategoryScore,
} from '@/ruleset/facets';
import type { GameCharacter } from '@models/types';
import { genericRuleset } from '../fixtures/genericRuleset';

const TS = '2026-01-01T00:00:00.000Z';

const makeCharacter = (
  overrides: Partial<GameCharacter> = {}
): GameCharacter => ({
  id: 'char-1',
  name: 'Test Character',
  factions: [],
  relationships: [],
  createdAt: TS,
  updatedAt: TS,
  ...overrides,
});

describe('findFacetCollection', () => {
  it('finds a declared collection by id', () => {
    expect(findFacetCollection(genericRuleset, 'talents')).toBe(
      genericRuleset.facets.find(c => c.id === 'talents')
    );
  });

  it('returns undefined for an id the ruleset does not declare', () => {
    expect(findFacetCollection(genericRuleset, 'nonexistent')).toBeUndefined();
  });
});

describe('getFacetIds', () => {
  it('returns the catalog ids held in a collection', () => {
    const character = makeCharacter({
      facets: { talents: ['well_read', 'strong_back'] },
    });

    expect(getFacetIds(character, 'talents')).toEqual([
      'well_read',
      'strong_back',
    ]);
  });

  it('excludes authored (non-string) entries', () => {
    const character = makeCharacter({
      facets: {
        augments: ['stray-string-id', { name: 'Grafted Lens', modifier: {} }],
      },
    });

    expect(getFacetIds(character, 'augments')).toEqual(['stray-string-id']);
  });

  it('returns an empty array for a collection the character has no entry for', () => {
    const character = makeCharacter();

    expect(getFacetIds(character, 'talents')).toEqual([]);
  });
});

describe('getAuthoredFacets', () => {
  it('returns only the inline authored entries', () => {
    const authored = { name: 'Grafted Lens', description: 'Sees in the dark.' };
    const character = makeCharacter({
      facets: { augments: ['stray-string-id', authored] },
    });

    expect(getAuthoredFacets(character, 'augments')).toEqual([authored]);
  });

  it('returns an empty array when nothing is authored', () => {
    const character = makeCharacter({ facets: { talents: ['well_read'] } });

    expect(getAuthoredFacets(character, 'augments')).toEqual([]);
  });
});

describe('getSingleFacetId', () => {
  it('returns the one held id for a single-selection collection', () => {
    const character = makeCharacter({ facets: { lineages: ['wanderer'] } });

    expect(getSingleFacetId(character, 'lineages')).toBe('wanderer');
  });

  it('returns undefined when nothing is held', () => {
    const character = makeCharacter();

    expect(getSingleFacetId(character, 'lineages')).toBeUndefined();
  });
});

describe('getPrimaryFacetLabel', () => {
  it("resolves the character's held entry in the ruleset's first single collection", () => {
    const character = makeCharacter({ facets: { lineages: ['scholar'] } });

    expect(getPrimaryFacetLabel(character, genericRuleset)).toBe('Scholar');
  });

  it('returns undefined when the character holds nothing in that collection', () => {
    const character = makeCharacter();

    expect(getPrimaryFacetLabel(character, genericRuleset)).toBeUndefined();
  });

  it('returns undefined when the ruleset declares no single-selection collection', () => {
    const noSingleRuleset = {
      ...genericRuleset,
      facets: genericRuleset.facets.filter(c => c.selection !== 'single'),
    };
    const character = makeCharacter({ facets: { talents: ['well_read'] } });

    expect(getPrimaryFacetLabel(character, noSingleRuleset)).toBeUndefined();
  });
});

describe('setFacetIds', () => {
  it('returns a new character with the collection replaced', () => {
    const character = makeCharacter({ facets: { talents: ['well_read'] } });

    const updated = setFacetIds(character, 'talents', ['strong_back']);

    expect(updated.facets?.talents).toEqual(['strong_back']);
    expect(updated).not.toBe(character);
  });

  it('leaves other collections on the character untouched', () => {
    const character = makeCharacter({
      facets: { lineages: ['wanderer'], talents: ['well_read'] },
    });

    const updated = setFacetIds(character, 'talents', []);

    expect(updated.facets?.lineages).toEqual(['wanderer']);
  });

  it('does not mutate the original character', () => {
    const character = makeCharacter({ facets: { talents: ['well_read'] } });

    setFacetIds(character, 'talents', ['strong_back']);

    expect(character.facets?.talents).toEqual(['well_read']);
  });
});

describe('resolveFacetEntries', () => {
  it("resolves a character's held ids to their full FacetEntry objects", () => {
    const collection = genericRuleset.facets.find(c => c.id === 'talents')!;
    const character = makeCharacter({ facets: { talents: ['well_read'] } });

    const resolved = resolveFacetEntries(character, collection);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].id).toBe('well_read');
    expect(resolved[0].label).toBe('Well Read');
  });

  it('silently drops an id the ruleset does not define', () => {
    const collection = genericRuleset.facets.find(c => c.id === 'talents')!;
    const character = makeCharacter({
      facets: { talents: ['well_read', 'no_such_entry'] },
    });

    expect(resolveFacetEntries(character, collection).map(e => e.id)).toEqual([
      'well_read',
    ]);
  });
});

describe('getCategoryScore', () => {
  it('reads a scored collection/category pair', () => {
    const categoryScores = { knacks: { forge: 2, wit: 1 } };

    expect(getCategoryScore(categoryScores, 'knacks', 'forge')).toBe(2);
  });

  it('defaults to 0 for a category nobody has scored', () => {
    const categoryScores = { knacks: { forge: 2 } };

    expect(getCategoryScore(categoryScores, 'knacks', 'wit')).toBe(0);
  });

  it('defaults to 0 for a collection with no scores at all', () => {
    expect(getCategoryScore({}, 'bonds', 'duty')).toBe(0);
  });
});

/**
 * mechanicsRuleset declares five facet-bearing collections plus a catalog —
 * proof the accessors work uniformly across however many a ruleset declares,
 * not just the four the engine used to hardcode.
 */
describe('accessors across every collection kind mechanicsRuleset declares', () => {
  const character = makeCharacter({
    facets: {
      callings: ['tinker'],
      knacks: ['hammer_hand'],
      bonds: ['oath_kept'],
      temperaments: ['steadfast'],
      rigs: [{ name: 'Overclocked Coil', modifier: {} }],
    },
  });

  it.each([
    ['callings', ['tinker']],
    ['knacks', ['hammer_hand']],
    ['bonds', ['oath_kept']],
    ['temperaments', ['steadfast']],
    ['charms', []],
  ])('getFacetIds resolves %s', (collectionId, expected) => {
    expect(getFacetIds(character, collectionId)).toEqual(expected);
  });

  it('getAuthoredFacets resolves the authored rigs collection', () => {
    expect(getAuthoredFacets(character, 'rigs')).toEqual([
      { name: 'Overclocked Coil', modifier: {} },
    ]);
  });
});
