/**
 * `exampleSeedDataset` is hand-authored data kept next to `exampleRuleset`
 * (#51) so `npm run web` + "Load Example Campaign" has real numbers on every
 * stats screen. Nothing type-checks that its ids actually resolve against the
 * ruleset it is written for, or that its faction network is internally
 * consistent — this file is the regression test for that, so a future schema
 * change that silently orphans an id here fails loudly instead of just
 * rendering an empty legend in the app.
 */
import { exampleSeedDataset } from '@/ruleset/exampleSeedData';
import { exampleRuleset } from '@/ruleset/exampleRuleset';
import { getFacetIds, getAuthoredFacets } from '@/ruleset/facets';
import { validateRuleset } from '@/ruleset/validate';

describe('exampleSeedDataset', () => {
  it('is written for a ruleset that is itself valid', () => {
    expect(validateRuleset(exampleRuleset)).toEqual({
      valid: true,
      issues: [],
    });
  });

  describe('character facet ids resolve against exampleRuleset', () => {
    const catalogCollections = exampleRuleset.facets.filter(
      c => !c.authored && c.selection !== 'catalog'
    );

    it.each(exampleSeedDataset.characters.map(c => [c.name, c] as const))(
      '%s',
      (_name, character) => {
        catalogCollections.forEach(collection => {
          const heldIds = getFacetIds(character, collection.id);
          const entryIds = new Set(collection.entries.map(e => e.id));
          heldIds.forEach(id => {
            expect(entryIds.has(id)).toBe(true);
          });
        });
      }
    );

    it('every authored modification is a name/description/modifier object, not a catalog id', () => {
      exampleSeedDataset.characters.forEach(character => {
        const authored = getAuthoredFacets(character, 'modifications');
        const held = character.facets?.modifications ?? [];
        // Nothing in the authored collection's stored array is a bare string.
        expect(authored).toHaveLength(held.length);
        authored.forEach(entry => {
          expect(typeof entry.name).toBe('string');
          expect(entry.name.length).toBeGreaterThan(0);
        });
      });
    });

    it('respects the qualities collection’s maxSelections', () => {
      const qualities = exampleRuleset.facets.find(c => c.id === 'qualities')!;
      exampleSeedDataset.characters.forEach(character => {
        expect(getFacetIds(character, 'qualities').length).toBeLessThanOrEqual(
          qualities.maxSelections!
        );
      });
    });
  });

  describe('cross-references resolve', () => {
    const locationIds = new Set(exampleSeedDataset.locations.map(l => l.id));
    const factionNames = new Set(exampleSeedDataset.factions.map(f => f.name));
    const characterIds = new Set(exampleSeedDataset.characters.map(c => c.id));
    const eventIds = new Set(exampleSeedDataset.events.map(e => e.id));

    it('every character locationId resolves to a declared location', () => {
      exampleSeedDataset.characters.forEach(character => {
        if (character.locationId) {
          expect(locationIds.has(character.locationId)).toBe(true);
        }
      });
    });

    it('every character faction name resolves to a declared faction', () => {
      exampleSeedDataset.characters.forEach(character => {
        character.factions.forEach(faction => {
          expect(factionNames.has(faction.name)).toBe(true);
        });
      });
    });

    it('every event characterIds/locationId/factionNames reference resolves', () => {
      exampleSeedDataset.events.forEach(event => {
        if (event.locationId) {
          expect(locationIds.has(event.locationId)).toBe(true);
        }
        (event.characterIds ?? []).forEach(id =>
          expect(characterIds.has(id)).toBe(true)
        );
        (event.factionNames ?? []).forEach(name =>
          expect(factionNames.has(name)).toBe(true)
        );
      });
    });

    it('every quest reference (location, faction, event, assigned character) resolves', () => {
      exampleSeedDataset.quests.forEach(quest => {
        if (quest.locationId) {
          expect(locationIds.has(quest.locationId)).toBe(true);
        }
        (quest.factionNames ?? []).forEach(name =>
          expect(factionNames.has(name)).toBe(true)
        );
        (quest.eventIds ?? []).forEach(id =>
          expect(eventIds.has(id)).toBe(true)
        );
        (quest.assignedCharacterIds ?? []).forEach(id =>
          expect(characterIds.has(id)).toBe(true)
        );
      });
    });

    it('every quest facet preference resolves against exampleRuleset', () => {
      exampleSeedDataset.quests.forEach(quest => {
        [quest.desirable, quest.undesirable].forEach(preferences => {
          Object.entries(preferences?.entries ?? {}).forEach(
            ([collectionId, ids]) => {
              const collection = exampleRuleset.facets.find(
                c => c.id === collectionId
              )!;
              const entryIds = new Set(collection.entries.map(e => e.id));
              ids.forEach(id => expect(entryIds.has(id)).toBe(true));
            }
          );
          Object.entries(preferences?.categories ?? {}).forEach(
            ([collectionId, ids]) => {
              const collection = exampleRuleset.facets.find(
                c => c.id === collectionId
              )!;
              const categoryIds = new Set(
                (collection.categories ?? []).map(c => c.id)
              );
              ids.forEach(id => expect(categoryIds.has(id)).toBe(true));
            }
          );
        });
      });
    });
  });

  describe('faction network', () => {
    it('every faction relationship is reciprocated with the same standing', () => {
      const byName = new Map(exampleSeedDataset.factions.map(f => [f.name, f]));

      exampleSeedDataset.factions.forEach(faction => {
        (faction.relationships ?? []).forEach(relationship => {
          const other = byName.get(relationship.factionName);
          expect(other).toBeDefined();

          const reciprocal = other?.relationships?.find(
            r => r.factionName === faction.name
          );
          expect(reciprocal).toBeDefined();
          expect(reciprocal?.relationshipTypeId).toBe(
            relationship.relationshipTypeId
          );
        });
      });
    });
  });

  it('round-trips through JSON without changing shape', () => {
    const roundTripped = JSON.parse(
      JSON.stringify(exampleSeedDataset)
    ) as typeof exampleSeedDataset;

    expect(roundTripped).toEqual(exampleSeedDataset);
  });
});
