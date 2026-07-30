/**
 * The PDF store's action — the thin adapter between the renderer and the
 * platform print engine. What is asserted here is only the wiring; the
 * document's contents are `campaignHtml.test.ts`'s subject.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { pdfDataStore } from '@/datastores/pdf';
import type { DataStoreContext } from '@/datastores/types';
import { genericRuleset } from '../../fixtures/genericRuleset';
import { makeCharacter } from '../../helpers/factories';
import {
  restorePlatformOS,
  setPlatformOS,
} from '../../helpers/alertAndPlatform';

const mockPrint = Print as jest.Mocked<typeof Print>;
const mockSharing = Sharing as jest.Mocked<typeof Sharing>;

const exportAction = pdfDataStore.actions?.find(
  action => action.id === 'export'
);

const makeContext = (
  overrides: Partial<DataStoreContext> = {}
): DataStoreContext => ({
  ruleset: genericRuleset,
  exportDataset: jest.fn(async () =>
    JSON.stringify({
      characters: [makeCharacter({ name: 'Hale Winters' })],
      factions: [],
      locations: [],
      events: [],
      quests: [],
    })
  ),
  importDataset: jest.fn(),
  mergeDataset: jest.fn(),
  ...overrides,
});

describe('pdfDataStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrint.printToFileAsync.mockResolvedValue({
      uri: 'file://cache/wiki.pdf',
    } as Awaited<ReturnType<typeof Print.printToFileAsync>>);
    mockSharing.isAvailableAsync.mockResolvedValue(true);
  });

  afterEach(() => {
    restorePlatformOS();
  });

  describe('declaration', () => {
    it('is export-only', () => {
      // The reason this is a store rather than a button on the JSON one: there
      // is no import direction to implement, so it declares none.
      expect(pdfDataStore.actions).toHaveLength(1);
      expect(pdfDataStore.actions?.[0].id).toBe('export');
      expect(pdfDataStore.Section).toBeUndefined();
    });

    it('declares the metadata the engine renders a section from', () => {
      expect(pdfDataStore.id).toBe('pdf');
      expect(pdfDataStore.label).toBeTruthy();
      expect(pdfDataStore.description).toBeTruthy();
      expect(pdfDataStore.actions?.[0].progressMessage).toBeTruthy();
    });
  });

  describe('export', () => {
    it('renders the dataset the context hands it', async () => {
      const ctx = makeContext();

      await exportAction?.run(ctx);

      expect(ctx.exportDataset).toHaveBeenCalled();
      const { html } = mockPrint.printToFileAsync.mock.calls[0][0] as {
        html: string;
      };
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Hale Winters');
    });

    it('shares the written file and stays quiet about it', async () => {
      const result = await exportAction?.run(makeContext());

      expect(mockSharing.shareAsync).toHaveBeenCalledWith(
        'file://cache/wiki.pdf',
        expect.objectContaining({ mimeType: 'application/pdf' })
      );
      // The share sheet already told the user; an alert on top of it is noise.
      expect(result).toEqual({ success: true, handled: true });
    });

    it('reports the path when sharing is unavailable', async () => {
      mockSharing.isAvailableAsync.mockResolvedValue(false);

      const result = await exportAction?.run(makeContext());

      expect(mockSharing.shareAsync).not.toHaveBeenCalled();
      expect(result?.success).toBe(true);
      expect(result?.message).toContain('file://cache/wiki.pdf');
    });

    it('opens the print dialog on web instead of writing a file', async () => {
      setPlatformOS('web');

      const result = await exportAction?.run(makeContext());

      // In a browser there is no file to share, and "Save as PDF" is a
      // destination inside the print dialog.
      expect(mockPrint.printAsync).toHaveBeenCalledWith(
        expect.objectContaining({ html: expect.stringContaining('<!DOCTYPE') })
      );
      expect(mockPrint.printToFileAsync).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, handled: true });
    });

    it('reports a failure rather than throwing at the screen', async () => {
      mockPrint.printToFileAsync.mockRejectedValue(
        new Error('no print service')
      );

      const result = await exportAction?.run(makeContext());

      expect(result?.success).toBe(false);
      expect(result?.error).toBeTruthy();
    });

    it('reports a failure when the dataset will not parse', async () => {
      const ctx = makeContext({
        exportDataset: jest.fn(async () => 'not json at all'),
      });

      const result = await exportAction?.run(ctx);

      expect(result?.success).toBe(false);
      expect(mockPrint.printToFileAsync).not.toHaveBeenCalled();
    });
  });
});
