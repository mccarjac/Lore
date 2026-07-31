import {
  scoreCharacterForQuest as scoreCharacterForQuestWith,
  getProposalTargetQuests,
  getAvailableCharacters,
  generateQuestProposals as generateQuestProposalsWith,
  DEFAULT_TEAM_SIZE,
} from '@/utils/questProposal';
import { GameCharacter, GameQuest, QuestStatus } from '@/models/types';
import { mechanicsRuleset } from '../fixtures/mechanicsRuleset';

/**
 * Scoring resolves facet categories through the ruleset, so it runs against
 * the neutral fixture — the weights being tested are engine behavior, not
 * anything Afterworlds-specific.
 */
const scoreCharacterForQuest = (character: GameCharacter, quest: GameQuest) =>
  scoreCharacterForQuestWith(character, quest, mechanicsRuleset);

const generateQuestProposals = (
  quests: GameQuest[],
  characters: GameCharacter[]
) => generateQuestProposalsWith(quests, characters, mechanicsRuleset);

const mockDate = '2025-01-01T00:00:00.000Z';

const makeCharacter = (
  id: string,
  overrides: Partial<GameCharacter> = {}
): GameCharacter => ({
  id,
  name: `Character ${id}`,
  facets: { callings: ['tinker'], knacks: [], temperaments: [] },
  factions: [],
  relationships: [],
  present: true,
  retired: false,
  createdAt: mockDate,
  updatedAt: mockDate,
  ...overrides,
});

const makeQuest = (
  id: string,
  overrides: Partial<GameQuest> = {}
): GameQuest => ({
  id,
  name: `Quest ${id}`,
  status: QuestStatus.NotStarted,
  createdAt: mockDate,
  updatedAt: mockDate,
  ...overrides,
});

describe('questProposal', () => {
  describe('scoreCharacterForQuest', () => {
    it('scores 0 when the quest has no preferences', () => {
      const character = makeCharacter('a', {
        facets: { callings: ['tinker'], knacks: ['hammer_hand'] },
      });
      const quest = makeQuest('q1');

      expect(scoreCharacterForQuest(character, quest)).toBe(0);
    });

    it('rewards a desirable category proportional to the category score', () => {
      const character = makeCharacter('a', {
        facets: {
          callings: ['tinker'],
          knacks: ['hammer_hand', 'kin_secret'],
        },
      });
      const quest = makeQuest('q1', {
        desirable: { categories: { knacks: ['forge'] } },
      });

      // 2 forge knacks => categoryScore(knacks, forge) === 2, weight 1 each.
      expect(scoreCharacterForQuest(character, quest)).toBe(2);
    });

    it('penalizes an undesirable category proportional to the category score', () => {
      const character = makeCharacter('a', {
        facets: { callings: ['tinker'], knacks: ['hammer_hand'] },
      });
      const quest = makeQuest('q1', {
        undesirable: { categories: { knacks: ['forge'] } },
      });

      expect(scoreCharacterForQuest(character, quest)).toBe(-1);
    });

    it('rewards a desirable calling match', () => {
      const character = makeCharacter('a', {
        facets: { callings: ['revenant'] },
      });
      const quest = makeQuest('q1', {
        desirable: { entries: { callings: ['revenant'] } },
      });

      expect(scoreCharacterForQuest(character, quest)).toBeGreaterThan(0);
    });

    it('penalizes an undesirable calling match', () => {
      const character = makeCharacter('a', {
        facets: { callings: ['revenant'] },
      });
      const quest = makeQuest('q1', {
        undesirable: { entries: { callings: ['revenant'] } },
      });

      expect(scoreCharacterForQuest(character, quest)).toBeLessThan(0);
    });

    it('rewards a desirable knack match', () => {
      const character = makeCharacter('a', {
        facets: { callings: ['tinker'], knacks: ['hammer_hand'] },
      });
      const quest = makeQuest('q1', {
        desirable: { entries: { knacks: ['hammer_hand'] } },
      });

      expect(scoreCharacterForQuest(character, quest)).toBeGreaterThan(0);
    });

    it('penalizes an undesirable knack match', () => {
      const character = makeCharacter('a', {
        facets: { callings: ['tinker'], knacks: ['hammer_hand'] },
      });
      const quest = makeQuest('q1', {
        undesirable: { entries: { knacks: ['hammer_hand'] } },
      });

      expect(scoreCharacterForQuest(character, quest)).toBeLessThan(0);
    });

    it('rewards a desirable temperament match', () => {
      const character = makeCharacter('a', {
        facets: { callings: ['tinker'], temperaments: ['d1'] },
      });
      const quest = makeQuest('q1', {
        desirable: { entries: { temperaments: ['d1'] } },
      });

      expect(scoreCharacterForQuest(character, quest)).toBeGreaterThan(0);
    });

    it('penalizes an undesirable temperament match', () => {
      const character = makeCharacter('a', {
        facets: { callings: ['tinker'], temperaments: ['d1'] },
      });
      const quest = makeQuest('q1', {
        undesirable: { entries: { temperaments: ['d1'] } },
      });

      expect(scoreCharacterForQuest(character, quest)).toBeLessThan(0);
    });
  });

  describe('getProposalTargetQuests', () => {
    it('excludes quests that are Successful or Failure', () => {
      const quests = [
        makeQuest('a', { status: QuestStatus.Successful }),
        makeQuest('b', { status: QuestStatus.Failure }),
        makeQuest('c', { status: QuestStatus.NotStarted }),
      ];

      expect(getProposalTargetQuests(quests).map(q => q.id)).toEqual(['c']);
    });

    it('excludes quests that already have an assigned team', () => {
      const quests = [
        makeQuest('a', { assignedCharacterIds: ['char-1'] }),
        makeQuest('b', { assignedCharacterIds: [] }),
        makeQuest('c'),
      ];

      expect(
        getProposalTargetQuests(quests)
          .map(q => q.id)
          .sort()
      ).toEqual(['b', 'c']);
    });
  });

  describe('getAvailableCharacters', () => {
    it('only includes present, non-retired characters', () => {
      const characters = [
        makeCharacter('a', { present: true, retired: false }),
        makeCharacter('b', { present: false, retired: false }),
        makeCharacter('c', { present: true, retired: true }),
        makeCharacter('d', { present: undefined }),
      ];

      expect(getAvailableCharacters(characters).map(c => c.id)).toEqual(['a']);
    });
  });

  describe('generateQuestProposals', () => {
    it('returns no proposals when there are no target quests', () => {
      const quests = [makeQuest('a', { status: QuestStatus.Successful })];
      const characters = [makeCharacter('char-1')];

      expect(generateQuestProposals(quests, characters)).toEqual([]);
    });

    it('proposes an empty team when no characters are present', () => {
      const quests = [makeQuest('a')];
      const characters = [makeCharacter('char-1', { present: false })];

      expect(generateQuestProposals(quests, characters)).toEqual([
        { questId: 'a', proposedCharacterIds: [] },
      ]);
    });

    it('fills a team up to the default team size', () => {
      const quest = makeQuest('a');
      const characters = Array.from({ length: DEFAULT_TEAM_SIZE + 2 }, (_, i) =>
        makeCharacter(`char-${i}`)
      );

      const [proposal] = generateQuestProposals([quest], characters);

      expect(proposal.proposedCharacterIds).toHaveLength(DEFAULT_TEAM_SIZE);
    });

    it('respects a custom teamSize', () => {
      const quest = makeQuest('a', { teamSize: 2 });
      const characters = Array.from({ length: 5 }, (_, i) =>
        makeCharacter(`char-${i}`)
      );

      const [proposal] = generateQuestProposals([quest], characters);

      expect(proposal.proposedCharacterIds).toHaveLength(2);
    });

    it('prefers higher-scoring characters for a quest', () => {
      const quest = makeQuest('a', {
        teamSize: 1,
        desirable: { categories: { knacks: ['forge'] } },
      });
      const strongMatch = makeCharacter('strong', {
        facets: {
          callings: ['tinker'],
          knacks: ['hammer_hand', 'kin_secret', 'quick_read'],
        },
      });
      const weakMatch = makeCharacter('weak', {
        facets: { callings: ['tinker'], knacks: [] },
      });

      const [proposal] = generateQuestProposals(
        [quest],
        [weakMatch, strongMatch]
      );

      expect(proposal.proposedCharacterIds).toEqual(['strong']);
    });

    it('avoids assigning the same character to two quests while unused characters remain', () => {
      const quests = [
        makeQuest('a', { teamSize: 1 }),
        makeQuest('b', { teamSize: 1 }),
      ];
      const characters = [makeCharacter('char-1'), makeCharacter('char-2')];

      const proposals = generateQuestProposals(quests, characters);
      const assignedIds = proposals.flatMap(p => p.proposedCharacterIds);

      expect(new Set(assignedIds).size).toBe(2);
    });

    it('allows reusing a character once every present character has been used', () => {
      const quests = [
        makeQuest('a', { teamSize: 1 }),
        makeQuest('b', { teamSize: 1 }),
        makeQuest('c', { teamSize: 1 }),
      ];
      const characters = [makeCharacter('char-1'), makeCharacter('char-2')];

      const proposals = generateQuestProposals(quests, characters);

      // Only 2 present characters for 3 quest slots: every quest still gets a
      // proposed character (a duplicate is unavoidable once the pool of 2 is
      // exhausted), and both characters are used at least once.
      expect(proposals.every(p => p.proposedCharacterIds.length === 1)).toBe(
        true
      );
      const usedIds = new Set(proposals.flatMap(p => p.proposedCharacterIds));
      expect(usedIds).toEqual(new Set(['char-1', 'char-2']));
    });
  });
});
