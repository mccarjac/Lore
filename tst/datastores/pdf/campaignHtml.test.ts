/**
 * The PDF store's renderer, tested as what it is: a pure function from a
 * dataset to a string. No Expo module is mocked here because none is reached —
 * that property is why `campaignHtml.ts` is a separate module from `index.ts`.
 */

import { renderCampaignHtml } from '@/datastores/pdf/campaignHtml';
import type { CampaignDataset, ResolvedImages } from '@/datastores/pdf/dataset';
import { QuestStatus, RelationshipStanding } from '@models/types';
import { num } from '@/ruleset/attributes';
import type { RulesetDefinition } from '@/ruleset/types';
import { genericRuleset } from '../../fixtures/genericRuleset';
import {
  makeCharacter,
  makeDiscordMessage,
  makeDiscordServerConfig,
  makeEvent,
  makeLocation,
  makeQuest,
  makeStoredFaction,
} from '../../helpers/factories';

/**
 * `genericRuleset` has quests, discord and the map switched off — useful for
 * the gating tests, useless for rendering those chapters. This turns them on
 * while keeping the fixture's deliberately non-default terminology (Lineage,
 * Talent, Discipline, Virtue, Augment), which is what proves the renderer asks
 * the ruleset for its nouns.
 */
const fullRuleset: RulesetDefinition = {
  ...genericRuleset,
  features: {
    ...genericRuleset.features,
    quests: true,
    discord: true,
    map: true,
  },
};

const GENERATED_AT = new Date('2026-03-14T15:09:00.000Z');
const NO_IMAGES: ResolvedImages = new Map();

const render = (
  dataset: CampaignDataset,
  ruleset: RulesetDefinition = fullRuleset,
  images: ResolvedImages = NO_IMAGES
): string => renderCampaignHtml(dataset, ruleset, images, GENERATED_AT);

/** A campaign where every collection is populated and cross-referenced. */
const fullDataset = (): CampaignDataset => ({
  characters: [
    makeCharacter({
      id: 'char-hale',
      name: 'Hale Winters',
      facets: {
        lineages: ['wanderer'],
        talents: ['well_read', 'no_such_trait'],
        virtues: ['patient'],
        augments: [
          {
            name: 'Grafted Lens',
            description: 'Sees in the dark.',
            modifier: { attributeDeltas: { focus: 2 } },
          },
        ],
      },
      attributes: { vigor: num(5) },
      locationId: 'loc-vault',
      occupation: 'Courier',
      notes: 'Owes a debt.\nSecond line.',
      present: true,
      factions: [
        {
          name: 'The Combine',
          standing: RelationshipStanding.Ally,
          description: 'Dues paid.',
        },
      ],
      relationships: [
        {
          characterName: 'Mara Voss',
          relationshipType: RelationshipStanding.Hostile,
          description: 'A bad trade.',
        },
      ],
    }),
    makeCharacter({
      id: 'char-mara',
      name: 'Mara Voss',
      facets: { lineages: ['scholar'] },
    }),
  ],
  factions: [
    makeStoredFaction({
      name: 'The Combine',
      description: 'Runs the water.',
      relationships: [
        {
          factionName: 'The Ash Union',
          relationshipType: RelationshipStanding.Enemy,
        },
      ],
    }),
  ],
  locations: [
    makeLocation({
      id: 'loc-vault',
      name: 'The Vault',
      description: 'Sealed since the fall.',
      mapCoordinates: { x: 0.25, y: 0.75 },
    }),
  ],
  events: [
    makeEvent({
      id: 'evt-flood',
      title: 'The Flood',
      date: '2026-05-02',
      time: '18:30',
      locationId: 'loc-vault',
      characterIds: ['char-hale'],
      factionNames: ['The Combine'],
      questIds: ['qst-water'],
      certaintyLevel: 'disputed',
      notes: 'Nobody agrees on the cause.',
    }),
  ],
  quests: [
    makeQuest({
      id: 'qst-water',
      name: 'Restore the Water',
      status: QuestStatus.InProgress,
      sponsor: 'Warden Ilse',
      locationId: 'loc-vault',
      assignedCharacterIds: ['char-hale'],
      eventIds: ['evt-flood'],
      teamSize: 3,
      desirable: {
        entries: { lineages: ['wanderer'], talents: ['well_read'] },
      },
      requiredMaterials: [
        {
          id: 'mat-1',
          name: 'Sealant',
          quantityRequired: 4,
          quantityProvided: 1,
        },
      ],
    }),
  ],
  discord: {
    config: { enabled: true, autoSync: false, serverConfigs: [] },
    serverConfigs: [
      makeDiscordServerConfig({
        id: 'cfg-1',
        name: 'Table Talk',
        botToken: 'super-secret-bot-token',
      }),
    ],
    userMappings: [
      {
        discordUserId: 'author-mara',
        discordUsername: 'maravoss',
        characterId: 'char-mara',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    messages: [
      makeDiscordMessage({
        id: 'msg-1',
        serverConfigId: 'cfg-1',
        characterId: 'char-hale',
        content: 'The seal is cracked.',
      }),
      makeDiscordMessage({
        id: 'msg-2',
        serverConfigId: 'cfg-1',
        authorId: 'author-mara',
        content: 'Then we lose the vault.',
      }),
      makeDiscordMessage({
        id: 'msg-3',
        serverConfigId: 'cfg-1',
        content: 'bot spam',
        ignored: true,
      }),
    ],
    characterAliases: [],
    version: '1.0',
    lastUpdated: '2026-03-01T00:00:00.000Z',
  },
});

describe('renderCampaignHtml', () => {
  describe('document shell', () => {
    it('produces a self-contained document with inline styles', () => {
      const html = render(fullDataset());

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<style>');
      // Nothing may be fetched: the print engine snapshots the string as-is.
      expect(html).not.toMatch(/<link[^>]+href=/);
      expect(html).not.toContain('<script');
    });

    it('names the ruleset on the cover', () => {
      const html = render(fullDataset());

      expect(html).toContain('Fixture'); // branding.appName
      expect(html).toContain('Fixture Ruleset'); // ruleset.name
      expect(html).toContain('v1.0.0');
    });

    it('lists every chapter and its count in the contents', () => {
      const html = render(fullDataset());

      ['Characters', 'Factions', 'Locations', 'Events', 'Quests'].forEach(
        title => expect(html).toContain(title)
      );
      expect(html).toContain('href="#chapter-characters"');
      expect(html).toContain('href="#chapter-discord"');
    });

    it('is deterministic for the same data', () => {
      const dataset = fullDataset();

      expect(render(dataset)).toBe(render(fullDataset()));
    });

    it('renders a document for an empty campaign rather than throwing', () => {
      const html = render({});

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Nothing recorded.');
    });

    it('renders a document when a dataset is missing collections entirely', () => {
      // A hand-edited or older export. Every collection is optional for this
      // reason, and a missing one must be an empty chapter.
      const html = render({ characters: [makeCharacter()] });

      expect(html).toContain('Test Character');
      expect(html).toContain('Nothing recorded.');
    });
  });

  describe('escaping', () => {
    it('escapes markup in an authored name', () => {
      const html = render({
        characters: [makeCharacter({ name: '<script>alert(1)</script>' })],
      });

      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>alert(1)');
    });

    it('escapes markup in notes and descriptions', () => {
      const html = render({
        characters: [
          makeCharacter({ notes: 'Ampersand & "quoted" <b>bold</b>' }),
        ],
      });

      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;quoted&quot;');
      expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    });

    it('keeps authored line breaks in prose', () => {
      const html = render({
        characters: [makeCharacter({ notes: 'First line\nSecond line' })],
      });

      expect(html).toContain('First line<br />Second line');
    });
  });

  describe('terminology', () => {
    it('takes every domain noun from the ruleset', () => {
      const html = render(fullDataset());

      expect(html).toContain('Lineage'); // lineages.singular
      expect(html).toContain('Talents'); // talents.plural
      expect(html).toContain('Virtues'); // virtues.plural
      expect(html).toContain('Augments'); // augments.plural
      expect(html).toContain('Discipline Scores'); // talents.categorySingular

      // The generic engine defaults must not leak through.
      expect(html).not.toContain('Archetype');
      expect(html).not.toContain('>Traits<');
    });

    it('names the sponsor field with the ruleset term', () => {
      const withSponsor: RulesetDefinition = {
        ...fullRuleset,
        terminology: {
          ...fullRuleset.terminology,
          'questSponsor.singular': 'Patron',
        },
      };

      expect(render(fullDataset(), withSponsor)).toContain('Patron');
    });
  });

  describe('character entries', () => {
    it('renders computed attributes against their caps', () => {
      const html = render(fullDataset());

      // vigor is a character override of 5 against the wanderer's cap of 8.
      expect(html).toContain('5 / 8');
      // The cap has its own definition, but a row of its own would be a
      // duplicate of the pair above.
      expect(html).not.toContain('Vigor Cap');
    });

    it('renders a talent with its category and its modifier', () => {
      const html = render(fullDataset());

      expect(html).toContain('Well Read');
      expect(html).toContain('Knows the old books.');
      expect(html).toContain('Lore'); // the talent's category
      expect(html).toContain('Focus +1');
    });

    it('prints an id the ruleset does not define rather than dropping it', () => {
      const html = render(fullDataset());

      expect(html).toContain('no_such_trait');
      expect(html).toContain('class="unresolved"');
    });

    it('renders an authored augment with its deltas', () => {
      const html = render(fullDataset());

      expect(html).toContain('Grafted Lens');
      expect(html).toContain('Focus +2');
    });

    it('omits a collection entirely when the ruleset does not declare it', () => {
      const noAugments: RulesetDefinition = {
        ...fullRuleset,
        facets: fullRuleset.facets.filter(c => c.id !== 'augments'),
      };

      expect(render(fullDataset(), noAugments)).not.toContain('Grafted Lens');
    });

    it('marks a retired and a present character', () => {
      const html = render({
        characters: [
          makeCharacter({ id: 'a', name: 'Gone', retired: true }),
          makeCharacter({ id: 'b', name: 'Here', present: true }),
        ],
      });

      expect(html).toContain('Retired');
      expect(html).toContain('Present');
    });
  });

  describe('cross-references', () => {
    it('renders a location reference as the location name, never the id', () => {
      const html = render(fullDataset());

      expect(html).toContain('href="#location-loc_vault"');
      expect(html).toContain('The Vault');
      // The raw id must not be printed as if it were a name.
      expect(html).not.toContain('>loc-vault<');
    });

    it('links a relationship to the named character', () => {
      const html = render(fullDataset());

      expect(html).toContain('href="#character-char_mara"');
      expect(html).toContain('Hostile');
      expect(html).toContain('A bad trade.');
    });

    it('lists a location’s residents, events and quests', () => {
      const html = render(fullDataset());
      const chapter = html.slice(html.indexOf('id="chapter-locations"'));

      expect(chapter).toContain('Characters Here');
      expect(chapter).toContain('Hale Winters');
      expect(chapter).toContain('Events Here');
      expect(chapter).toContain('The Flood');
      expect(chapter).toContain('Quests Here');
      expect(chapter).toContain('Restore the Water');
    });

    it('lists a faction’s members with the standing they hold', () => {
      const html = render(fullDataset());
      const chapter = html.slice(
        html.indexOf('id="chapter-factions"'),
        html.indexOf('id="chapter-locations"')
      );

      expect(chapter).toContain('Members');
      expect(chapter).toContain('Hale Winters');
      expect(chapter).toContain('Ally');
    });

    it('lists the events and quests a character took part in', () => {
      const html = render(fullDataset());
      const chapter = html.slice(
        html.indexOf('id="chapter-characters"'),
        html.indexOf('id="chapter-factions"')
      );

      expect(chapter).toContain('Appears In');
      expect(chapter).toContain('The Flood');
      expect(chapter).toContain('Assigned');
      expect(chapter).toContain('Restore the Water');
    });

    it('prints a faction name that has no record of its own, without a link', () => {
      const html = render(fullDataset());

      // 'The Ash Union' is named by a standing but was never created.
      expect(html).toContain('The Ash Union');
      expect(html).not.toContain('href="#faction-The_Ash_Union"');
    });
  });

  describe('events and quests', () => {
    it('formats a date through the shared date utility', () => {
      const html = render(fullDataset());

      expect(html).toContain('May 2, 2026');
      expect(html).toContain('18:30');
    });

    it('prints a malformed date verbatim rather than failing the export', () => {
      const html = render({
        events: [makeEvent({ date: 'not-a-date' })],
      });

      expect(html).toContain('not-a-date');
    });

    it('renders a quest status as a label, not its stored token', () => {
      const html = render(fullDataset());

      expect(html).toContain('In Progress');
      expect(html).not.toContain('INPROGRESS');
    });

    it('renders required materials as provided over required', () => {
      expect(render(fullDataset())).toContain('1 / 4');
    });

    it('resolves quest attribute preferences to labels', () => {
      const html = render(fullDataset());

      expect(html).toContain('Wanderer, Well Read');
    });

    it('marks a disputed event', () => {
      expect(render(fullDataset())).toContain('Disputed');
    });
  });

  describe('feature gating', () => {
    it('omits the quests chapter when the ruleset disables quests', () => {
      const html = render(fullDataset(), genericRuleset);

      expect(html).not.toContain('id="chapter-quests"');
      expect(html).not.toContain('Restore the Water');
    });

    it('omits the discord chapter when the ruleset disables discord', () => {
      const html = render(fullDataset(), genericRuleset);

      expect(html).not.toContain('id="chapter-discord"');
      expect(html).not.toContain('The seal is cracked.');
    });

    it('omits map coordinates when the ruleset has no map', () => {
      const html = render(fullDataset(), genericRuleset);

      expect(html).not.toContain('0.250');
    });

    it('renders map coordinates under the ruleset map label', () => {
      const html = render(fullDataset());

      expect(html).toContain('Realm Map Position');
      expect(html).toContain('0.250, 0.750');
    });
  });

  describe('discord log', () => {
    it('groups messages under the channel name, not its id', () => {
      const html = render(fullDataset());

      expect(html).toContain('Table Talk');
      expect(html).toContain('The seal is cracked.');
    });

    it('attributes a message to the mapped character', () => {
      const html = render(fullDataset());
      const chapter = html.slice(html.indexOf('id="chapter-discord"'));

      // msg-1 carries characterId directly; msg-2 resolves through the user
      // mapping. Neither should print a Discord username.
      expect(chapter).toContain('Hale Winters');
      expect(chapter).toContain('Mara Voss');
      expect(chapter).not.toContain('TestUser');
    });

    it('skips messages marked as belonging to no character', () => {
      expect(render(fullDataset())).not.toContain('bot spam');
    });

    it('never puts a bot token in the document', () => {
      const html = render(fullDataset());

      // The single most important assertion here: this document is made to be
      // shared, and the dataset it is built from holds credentials.
      expect(html).not.toContain('super-secret-bot-token');
      expect(html).not.toContain('botToken');
    });
  });

  describe('images', () => {
    it('embeds a resolved image inline', () => {
      const images: ResolvedImages = new Map([
        ['file://photo.jpg', 'data:image/jpeg;base64,AAAA'],
      ]);
      const html = render(
        { characters: [makeCharacter({ imageUris: ['file://photo.jpg'] })] },
        fullRuleset,
        images
      );

      expect(html).toContain('<img src="data:image/jpeg;base64,AAAA"');
    });

    it('prints a visible note for an image that could not be embedded', () => {
      const html = render({
        characters: [makeCharacter({ imageUris: ['file://missing.jpg'] })],
      });

      expect(html).toContain('Image omitted');
      expect(html).not.toContain('<img');
    });

    it('renders a legacy single imageUri', () => {
      const images: ResolvedImages = new Map([
        ['file://old.jpg', 'data:image/jpeg;base64,BBBB'],
      ]);
      const html = render(
        {
          // Predates the imageUris migration; still on disk for older installs.
          characters: [
            { ...makeCharacter(), imageUri: 'file://old.jpg' } as never,
          ],
        },
        fullRuleset,
        images
      );

      expect(html).toContain('data:image/jpeg;base64,BBBB');
    });

    it('embeds images for every collection that carries them', () => {
      const images: ResolvedImages = new Map([
        ['file://c.jpg', 'data:image/png;base64,C'],
        ['file://f.jpg', 'data:image/png;base64,F'],
        ['file://l.jpg', 'data:image/png;base64,L'],
        ['file://e.jpg', 'data:image/png;base64,E'],
        ['file://q.jpg', 'data:image/png;base64,Q'],
        ['file://m.jpg', 'data:image/png;base64,M'],
      ]);
      const html = render(
        {
          characters: [makeCharacter({ imageUris: ['file://c.jpg'] })],
          factions: [makeStoredFaction({ imageUris: ['file://f.jpg'] })],
          locations: [makeLocation({ imageUris: ['file://l.jpg'] })],
          events: [makeEvent({ imageUris: ['file://e.jpg'] })],
          // Quests carry images too, even though the .zip export drops them.
          quests: [makeQuest({ imageUris: ['file://q.jpg'] })],
          discord: {
            config: { enabled: true, autoSync: false, serverConfigs: [] },
            userMappings: [],
            messages: [makeDiscordMessage({ imageUris: ['file://m.jpg'] })],
            characterAliases: [],
            version: '1.0',
            lastUpdated: '',
          },
        },
        fullRuleset,
        images
      );

      ['C', 'F', 'L', 'E', 'Q', 'M'].forEach(marker =>
        expect(html).toContain(`data:image/png;base64,${marker}"`)
      );
    });
  });
});
