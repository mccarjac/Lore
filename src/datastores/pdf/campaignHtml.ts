/**
 * The campaign wiki, rendered as one printable HTML document (#28).
 *
 * This is the whole of the PDF store's judgement; `index.ts` only hands the
 * result to the print engine. It is a **pure function reaching no native
 * module**, which is what makes the interesting behavior — cross-references,
 * terminology, feature gating, escaping — testable without an emulator.
 *
 * Three properties are load-bearing:
 *
 * - **Everything interpolated is escaped.** Names, notes and descriptions are
 *   user-authored and the output is executed by a WebView. A character called
 *   `<script>` must print as text.
 * - **Nouns come from the ruleset**, through `getLabel` — the non-hook form,
 *   which exists for callers like this one. No domain noun is spelled here.
 * - **Ids never reach the page.** A `locationId` renders as the location's
 *   name, a `characterIds` list as names, and the reverse directions are
 *   rendered too — a location lists who lives there, a faction lists its
 *   members. That reciprocity is what makes the document a wiki rather than a
 *   formatted dump.
 *
 * Ordering is inherited, not chosen: `exportDataset()` has already run
 * `sortDatasetDeterministically`, so two exports of unchanged data produce the
 * same document.
 */

import {
  QuestStatus,
  type CertaintyLevel,
  type DiscordMessage,
  type GameCharacter,
  type GameEvent,
  type GameLocation,
  type GameQuest,
  type Relationship,
} from '@models/types';
import type { StoredFaction } from '@utils/characterStorage';
import { formatEventDate } from '@utils/dateUtils';
import {
  formatAttributeValue,
  getNumber,
  roleOf,
  type AttributeDefinition,
} from '@/ruleset/attributes';
import { calculateDerivedStats } from '@/ruleset/derived';
import {
  getAuthoredFacets,
  getFacetIds,
  getPrimaryFacetLabel,
  type FacetCollection,
} from '@/ruleset/facets';
import {
  findRelationshipEntryForPair,
  relationshipLabel,
} from '@/ruleset/relationships';
import { getLabel } from '@/ruleset/terminology';
import type { Modifier, RulesetDefinition } from '@/ruleset/types';
import {
  imageUrisOf,
  type CampaignDataset,
  type ResolvedImages,
} from './dataset';

// --- Text -------------------------------------------------------------------

/** Escapes the five characters that can change the meaning of the markup. */
const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Escaped, with authored line breaks preserved. For notes and descriptions. */
const prose = (value: string): string => esc(value).replace(/\r?\n/g, '<br />');

/**
 * A stable anchor from an arbitrary key.
 *
 * Deliberately a local copy of `fileArchive.ts`'s `sanitizeForFilename` rule
 * rather than an import of it: that module imports `expo-file-system` at the
 * top level, and this one reaching no native module is the point.
 */
const anchor = (prefix: string, key: string): string =>
  `${prefix}-${key.replace(/[^a-zA-Z0-9]/g, '_')}`;

const link = (anchorId: string, text: string): string =>
  `<a href="#${esc(anchorId)}">${esc(text)}</a>`;

/**
 * A date field authored as `YYYY-MM-DD`. `formatEventDate` throws on anything
 * else, and one malformed record must not cost the whole document — so the raw
 * value is printed instead.
 */
const eventDate = (date?: string, time?: string): string | undefined => {
  if (!date) {
    return undefined;
  }
  try {
    return formatEventDate(date, time);
  } catch {
    return time ? `${date} at ${time}` : date;
  }
};

/** A full ISO timestamp (`createdAt`, `updatedAt`, a Discord message time). */
const isoDate = (iso: string | undefined, withTime = false): string => {
  if (!iso) {
    return '';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return withTime
    ? parsed.toLocaleString('en-US', {
        ...options,
        hour: 'numeric',
        minute: '2-digit',
      })
    : parsed.toLocaleDateString('en-US', options);
};

const QUEST_STATUS_LABELS: Record<QuestStatus, string> = {
  [QuestStatus.NotStarted]: 'Not Started',
  [QuestStatus.Assigned]: 'Assigned',
  [QuestStatus.InProgress]: 'In Progress',
  [QuestStatus.Successful]: 'Successful',
  [QuestStatus.Failure]: 'Failure',
};

const CERTAINTY_LABELS: Record<CertaintyLevel, string> = {
  unconfirmed: 'Unconfirmed',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
};

// --- Markup building blocks -------------------------------------------------

/** A fact row. Omitted entirely when there is no value — no empty rows. */
const row = (label: string, value: string | undefined): string =>
  value ? `<tr><th>${esc(label)}</th><td>${value}</td></tr>` : '';

const facts = (rows: string[]): string => {
  const body = rows.filter(Boolean).join('');
  return body ? `<table class="facts">${body}</table>` : '';
};

/** A titled block. Omitted when its body is empty, for the same reason. */
const field = (title: string, body: string): string =>
  body ? `<div class="field"><h3>${esc(title)}</h3>${body}</div>` : '';

const bullets = (items: string[]): string => {
  const present = items.filter(Boolean);
  return present.length
    ? `<ul class="plain">${present.map(item => `<li>${item}</li>`).join('')}</ul>`
    : '';
};

const badge = (text: string): string =>
  `<span class="badge">${esc(text)}</span>`;

/**
 * A record's pictures.
 *
 * A URI the resolver could not embed prints a visible note rather than
 * vanishing: a reader comparing the document against the app should be able to
 * tell "this record has no photograph" from "this photograph did not fit".
 */
const gallery = (
  record: { imageUris?: string[]; imageUri?: string },
  images: ResolvedImages,
  alt: string
): string => {
  const uris = imageUrisOf(record);
  if (uris.length === 0) {
    return '';
  }

  const items = uris.map(uri => {
    const dataUri = images.get(uri);
    return dataUri
      ? `<img src="${esc(dataUri)}" alt="${esc(alt)}" />`
      : `<span class="omitted">Image omitted — unreadable, or too large for this document.</span>`;
  });

  return `<div class="gallery">${items.join('')}</div>`;
};

// --- Cross-reference lookups ------------------------------------------------

/**
 * Every index the document needs, built once per render.
 *
 * The reverse maps (`charactersByLocation` and friends) are what let a location
 * list its residents without a nested scan per entry.
 */
interface Lookups {
  charactersById: Map<string, GameCharacter>;
  /**
   * By name, because `Relationship` points at a character by *name* rather than
   * id — the one reference in the domain that does.
   */
  charactersByName: Map<string, GameCharacter>;
  locationsById: Map<string, GameLocation>;
  eventsById: Map<string, GameEvent>;
  questsById: Map<string, GameQuest>;
  factionNames: Set<string>;
  charactersByLocation: Map<string, GameCharacter[]>;
  charactersByFaction: Map<string, GameCharacter[]>;
  eventsByLocation: Map<string, GameEvent[]>;
  eventsByCharacter: Map<string, GameEvent[]>;
  questsByLocation: Map<string, GameQuest[]>;
  questsByCharacter: Map<string, GameQuest[]>;
  characterIdByDiscordUser: Map<string, string>;
}

const push = <T>(map: Map<string, T[]>, key: string, value: T): void => {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
};

const buildLookups = (dataset: CampaignDataset): Lookups => {
  const characters = dataset.characters ?? [];
  const events = dataset.events ?? [];
  const quests = dataset.quests ?? [];

  const lookups: Lookups = {
    charactersById: new Map(characters.map(c => [c.id, c])),
    charactersByName: new Map(characters.map(c => [c.name, c])),
    locationsById: new Map((dataset.locations ?? []).map(l => [l.id, l])),
    eventsById: new Map(events.map(e => [e.id, e])),
    questsById: new Map(quests.map(q => [q.id, q])),
    factionNames: new Set((dataset.factions ?? []).map(f => f.name)),
    charactersByLocation: new Map(),
    charactersByFaction: new Map(),
    eventsByLocation: new Map(),
    eventsByCharacter: new Map(),
    questsByLocation: new Map(),
    questsByCharacter: new Map(),
    characterIdByDiscordUser: new Map(
      (dataset.discord?.userMappings ?? []).map(m => [
        m.discordUserId,
        m.characterId,
      ])
    ),
  };

  characters.forEach(character => {
    if (character.locationId) {
      push(lookups.charactersByLocation, character.locationId, character);
    }
    character.factions?.forEach(faction =>
      push(lookups.charactersByFaction, faction.name, character)
    );
  });

  events.forEach(event => {
    if (event.locationId) {
      push(lookups.eventsByLocation, event.locationId, event);
    }
    event.characterIds?.forEach(id =>
      push(lookups.eventsByCharacter, id, event)
    );
  });

  quests.forEach(quest => {
    if (quest.locationId) {
      push(lookups.questsByLocation, quest.locationId, quest);
    }
    quest.assignedCharacterIds?.forEach(id =>
      push(lookups.questsByCharacter, id, quest)
    );
  });

  return lookups;
};

/** A reference that renders as a link when it resolves, plain text when not. */
const characterRef = (id: string, lookups: Lookups): string => {
  const character = lookups.charactersById.get(id);
  return character
    ? link(anchor('character', character.id), character.name)
    : `<span class="unresolved">${esc(id)}</span>`;
};

const locationRef = (id: string, lookups: Lookups): string => {
  const location = lookups.locationsById.get(id);
  return location
    ? link(anchor('location', location.id), location.name)
    : `<span class="unresolved">${esc(id)}</span>`;
};

const eventRef = (id: string, lookups: Lookups): string => {
  const event = lookups.eventsById.get(id);
  if (!event) {
    return `<span class="unresolved">${esc(id)}</span>`;
  }
  const when = eventDate(event.date);
  return `${link(anchor('event', event.id), event.title)}${
    when ? ` <span class="when">${esc(when)}</span>` : ''
  }`;
};

const questRef = (id: string, lookups: Lookups): string => {
  const quest = lookups.questsById.get(id);
  return quest
    ? link(anchor('quest', quest.id), quest.name)
    : `<span class="unresolved">${esc(id)}</span>`;
};

/**
 * A faction reference links only when the faction has a record of its own —
 * `Faction` and `factionNames[]` are free text, so a character can name one
 * that was never created.
 */
const factionRef = (name: string, lookups: Lookups): string =>
  lookups.factionNames.has(name)
    ? link(anchor('faction', name), name)
    : esc(name);

// --- Ruleset-driven rendering -----------------------------------------------

/** `+2` / `-1`, so a delta reads as a change rather than a value. */
const signed = (delta: number): string =>
  delta > 0 ? `+${delta}` : String(delta);

const formatModifier = (
  modifier: Modifier | undefined,
  ruleset: RulesetDefinition
): string => {
  const parts: string[] = [];

  Object.entries(modifier?.attributeDeltas ?? {}).forEach(([id, delta]) => {
    const label = ruleset.attributes.find(a => a.id === id)?.label ?? id;
    parts.push(`${label} ${signed(delta)}`);
  });
  Object.entries(modifier?.categoryDeltas ?? {}).forEach(
    ([collectionId, deltas]) => {
      const target = ruleset.facets.find(c => c.id === collectionId);
      Object.entries(deltas).forEach(([categoryId, delta]) => {
        const label =
          target?.categories?.find(c => c.id === categoryId)?.label ??
          categoryId;
        parts.push(`${label} ${signed(delta)}`);
      });
    }
  );

  return parts.join(', ');
};

/**
 * A character's attribute table, from computed stats rather than stored values.
 *
 * A `role: 'resource'` attribute is printed against its cap (`4 / 6`) and the
 * cap's own row suppressed — two rows for one pair reads as a bug. Non-numeric
 * attributes have no computed value and come from the resolved bag. One score
 * block per facet collection that declares `categories` — the generalized
 * form of the old single hardcoded trait-category scores block.
 */
const attributeRows = (
  character: GameCharacter,
  ruleset: RulesetDefinition
): string => {
  const derived = calculateDerivedStats(character, ruleset);

  const capIds = new Set(
    ruleset.attributes
      .filter(d => roleOf(d) === 'resource' && d.capAttributeId)
      .map(d => d.capAttributeId as string)
  );

  const valueOf = (definition: AttributeDefinition): string | undefined => {
    if (definition.type === 'number') {
      const value = derived.values[definition.id];
      if (value === undefined) {
        return undefined;
      }
      if (roleOf(definition) === 'resource' && definition.capAttributeId) {
        const cap = getNumber(derived.attributes, definition.capAttributeId, 0);
        return `${value} / ${cap}`;
      }
      return String(value);
    }

    const attribute = derived.attributes[definition.id];
    return attribute ? formatAttributeValue(attribute) : undefined;
  };

  const rows = ruleset.attributes
    .filter(definition => !capIds.has(definition.id))
    .map(definition => row(definition.label, esc(valueOf(definition) ?? '')));

  const scoreFields = ruleset.facets
    .filter(collection => (collection.categories?.length ?? 0) > 0)
    .map(collection => {
      const scores = derived.categoryScores[collection.id] ?? {};
      const scoreRows = (collection.categories ?? [])
        .map(category => {
          const score = scores[category.id];
          return score ? row(category.label, esc(String(score))) : '';
        })
        .filter(Boolean);
      return field(
        `${collection.categorySingular ?? 'Category'} Scores`,
        facts(scoreRows)
      );
    })
    .join('');

  return field('Attributes', facts(rows)) + scoreFields;
};

/**
 * A character's held entries in one facet collection, whether picked from a
 * catalog or (for an `authored` collection) written per character. The
 * generalized form of the old dedicated `traitList`/`qualityList`/
 * `modificationList`, now driven by however many collections the ruleset
 * declares rather than exactly those three.
 */
const facetList = (
  collection: FacetCollection,
  character: GameCharacter,
  ruleset: RulesetDefinition
): string => {
  const catalogItems = getFacetIds(character, collection.id).map(id => {
    const entry = collection.entries.find(e => e.id === id);
    if (!entry) {
      return `<span class="unresolved">${esc(id)}</span>`;
    }
    const category = collection.categories?.find(
      c => c.id === entry.categoryId
    );
    const modifier = formatModifier(entry.modifier, ruleset);
    const linked = Object.entries(entry.links ?? {})
      .map(([targetCollectionId, ids]) => {
        const target = ruleset.facets.find(c => c.id === targetCollectionId);
        if (!target) return '';
        const names = ids
          .map(linkedId => target.entries.find(e => e.id === linkedId)?.label)
          .filter((name): name is string => Boolean(name));
        return names.length
          ? `<br /><em>${esc(target.plural)}:</em> ${esc(names.join(', '))}`
          : '';
      })
      .join('');
    return [
      `<strong>${esc(entry.label)}</strong>`,
      category ? badge(category.label) : '',
      entry.description ? `<br />${prose(entry.description)}` : '',
      modifier ? `<br /><span class="delta">${esc(modifier)}</span>` : '',
      linked,
    ].join('');
  });

  const authoredItems = collection.authored
    ? getAuthoredFacets(character, collection.id).map(entry => {
        const modifier = formatModifier(entry.modifier, ruleset);
        return [
          `<strong>${esc(entry.name)}</strong>`,
          entry.description ? `<br />${prose(entry.description)}` : '',
          modifier ? `<br /><span class="delta">${esc(modifier)}</span>` : '',
        ].join('');
      })
    : [];

  return bullets([...catalogItems, ...authoredItems]);
};

const relationshipList = (
  relationships: Relationship[],
  lookups: Lookups,
  ruleset: RulesetDefinition
): string =>
  bullets(
    relationships.map(relationship => {
      const named = lookups.charactersByName.get(relationship.characterName);
      const who = named
        ? link(anchor('character', named.id), relationship.characterName)
        : esc(relationship.characterName);
      const entry = findRelationshipEntryForPair(
        ruleset,
        ['character', 'character'],
        relationship.relationshipTypeId
      );
      return [
        who,
        relationship.customName ? ` (${esc(relationship.customName)})` : '',
        entry ? ` — ${esc(relationshipLabel(entry))}` : '',
        relationship.description
          ? `<br />${prose(relationship.description)}`
          : '',
      ].join('');
    })
  );

// --- Entries ----------------------------------------------------------------

const characterEntry = (
  character: GameCharacter,
  ruleset: RulesetDefinition,
  lookups: Lookups,
  images: ResolvedImages
): string => {
  const appearsIn = lookups.eventsByCharacter.get(character.id) ?? [];
  const assigned = lookups.questsByCharacter.get(character.id) ?? [];
  const primaryCollection = ruleset.facets.find(c => c.selection === 'single');

  return `<div class="entry" id="${esc(anchor('character', character.id))}">
    <h2>${esc(character.name)}${character.retired ? badge('Retired') : ''}</h2>
    ${gallery(character, images, character.name)}
    ${facts([
      primaryCollection
        ? row(
            primaryCollection.singular,
            esc(getPrimaryFacetLabel(character, ruleset) ?? '')
          )
        : '',
      row('Occupation', character.occupation ? esc(character.occupation) : ''),
      row(
        'Location',
        character.locationId
          ? locationRef(character.locationId, lookups)
          : undefined
      ),
    ])}
    ${attributeRows(character, ruleset)}
    ${ruleset.facets
      .filter(
        collection =>
          collection.selection !== 'catalog' && collection !== primaryCollection
      )
      .map(collection =>
        field(collection.plural, facetList(collection, character, ruleset))
      )
      .join('')}
    ${field(
      'Factions',
      bullets(
        (character.factions ?? []).map(faction => {
          const entry = findRelationshipEntryForPair(
            ruleset,
            ['character', 'faction'],
            faction.relationshipTypeId
          );
          return `${factionRef(faction.name, lookups)}${
            entry ? ` — ${esc(relationshipLabel(entry))}` : ''
          }${faction.description ? `<br />${prose(faction.description)}` : ''}`;
        })
      )
    )}
    ${field(
      'Relationships',
      relationshipList(character.relationships ?? [], lookups, ruleset)
    )}
    ${field(
      'Appears In',
      bullets(appearsIn.map(event => eventRef(event.id, lookups)))
    )}
    ${
      ruleset.features.quests
        ? field(
            'Assigned',
            bullets(assigned.map(quest => questRef(quest.id, lookups)))
          )
        : ''
    }
    ${field('Notes', character.notes ? `<p>${prose(character.notes)}</p>` : '')}
    <p class="meta">Created ${esc(isoDate(character.createdAt))} · Updated ${esc(
      isoDate(character.updatedAt)
    )}</p>
  </div>`;
};

const factionEntry = (
  faction: StoredFaction,
  ruleset: RulesetDefinition,
  lookups: Lookups,
  images: ResolvedImages
): string => {
  const members = lookups.charactersByFaction.get(faction.name) ?? [];

  return `<div class="entry" id="${esc(anchor('faction', faction.name))}">
    <h2>${esc(faction.name)}${faction.retired ? badge('Retired') : ''}</h2>
    ${gallery(faction, images, faction.name)}
    ${faction.description ? `<p>${prose(faction.description)}</p>` : ''}
    ${field(
      'Standings',
      bullets(
        (faction.relationships ?? []).map(relationship => {
          const entry = findRelationshipEntryForPair(
            ruleset,
            ['faction', 'faction'],
            relationship.relationshipTypeId
          );
          return `${factionRef(relationship.factionName, lookups)}${
            entry
              ? ` — ${esc(relationshipLabel(entry, relationship.direction))}`
              : ''
          }${
            relationship.description
              ? `<br />${prose(relationship.description)}`
              : ''
          }`;
        })
      )
    )}
    ${field(
      'Members',
      bullets(
        members.map(member => {
          const membership = member.factions?.find(
            f => f.name === faction.name
          );
          const entry = membership
            ? findRelationshipEntryForPair(
                ruleset,
                ['character', 'faction'],
                membership.relationshipTypeId
              )
            : undefined;
          return `${link(anchor('character', member.id), member.name)}${
            entry ? ` — ${esc(relationshipLabel(entry))}` : ''
          }`;
        })
      )
    )}
    <p class="meta">Created ${esc(isoDate(faction.createdAt))} · Updated ${esc(
      isoDate(faction.updatedAt)
    )}</p>
  </div>`;
};

const locationEntry = (
  location: GameLocation,
  ruleset: RulesetDefinition,
  lookups: Lookups,
  images: ResolvedImages
): string => {
  const residents = lookups.charactersByLocation.get(location.id) ?? [];
  const heldThere = lookups.eventsByLocation.get(location.id) ?? [];
  const questsThere = lookups.questsByLocation.get(location.id) ?? [];

  return `<div class="entry" id="${esc(anchor('location', location.id))}">
    <h2>${esc(location.name)}</h2>
    ${gallery(location, images, location.name)}
    ${location.description ? `<p>${prose(location.description)}</p>` : ''}
    ${
      ruleset.features.map && location.mapPins && location.mapPins.length > 0
        ? field(
            `Marked on this ${getLabel(ruleset, 'map.label')}`,
            bullets(
              location.mapPins.map(pin => locationRef(pin.locationId, lookups))
            )
          )
        : ''
    }
    ${field(
      'Characters Here',
      bullets(
        residents.map(resident =>
          link(anchor('character', resident.id), resident.name)
        )
      )
    )}
    ${field('Events Here', bullets(heldThere.map(e => eventRef(e.id, lookups))))}
    ${
      ruleset.features.quests
        ? field(
            'Quests Here',
            bullets(questsThere.map(q => questRef(q.id, lookups)))
          )
        : ''
    }
    <p class="meta">Created ${esc(isoDate(location.createdAt))} · Updated ${esc(
      isoDate(location.updatedAt)
    )}</p>
  </div>`;
};

const eventEntry = (
  event: GameEvent,
  ruleset: RulesetDefinition,
  lookups: Lookups,
  images: ResolvedImages
): string =>
  `<div class="entry" id="${esc(anchor('event', event.id))}">
    <h2>${esc(event.title)}${
      event.certaintyLevel && event.certaintyLevel !== 'confirmed'
        ? badge(CERTAINTY_LABELS[event.certaintyLevel])
        : ''
    }</h2>
    ${gallery(event, images, event.title)}
    ${facts([
      row('Date', esc(eventDate(event.date, event.time) ?? '')),
      row(
        'Location',
        event.locationId ? locationRef(event.locationId, lookups) : undefined
      ),
      row(
        'Certainty',
        event.certaintyLevel ? esc(CERTAINTY_LABELS[event.certaintyLevel]) : ''
      ),
    ])}
    ${event.description ? `<p>${prose(event.description)}</p>` : ''}
    ${field(
      'Characters',
      bullets((event.characterIds ?? []).map(id => characterRef(id, lookups)))
    )}
    ${field(
      'Factions',
      bullets((event.factionNames ?? []).map(name => factionRef(name, lookups)))
    )}
    ${
      ruleset.features.quests
        ? field(
            'Quests',
            bullets((event.questIds ?? []).map(id => questRef(id, lookups)))
          )
        : ''
    }
    ${field('Notes', event.notes ? `<p>${prose(event.notes)}</p>` : '')}
    <p class="meta">Created ${esc(isoDate(event.createdAt))} · Updated ${esc(
      isoDate(event.updatedAt)
    )}</p>
  </div>`;

/**
 * The desirable/undesirable facet preferences on a quest, resolved to
 * labels. Two maps — entries and categories — each keyed by collection id,
 * the generalized form of the old four parallel id lists.
 */
const preferenceList = (
  preferences: GameQuest['desirable'],
  ruleset: RulesetDefinition
): string => {
  if (!preferences) {
    return '';
  }

  const entryNames = Object.entries(preferences.entries ?? {}).flatMap(
    ([collectionId, ids]) => {
      const collection = ruleset.facets.find(c => c.id === collectionId);
      return ids.map(
        id => collection?.entries.find(e => e.id === id)?.label ?? id
      );
    }
  );

  const categoryNames = Object.entries(preferences.categories ?? {}).flatMap(
    ([collectionId, ids]) => {
      const collection = ruleset.facets.find(c => c.id === collectionId);
      return ids.map(
        id => collection?.categories?.find(c => c.id === id)?.label ?? id
      );
    }
  );

  const named = [...entryNames, ...categoryNames];

  return named.length ? esc(named.join(', ')) : '';
};

const questEntry = (
  quest: GameQuest,
  ruleset: RulesetDefinition,
  lookups: Lookups,
  images: ResolvedImages
): string =>
  `<div class="entry" id="${esc(anchor('quest', quest.id))}">
    <h2>${esc(quest.name)}${badge(QUEST_STATUS_LABELS[quest.status] ?? quest.status)}</h2>
    ${gallery(quest, images, quest.name)}
    ${facts([
      row('Status', esc(QUEST_STATUS_LABELS[quest.status] ?? quest.status)),
      row('Date', esc(eventDate(quest.date, quest.time) ?? '')),
      row(
        getLabel(ruleset, 'questSponsor.singular'),
        quest.sponsor ? esc(quest.sponsor) : ''
      ),
      row(
        'Location',
        quest.locationId ? locationRef(quest.locationId, lookups) : undefined
      ),
      row(
        'Team Size',
        quest.teamSize === undefined ? '' : esc(String(quest.teamSize))
      ),
      row('Desirable', preferenceList(quest.desirable, ruleset)),
      row('Undesirable', preferenceList(quest.undesirable, ruleset)),
    ])}
    ${quest.details ? `<p>${prose(quest.details)}</p>` : ''}
    ${field(
      'Assigned',
      bullets(
        (quest.assignedCharacterIds ?? []).map(id => characterRef(id, lookups))
      )
    )}
    ${field(
      'Factions',
      bullets((quest.factionNames ?? []).map(name => factionRef(name, lookups)))
    )}
    ${field(
      'Events',
      bullets((quest.eventIds ?? []).map(id => eventRef(id, lookups)))
    )}
    ${field(
      `Required ${getLabel(ruleset, 'resource.plural')}`,
      bullets(
        (quest.requiredMaterials ?? []).map(
          material =>
            `${esc(material.name)} — ${esc(
              `${material.quantityProvided} / ${material.quantityRequired}`
            )}`
        )
      )
    )}
    ${field('Notes', quest.notes ? `<p>${prose(quest.notes)}</p>` : '')}
    <p class="meta">Created ${esc(isoDate(quest.createdAt))} · Updated ${esc(
      isoDate(quest.updatedAt)
    )}</p>
  </div>`;

/**
 * One Discord message.
 *
 * The author is resolved through as many hops as the data allows — the mapped
 * character, then the user mapping, then the name parsed out of the message —
 * before falling back to the Discord username, because a campaign log reads as
 * a story only when the speakers are the characters.
 */
const messageEntry = (
  message: DiscordMessage,
  lookups: Lookups,
  images: ResolvedImages
): string => {
  const characterId =
    message.characterId ??
    lookups.characterIdByDiscordUser.get(message.authorId);
  const character = characterId
    ? lookups.charactersById.get(characterId)
    : undefined;

  const who = character
    ? link(anchor('character', character.id), character.name)
    : esc(message.extractedCharacterName ?? message.authorUsername);

  return `<div class="message">
    <span class="who">${who}</span>
    <span class="when">${esc(isoDate(message.timestamp, true))}</span>
    ${message.content ? `<p>${prose(message.content)}</p>` : ''}
    ${gallery(message, images, message.authorUsername)}
  </div>`;
};

// --- Chapters ---------------------------------------------------------------

interface Chapter {
  id: string;
  /** Heading and contents label. Plural, since a chapter holds a collection. */
  title: string;
  /**
   * The same noun for a count of one, so the cover reads "1 Faction" rather
   * than "1 Factions". Only the cover needs it; headings are always plural.
   */
  singular: string;
  /** Table-of-contents entries: anchor id and display text. */
  entries: { anchorId: string; text: string }[];
  body: string;
}

/** `2 Characters`, `1 Faction`. */
const countLabel = (chapter: Chapter): string =>
  `${chapter.entries.length} ${
    chapter.entries.length === 1 ? chapter.singular : chapter.title
  }`;

const chapterHtml = (chapter: Chapter): string =>
  `<section class="chapter" id="${esc(chapter.id)}">
    <h1 class="chapter-title">${esc(chapter.title)}</h1>
    ${chapter.body || '<p class="empty">Nothing recorded.</p>'}
  </section>`;

const tocHtml = (chapters: Chapter[]): string =>
  `<nav class="toc">
    <h1 class="chapter-title">Contents</h1>
    ${chapters
      .map(
        chapter => `<h2>${link(chapter.id, chapter.title)} <span class="count">${
          chapter.entries.length
        }</span></h2>
        ${
          chapter.entries.length
            ? `<ul class="entries">${chapter.entries
                .map(entry => `<li>${link(entry.anchorId, entry.text)}</li>`)
                .join('')}</ul>`
            : ''
        }`
      )
      .join('')}
  </nav>`;

const coverHtml = (
  dataset: CampaignDataset,
  ruleset: RulesetDefinition,
  chapters: Chapter[],
  generatedAt: Date
): string =>
  `<section class="cover">
    <h1>${esc(ruleset.branding.appName)}</h1>
    <p class="subtitle">Campaign Wiki</p>
    <p class="subtitle">${esc(ruleset.name)} · v${esc(ruleset.version)}</p>
    <p class="counts">${chapters
      .map(chapter => esc(countLabel(chapter)))
      .join(' · ')}</p>
    <p class="counts">Exported ${esc(
      generatedAt.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    )}${dataset.lastUpdated ? ` · Data as of ${esc(isoDate(dataset.lastUpdated))}` : ''}</p>
  </section>`;

/**
 * Print CSS, inline because the document is a single self-contained string.
 *
 * `page-break-before` on a chapter and `page-break-inside: avoid` on an entry
 * are the two rules that make this a document rather than a scroll: each
 * collection starts on a fresh page and no character is split across two.
 * Images are bounded in both dimensions so a portrait photograph cannot claim
 * a page to itself.
 */
const STYLES = `
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1c1c1e;
  }
  a { color: inherit; text-decoration: none; }
  h1, h2, h3 { margin: 0; }
  p { margin: 0 0 4pt; }
  .cover { text-align: center; padding-top: 30%; page-break-after: always; }
  .cover h1 { font-size: 30pt; margin-bottom: 6pt; }
  .cover .subtitle { font-size: 13pt; color: #555; }
  .counts { margin-top: 18pt; font-size: 9pt; color: #777; }
  .toc { page-break-after: always; }
  .toc h2 { font-size: 12pt; margin: 10pt 0 2pt; }
  .toc .count { font-size: 9pt; color: #999; font-weight: 400; }
  .toc ul.entries { margin: 0 0 0 12pt; padding: 0; list-style: none; font-size: 10pt; color: #444; }
  .chapter { page-break-before: always; }
  .chapter-title {
    font-size: 20pt;
    border-bottom: 2px solid #1c1c1e;
    padding-bottom: 4pt;
    margin-bottom: 12pt;
  }
  .entry {
    page-break-inside: avoid;
    margin-bottom: 14pt;
    padding-bottom: 10pt;
    border-bottom: 1px solid #e0e0e0;
  }
  .entry h2 { font-size: 14pt; margin-bottom: 4pt; }
  .badge {
    display: inline-block;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: #eee;
    color: #555;
    border-radius: 3pt;
    padding: 1pt 4pt;
    margin-left: 5pt;
    vertical-align: middle;
  }
  .gallery { margin: 6pt 0; }
  .gallery img {
    max-width: 46%;
    max-height: 70mm;
    margin: 0 6pt 6pt 0;
    border: 1px solid #ddd;
    border-radius: 3pt;
    vertical-align: top;
  }
  .omitted {
    display: inline-block;
    font-size: 8pt;
    font-style: italic;
    color: #999;
    border: 1px dashed #ccc;
    border-radius: 3pt;
    padding: 4pt 6pt;
    margin: 0 6pt 6pt 0;
  }
  table.facts { border-collapse: collapse; width: 100%; margin: 4pt 0; }
  table.facts th {
    width: 30%;
    text-align: left;
    vertical-align: top;
    font-size: 9.5pt;
    font-weight: 600;
    color: #666;
    padding: 1.5pt 6pt 1.5pt 0;
  }
  table.facts td { vertical-align: top; padding: 1.5pt 0; }
  .field { margin-top: 6pt; }
  .field h3 {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
    margin-bottom: 2pt;
  }
  ul.plain { margin: 0; padding-left: 14pt; }
  ul.plain li { margin-bottom: 3pt; }
  .delta { font-size: 9pt; color: #777; }
  .unresolved { color: #999; font-style: italic; }
  .when { font-size: 8.5pt; color: #999; }
  .meta { font-size: 8pt; color: #aaa; margin-top: 4pt; }
  .empty { color: #999; font-style: italic; }
  .message { page-break-inside: avoid; margin-bottom: 8pt; }
  .message .who { font-weight: 600; }
  .channel { font-size: 12pt; margin: 12pt 0 4pt; color: #444; }
`;

/**
 * Render the whole campaign as one self-contained printable document.
 *
 * `generatedAt` is a parameter so the output is deterministic under test; the
 * store never passes it.
 */
export const renderCampaignHtml = (
  dataset: CampaignDataset,
  ruleset: RulesetDefinition,
  images: ResolvedImages,
  generatedAt: Date = new Date()
): string => {
  const lookups = buildLookups(dataset);
  const chapters: Chapter[] = [];

  const characters = dataset.characters ?? [];
  chapters.push({
    id: 'chapter-characters',
    title: 'Characters',
    singular: 'Character',
    entries: characters.map(character => ({
      anchorId: anchor('character', character.id),
      text: character.name,
    })),
    body: characters
      .map(character => characterEntry(character, ruleset, lookups, images))
      .join(''),
  });

  const factions = dataset.factions ?? [];
  chapters.push({
    id: 'chapter-factions',
    title: 'Factions',
    singular: 'Faction',
    entries: factions.map(faction => ({
      anchorId: anchor('faction', faction.name),
      text: faction.name,
    })),
    body: factions
      .map(faction => factionEntry(faction, ruleset, lookups, images))
      .join(''),
  });

  const locations = dataset.locations ?? [];
  chapters.push({
    id: 'chapter-locations',
    title: 'Locations',
    singular: 'Location',
    entries: locations.map(location => ({
      anchorId: anchor('location', location.id),
      text: location.name,
    })),
    body: locations
      .map(location => locationEntry(location, ruleset, lookups, images))
      .join(''),
  });

  const events = dataset.events ?? [];
  chapters.push({
    id: 'chapter-events',
    title: 'Events',
    singular: 'Event',
    entries: events.map(event => ({
      anchorId: anchor('event', event.id),
      text: event.title,
    })),
    body: events
      .map(event => eventEntry(event, ruleset, lookups, images))
      .join(''),
  });

  // Feature-gated chapters. A build with quests turned off has no quest screen
  // either, so a Quests chapter would document something the reader cannot see.
  if (ruleset.features.quests) {
    const quests = dataset.quests ?? [];
    chapters.push({
      id: 'chapter-quests',
      title: 'Quests',
      singular: 'Quest',
      entries: quests.map(quest => ({
        anchorId: anchor('quest', quest.id),
        text: quest.name,
      })),
      body: quests
        .map(quest => questEntry(quest, ruleset, lookups, images))
        .join(''),
    });
  }

  if (ruleset.features.discord) {
    // Messages only. Nothing here reads `discord.config` or `serverConfigs` —
    // those hold bot tokens, and a document made to be shared must not carry a
    // credential. `ignored` messages were marked as not belonging to any
    // character, so they are noise in a campaign log.
    const messages = (dataset.discord?.messages ?? []).filter(m => !m.ignored);
    const channelNames = new Map(
      (dataset.discord?.serverConfigs ?? []).map(config => [
        config.id,
        config.name,
      ])
    );

    const byChannel = new Map<string, DiscordMessage[]>();
    messages.forEach(message => {
      const name =
        (message.serverConfigId && channelNames.get(message.serverConfigId)) ||
        message.channelId;
      push(byChannel, name, message);
    });

    chapters.push({
      id: 'chapter-discord',
      title: 'Discord Log',
      singular: 'Discord Channel',
      entries: [...byChannel.keys()].map(name => ({
        anchorId: anchor('channel', name),
        text: name,
      })),
      body: [...byChannel.entries()]
        .map(
          ([name, channelMessages]) =>
            `<h2 class="channel" id="${esc(anchor('channel', name))}">${esc(
              name
            )}</h2>${channelMessages
              .map(message => messageEntry(message, lookups, images))
              .join('')}`
        )
        .join(''),
    });
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(ruleset.branding.appName)} — Campaign Wiki</title>
<style>${STYLES}</style>
</head>
<body>
${coverHtml(dataset, ruleset, chapters, generatedAt)}
${tocHtml(chapters)}
${chapters.map(chapterHtml).join('\n')}
</body>
</html>`;
};
