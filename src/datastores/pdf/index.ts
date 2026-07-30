/**
 * The campaign-wiki PDF store — the engine's one **export-only** store (#28).
 *
 * `DataStore` does not require an import: a store declares the actions it has,
 * and a PDF has exactly one direction. Nothing reads a PDF back into a dataset,
 * so there is no `import` action to write and no partial-fidelity round trip to
 * apologize for. That is the whole reason this is a store rather than a fourth
 * button on the JSON one.
 *
 * The document is built as HTML and handed to the platform's print engine
 * (`expo-print`), which is the path issue #28 asked for over a native PDF
 * library: no config plugin, no second rendering model, and the layout is CSS
 * that can be inspected in a browser.
 *
 * This file is only the adapter. Everything worth testing lives in
 * `campaignHtml.ts` (pure) and `images.ts` (one native module).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { renderCampaignHtml } from './campaignHtml';
import { resolveDatasetImages } from './images';
import type { CampaignDataset } from './dataset';
import type {
  DataStore,
  DataStoreActionResult,
  DataStoreContext,
} from '../types';

const exportPdf = async (
  ctx: DataStoreContext
): Promise<DataStoreActionResult> => {
  try {
    // Via the context, never AsyncStorage — the seam's first rule. This is the
    // same `exportDataset` the JSON and GitHub stores serialize.
    const dataset = JSON.parse(await ctx.exportDataset()) as CampaignDataset;

    const images = await resolveDatasetImages(dataset);
    const html = renderCampaignHtml(dataset, ctx.ruleset, images);

    if (Platform.OS === 'web') {
      // No file to share in a browser; the print dialog *is* the export, and
      // "Save as PDF" is a destination inside it.
      await Print.printAsync({ html });
      return { success: true, handled: true };
    }

    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Export Campaign Wiki',
      });
      // The share sheet is the confirmation; a follow-up alert is noise.
      return { success: true, handled: true };
    }

    return {
      success: true,
      message: `Campaign wiki exported to: ${uri}`,
    };
  } catch (error) {
    console.error('PDF export error:', error);
    return {
      success: false,
      error: 'Failed to export the campaign wiki. Please try again.',
    };
  }
};

export const pdfDataStore: DataStore = {
  id: 'pdf',
  label: 'Campaign Wiki',
  description:
    'Export the whole campaign as a printable PDF — every character, faction, location, event and quest, with their images. Export only; a PDF cannot be imported back.',
  actions: [
    {
      id: 'export',
      label: 'Export Campaign PDF',
      progressMessage: 'Building the campaign wiki...',
      variant: 'primary',
      run: exportPdf,
    },
  ],
};
