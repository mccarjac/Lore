import { getActiveDataStores } from '@/datastores/registry';
import { jsonDataStore } from '@/datastores/json';
import { pdfDataStore } from '@/datastores/pdf';
import { githubDataStore } from '@/datastores/github';
import type { DataStore } from '@/datastores/types';
import {
  configureLore,
  getConfiguredDataStores,
  resetLoreConfig,
} from '@/activeRuleset';
import { genericRuleset } from '../fixtures/genericRuleset';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid-1234') }));
// githubDataStore reaches gitIntegration → the real @octokit/rest, whose
// transitive `universal-user-agent` ships ESM outside transformIgnorePatterns.
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));

const customStore: DataStore = {
  id: 'custom',
  label: 'Custom Backend',
  actions: [],
};

describe('data store registry', () => {
  afterEach(() => {
    resetLoreConfig();
  });

  it('offers the two zero-configuration stores when a consumer registers nothing', () => {
    configureLore({ ruleset: genericRuleset });

    // Backup first, then the readable copy — the order they matter in when
    // something has gone wrong.
    expect(getActiveDataStores()).toEqual([jsonDataStore, pdfDataStore]);
  });

  it('offers the default stores before configureLore has ever run', () => {
    expect(getActiveDataStores()).toEqual([jsonDataStore, pdfDataStore]);
  });

  it('offers nothing when a consumer registers an empty list', () => {
    configureLore({ ruleset: genericRuleset, dataStores: [] });

    // `[]` has to stay distinguishable from "omitted", or a consumer could
    // never turn the default store off.
    expect(getConfiguredDataStores()).toEqual([]);
    expect(getActiveDataStores()).toEqual([]);
  });

  it('offers registered stores in declaration order', () => {
    configureLore({
      ruleset: genericRuleset,
      dataStores: [githubDataStore, jsonDataStore],
    });

    expect(getActiveDataStores().map(store => store.id)).toEqual([
      'github',
      'json',
    ]);
  });

  it('accepts a consumer-authored store', () => {
    configureLore({
      ruleset: genericRuleset,
      dataStores: [jsonDataStore, customStore],
    });

    expect(getActiveDataStores()).toContain(customStore);
  });

  it('drops back to the default when the config is reset', () => {
    configureLore({ ruleset: genericRuleset, dataStores: [] });
    resetLoreConfig();

    expect(getConfiguredDataStores()).toBeUndefined();
    expect(getActiveDataStores()).toEqual([jsonDataStore, pdfDataStore]);
  });

  it('keeps GitHub opt-in', () => {
    configureLore({ ruleset: genericRuleset });

    expect(getActiveDataStores()).not.toContain(githubDataStore);
  });
});
