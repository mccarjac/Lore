/**
 * The image resolver. Its whole contract is "embed what you can, never fail" —
 * so most of these tests are about the ways an image can be unavailable.
 *
 * `expo-file-system/legacy` is the specifier mocked in `jest.setup.js`, not bare
 * `expo-file-system`; importing the other one here would load the real,
 * native-backed module.
 */

import * as FileSystem from 'expo-file-system/legacy';
import {
  MAX_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
  resolveDatasetImages,
} from '@/datastores/pdf/images';
import type { CampaignDataset } from '@/datastores/pdf/dataset';
import { makeCharacter, makeDiscordMessage } from '../../helpers/factories';

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

/** A base64 payload that decodes to roughly `bytes`. */
const base64OfSize = (bytes: number): string =>
  'A'.repeat(Math.ceil((bytes * 4) / 3));

const withImages = (uris: string[]): CampaignDataset => ({
  characters: [makeCharacter({ imageUris: uris })],
});

const fileInfo = (size: number, exists = true) =>
  ({ exists, size, isDirectory: false, uri: '' }) as unknown as Awaited<
    ReturnType<typeof FileSystem.getInfoAsync>
  >;

describe('resolveDatasetImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.getInfoAsync.mockResolvedValue(fileInfo(1024));
    mockFs.readAsStringAsync.mockResolvedValue('AAAA');
    mockFs.deleteAsync.mockResolvedValue(undefined);
  });

  describe('data URIs', () => {
    it('passes an inline image through untouched', async () => {
      const uri = 'data:image/png;base64,AAAA';

      const resolved = await resolveDatasetImages(withImages([uri]));

      expect(resolved.get(uri)).toBe(uri);
      // Already inline — there is nothing to read from disk.
      expect(mockFs.readAsStringAsync).not.toHaveBeenCalled();
    });

    it('drops a malformed data URI instead of emitting a broken image', async () => {
      const uri = 'data:image/png;not-base64-at-all';

      const resolved = await resolveDatasetImages(withImages([uri]));

      expect(resolved.has(uri)).toBe(false);
    });
  });

  describe('local files', () => {
    it('reads a file URI as base64 and types it from its extension', async () => {
      mockFs.readAsStringAsync.mockResolvedValue('PNGDATA');

      const resolved = await resolveDatasetImages(
        withImages(['file://images/portrait.png'])
      );

      expect(resolved.get('file://images/portrait.png')).toBe(
        'data:image/png;base64,PNGDATA'
      );
      expect(mockFs.readAsStringAsync).toHaveBeenCalledWith(
        'file://images/portrait.png',
        { encoding: 'base64' }
      );
    });

    it('reads a bare absolute path', async () => {
      const resolved = await resolveDatasetImages(
        withImages(['/var/data/photo.jpg'])
      );

      expect(resolved.get('/var/data/photo.jpg')).toBe(
        'data:image/jpeg;base64,AAAA'
      );
    });

    it('falls back to jpeg for an unrecognized extension', async () => {
      const resolved = await resolveDatasetImages(
        withImages(['file://blob.unknown'])
      );

      expect(resolved.get('file://blob.unknown')).toBe(
        'data:image/jpeg;base64,AAAA'
      );
    });

    it('skips a file that is not there', async () => {
      mockFs.getInfoAsync.mockResolvedValue(fileInfo(0, false));

      const resolved = await resolveDatasetImages(
        withImages(['file://gone.jpg'])
      );

      expect(resolved.size).toBe(0);
      expect(mockFs.readAsStringAsync).not.toHaveBeenCalled();
    });

    it('skips a file it cannot read without failing the export', async () => {
      mockFs.readAsStringAsync.mockRejectedValue(new Error('EACCES'));

      const resolved = await resolveDatasetImages(
        withImages(['file://locked.jpg'])
      );

      expect(resolved.size).toBe(0);
    });

    it('never reads a file larger than the per-image budget', async () => {
      mockFs.getInfoAsync.mockResolvedValue(fileInfo(MAX_IMAGE_BYTES + 1));

      const resolved = await resolveDatasetImages(
        withImages(['file://huge.jpg'])
      );

      expect(resolved.size).toBe(0);
      // The point of checking the size first is to avoid the allocation.
      expect(mockFs.readAsStringAsync).not.toHaveBeenCalled();
    });
  });

  describe('remote files', () => {
    it('downloads a remote image, reads it, and cleans up', async () => {
      mockFs.downloadAsync.mockResolvedValue({
        status: 200,
        uri: '',
        headers: {},
        mimeType: null,
      } as unknown as FileSystem.FileSystemDownloadResult);
      mockFs.readAsStringAsync.mockResolvedValue('REMOTE');

      const uri = 'https://cdn.discord.test/attachment.png';
      const resolved = await resolveDatasetImages({
        discord: {
          config: { enabled: true, autoSync: false, serverConfigs: [] },
          userMappings: [],
          messages: [makeDiscordMessage({ imageUris: [uri] })],
          characterAliases: [],
          version: '1.0',
          lastUpdated: '',
        },
      });

      expect(resolved.get(uri)).toBe('data:image/png;base64,REMOTE');
      expect(mockFs.downloadAsync).toHaveBeenCalledWith(
        uri,
        expect.stringContaining('pdf_image_')
      );
      // The temp file is not left behind whether the read worked or not.
      expect(mockFs.deleteAsync).toHaveBeenCalled();
    });

    it('skips a download that did not return the file', async () => {
      mockFs.downloadAsync.mockResolvedValue({
        status: 404,
      } as unknown as FileSystem.FileSystemDownloadResult);

      const uri = 'https://cdn.discord.test/gone.png';
      const resolved = await resolveDatasetImages(withImages([uri]));

      expect(resolved.size).toBe(0);
      expect(mockFs.deleteAsync).toHaveBeenCalled();
    });

    it('tolerates a download that throws', async () => {
      mockFs.downloadAsync.mockRejectedValue(new Error('offline'));

      const resolved = await resolveDatasetImages(
        withImages(['https://cdn.discord.test/x.png'])
      );

      expect(resolved.size).toBe(0);
    });
  });

  describe('budgets', () => {
    it('skips an inline image over the per-image budget', async () => {
      const uri = `data:image/png;base64,${base64OfSize(MAX_IMAGE_BYTES + 1024)}`;

      const resolved = await resolveDatasetImages(withImages([uri]));

      expect(resolved.size).toBe(0);
    });

    it('stops embedding once the total budget is spent', async () => {
      // The largest an image may be and still be embedded, so the count that
      // fits is derived from the two constants rather than hardcoded. The one
      // payload is shared between URIs — prefixing it keeps each distinct
      // without copying a multi-megabyte string per entry.
      const chunk = base64OfSize(MAX_IMAGE_BYTES - 1024);
      const fit = Math.floor(MAX_TOTAL_IMAGE_BYTES / (MAX_IMAGE_BYTES - 1024));
      const uris = Array.from(
        { length: fit + 1 },
        (_unused, n) => `data:image/png;base64,${'X'.repeat(n)}${chunk}`
      );

      const resolved = await resolveDatasetImages(withImages(uris));

      expect(resolved.size).toBe(fit);
      expect(resolved.has(uris[fit])).toBe(false);
    });

    it('keeps embedding smaller images after skipping an oversized one', async () => {
      // A single huge photograph must not cost every picture that follows it.
      const huge = `data:image/png;base64,${base64OfSize(MAX_IMAGE_BYTES + 1024)}`;
      const small = 'data:image/png;base64,AAAA';

      const resolved = await resolveDatasetImages(withImages([huge, small]));

      expect(resolved.has(huge)).toBe(false);
      expect(resolved.has(small)).toBe(true);
    });
  });

  describe('collection coverage', () => {
    it('resolves each distinct URI once, however many records share it', async () => {
      const shared = 'file://shared.jpg';

      await resolveDatasetImages({
        characters: [
          makeCharacter({ id: 'a', imageUris: [shared] }),
          makeCharacter({ id: 'b', imageUris: [shared] }),
        ],
      });

      expect(mockFs.readAsStringAsync).toHaveBeenCalledTimes(1);
    });

    it('reads the legacy single imageUri when there is no imageUris', async () => {
      const resolved = await resolveDatasetImages({
        characters: [
          { ...makeCharacter(), imageUri: 'file://legacy.jpg' } as never,
        ],
      });

      expect(resolved.has('file://legacy.jpg')).toBe(true);
    });

    it('ignores a URI shape it does not own', async () => {
      const resolved = await resolveDatasetImages(
        withImages(['images/characters/relative_0.jpg'])
      );

      // An archive-relative path from an unimported export: no file to read.
      expect(resolved.size).toBe(0);
      expect(mockFs.readAsStringAsync).not.toHaveBeenCalled();
    });
  });
});
