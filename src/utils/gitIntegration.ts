import { Octokit } from '@octokit/rest';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { Buffer } from 'buffer';
import { exportDataset, applyMergedDataset } from './characterStorage';
import { normalizeDatasetRulesetFields } from './rulesetFieldMigration';
import { type RulesetDefinition } from '@/ruleset';
import { getActiveRuleset } from '@/activeRuleset';
import { sortDatasetDeterministically } from './datasetSorting';
import { classifySyncError, SyncError, SyncErrorKind } from './syncErrors';
import {
  computeSyncPlan,
  applyResolutions,
  ConflictResolution,
  SyncDataset,
  SyncPlan,
} from './syncMerge';

/**
 * The shared data-library repository this build syncs with.
 *
 * Env-driven for the same reason `src/branding.ts` is: which repository holds
 * a campaign's data is a property of the deployment, not of the engine, and a
 * fork should not have to patch engine source to point somewhere else. The
 * defaults are the values this code shipped with, so an existing install keeps
 * syncing where it always did.
 *
 * Static `process.env` access — Expo inlines `EXPO_PUBLIC_*` by text
 * substitution and would not see a computed lookup. See `src/branding.ts`.
 */
export const DATA_REPO_OWNER =
  process.env.EXPO_PUBLIC_DATA_REPO_OWNER ?? 'mccarjac';
export const DATA_REPO_NAME =
  process.env.EXPO_PUBLIC_DATA_REPO_NAME ?? 'AWInvestigationsDataLibrary';
export const DATA_REPO_BRANCH =
  process.env.EXPO_PUBLIC_DATA_REPO_BRANCH ?? 'main';

/** `owner/name`, for display. */
export const DATA_REPO_SLUG = `${DATA_REPO_OWNER}/${DATA_REPO_NAME}`;

/**
 * Extract image data from a data URI
 */
const extractImageData = (
  dataUri: string
): { mimeType: string; base64Data: string; extension: string } | null => {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return null;

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split('/')[1] || 'jpg';

  return { mimeType, base64Data, extension };
};

interface ImageFile {
  path: string;
  content: string;
  entityType: string;
  entityId: string;
}

/**
 * Read every entity's images (data URI or `file://`) into base64 blobs ready
 * for upload, and rewrite each entity's `imageUris` in place to the
 * repo-relative paths those blobs will land at
 * (`images/<entityType>/<entityId>_<i>.<ext>`).
 *
 * Both `exportToGitHub` (PR path) and `pushDatasetToBranch` (direct-commit
 * auto-sync path, #31) call this — sharing it is what keeps a manual export
 * and an automatic push byte-identical on the image side, which is the
 * flakiest part of sync (data-URI vs `file://` vs the legacy single
 * `imageUri` field, faction-name sanitization).
 *
 * Mutates `dataset` in place, exactly like the code this replaced did — the
 * caller must sort/serialize the dataset *after* calling this, not before.
 */
const collectImageFiles = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataset: any
): Promise<{ imageFiles: ImageFile[]; totalImages: number }> => {
  const imageFiles: ImageFile[] = [];

  const processEntityImages = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entity: any,
    entityType: 'characters' | 'locations' | 'events' | 'factions',
    entityId: string
  ) => {
    const images: string[] = [];

    // Handle multiple images
    if (entity.imageUris && entity.imageUris.length > 0) {
      for (let i = 0; i < entity.imageUris.length; i++) {
        const uri = entity.imageUris[i];
        if (uri) {
          if (uri.startsWith('data:')) {
            // Handle base64 data URI
            const imageData = extractImageData(uri);
            if (imageData) {
              const filename = `images/${entityType}/${entityId}_${i}.${imageData.extension}`;
              imageFiles.push({
                path: filename,
                content: imageData.base64Data,
                entityType,
                entityId,
              });
              images.push(filename);
            }
          } else if (uri.startsWith('file://') || uri.startsWith('/')) {
            // Handle file URI - read file and convert to base64
            try {
              const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
              const base64Data = await FileSystem.readAsStringAsync(fileUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
              const filename = `images/${entityType}/${entityId}_${i}.${extension}`;
              imageFiles.push({
                path: filename,
                content: base64Data,
                entityType,
                entityId,
              });
              images.push(filename);
            } catch (error) {
              console.error(`Failed to read image file: ${uri}`, error);
              // Skip this image if we can't read it
            }
          }
        }
      }
    }
    // Handle legacy single image
    else if (entity.imageUri) {
      const uri = entity.imageUri;
      if (uri.startsWith('data:')) {
        const imageData = extractImageData(uri);
        if (imageData) {
          const filename = `images/${entityType}/${entityId}.${imageData.extension}`;
          imageFiles.push({
            path: filename,
            content: imageData.base64Data,
            entityType,
            entityId,
          });
          images.push(filename);
        }
      } else if (uri.startsWith('file://') || uri.startsWith('/')) {
        try {
          const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
          const base64Data = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
          const filename = `images/${entityType}/${entityId}.${extension}`;
          imageFiles.push({
            path: filename,
            content: base64Data,
            entityType,
            entityId,
          });
          images.push(filename);
        } catch (error) {
          console.error(`Failed to read image file: ${uri}`, error);
        }
      }
    }

    return images;
  };

  let totalImages = 0;
  console.log('[GitHub Export] Processing images for export...');
  if (dataset.characters) {
    for (const character of dataset.characters) {
      const images = await processEntityImages(
        character,
        'characters',
        character.id
      );
      if (images.length > 0) {
        character.imageUris = images;
        totalImages += images.length;
        console.log(
          `[GitHub Export] Processed ${images.length} images for character: ${character.name}`
        );
      }
    }
  }

  if (dataset.locations) {
    for (const location of dataset.locations) {
      const images = await processEntityImages(
        location,
        'locations',
        location.id
      );
      if (images.length > 0) {
        location.imageUris = images;
        totalImages += images.length;
        console.log(
          `[GitHub Export] Processed ${images.length} images for location: ${location.name}`
        );
      }
    }
  }

  if (dataset.events) {
    for (const event of dataset.events) {
      const images = await processEntityImages(event, 'events', event.id);
      if (images.length > 0) {
        event.imageUris = images;
        totalImages += images.length;
        console.log(
          `[GitHub Export] Processed ${images.length} images for event: ${event.title}`
        );
      }
    }
  }

  if (dataset.factions) {
    for (const faction of dataset.factions) {
      const safeName = faction.name.replace(/[^a-zA-Z0-9]/g, '_');
      const images = await processEntityImages(faction, 'factions', safeName);
      if (images.length > 0) {
        faction.imageUris = images;
        totalImages += images.length;
        console.log(
          `[GitHub Export] Processed ${images.length} images for faction: ${faction.name}`
        );
      }
    }
  }

  console.log(`[GitHub Export] Total images to upload: ${totalImages}`);

  return { imageFiles, totalImages };
};

/**
 * Build a tree on top of an existing commit's tree, adding/overwriting the
 * given blobs, then commit it. Shared by `exportToGitHub`'s image upload and
 * `pushDatasetToBranch`'s single-commit path (#31) — both need "take a
 * commit, layer some blobs on its tree, commit the result" and nothing more.
 *
 * A blob that fails to create is skipped rather than failing the whole
 * commit, matching the image-upload behavior this replaced ("continue with
 * other images even if one fails").
 */
const createTreeCommit = async (
  octokit: Octokit,
  options: {
    /** The commit whose tree the new tree is layered on top of. */
    baseCommitSha: string;
    files: Array<{
      path: string;
      content: string;
      encoding?: 'base64' | 'utf-8';
    }>;
    message: string;
  }
): Promise<{ commitSha: string }> => {
  const { data: baseCommit } = await octokit.rest.git.getCommit({
    owner: DATA_REPO_OWNER,
    repo: DATA_REPO_NAME,
    commit_sha: options.baseCommitSha,
  });
  const baseTreeSha = baseCommit.tree.sha;

  const treeItems: Array<{
    path: string;
    mode: '100644';
    type: 'blob';
    sha: string;
  }> = [];

  for (const file of options.files) {
    try {
      const content =
        (file.encoding ?? 'base64') === 'base64'
          ? file.content.replace(/[\r\n\s]/g, '')
          : file.content;
      const { data: blob } = await octokit.rest.git.createBlob({
        owner: DATA_REPO_OWNER,
        repo: DATA_REPO_NAME,
        content,
        encoding: file.encoding ?? 'base64',
      });
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    } catch (error) {
      console.error(
        `[GitHub Sync] Failed to create blob for ${file.path}:`,
        error
      );
    }
  }

  const { data: newTree } = await octokit.rest.git.createTree({
    owner: DATA_REPO_OWNER,
    repo: DATA_REPO_NAME,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner: DATA_REPO_OWNER,
    repo: DATA_REPO_NAME,
    message: options.message,
    tree: newTree.sha,
    parents: [options.baseCommitSha],
  });

  return { commitSha: newCommit.sha };
};

/**
 * GitHub configuration storage keys
 */
const GITHUB_CONFIG_KEY = '@github_config';

// The dataset snapshot as it stood at the end of the last successful sync
// (see computeGitHubSyncPlan/applyGitHubSyncPlan). This is the three-way
// merge base: it lets a later sync tell "you changed this" apart from "they
// changed this" instead of only seeing the current local/remote states.
const SYNC_BASE_KEY = '@github_sync_base.json';

export interface GitHubSyncState {
  // Head commit of DATA_REPO_BRANCH at the end of the last successful merge
  // sync. A pushed export opens a PR — main does not move until a human
  // merges it — so this is only ever updated by a completed merge sync, not
  // by exportToGitHub.
  baseCommitSha?: string;
  // Blob sha of data.json at that same point, for a cheaper moved-check.
  baseDataSha?: string;
  pulledAt?: string;
  lastPushedPrUrl?: string;
  lastPushedAt?: string;
}

export interface GitHubConfig {
  token?: string;
  lastSync?: string;
  sync?: GitHubSyncState;
}

/**
 * Get stored GitHub configuration
 */
export const getGitHubConfig = async (): Promise<GitHubConfig> => {
  try {
    const configStr = await FileSystem.readAsStringAsync(
      FileSystem.documentDirectory + GITHUB_CONFIG_KEY
    );
    return JSON.parse(configStr);
  } catch {
    return {};
  }
};

/**
 * Save GitHub configuration
 */
export const saveGitHubConfig = async (config: GitHubConfig): Promise<void> => {
  try {
    await FileSystem.writeAsStringAsync(
      FileSystem.documentDirectory + GITHUB_CONFIG_KEY,
      JSON.stringify(config)
    );
  } catch (error) {
    console.error('Failed to save GitHub config:', error);
  }
};

// The merge-base snapshot is stored separately from GitHubConfig because it
// is a full dataset (potentially large) rather than a few config fields.
// Exported (#31) so auto-sync can tell "has a merge base ever been
// established" without duplicating the file read — a store's own backend
// state, not local game data, so reading it does not breach the "a store
// never touches storage" rule (local data still arrives only on `ctx`).
export const getSyncBaseSnapshot = async (): Promise<SyncDataset | null> => {
  try {
    const raw = await FileSystem.readAsStringAsync(
      FileSystem.documentDirectory + SYNC_BASE_KEY
    );
    return JSON.parse(raw) as SyncDataset;
  } catch {
    return null;
  }
};

const saveSyncBaseSnapshot = async (dataset: SyncDataset): Promise<void> => {
  try {
    await FileSystem.writeAsStringAsync(
      FileSystem.documentDirectory + SYNC_BASE_KEY,
      JSON.stringify(dataset)
    );
  } catch (error) {
    console.error('Failed to save GitHub sync base snapshot:', error);
  }
};

/**
 * Initialize Octokit with token
 */
const getOctokit = async (): Promise<Octokit | null> => {
  const config = await getGitHubConfig();
  if (!config.token) {
    return null;
  }
  return new Octokit({ auth: config.token });
};

/**
 * Verify a GitHub token is valid. Failure is classified so a dropped
 * connection is reported as "offline" rather than "invalid token".
 */
export const verifyGitHubToken = async (
  token: string
): Promise<{ valid: boolean; error?: SyncError }> => {
  try {
    const octokit = new Octokit({ auth: token });
    await octokit.rest.users.getAuthenticated();
    return { valid: true };
  } catch (error) {
    return { valid: false, error: classifySyncError(error) };
  }
};

/**
 * Check if the data repository exists and is accessible
 */
const verifyRepository = async (
  octokit: Octokit
): Promise<{ exists: boolean; error?: string; errorKind?: SyncErrorKind }> => {
  try {
    await octokit.rest.repos.get({
      owner: DATA_REPO_OWNER,
      repo: DATA_REPO_NAME,
    });
    return { exists: true };
  } catch (error) {
    const classified = classifySyncError(error);
    return {
      exists: false,
      error: classified.message,
      errorKind: classified.kind,
    };
  }
};

const getMainHeadSha = async (octokit: Octokit): Promise<string> => {
  const { data: ref } = await octokit.rest.git.getRef({
    owner: DATA_REPO_OWNER,
    repo: DATA_REPO_NAME,
    ref: `heads/${DATA_REPO_BRANCH}`,
  });
  return ref.object.sha;
};

/**
 * The cheap remote-moved check auto-sync needs (#31): one `git.getRef` call,
 * no repository verification, no data.json fetch, no images. Deliberately
 * skips `verifyRepository` — a missing/unauthorized repo makes `getRef`
 * itself fail with a 404/401, which `classifySyncError` already maps
 * correctly, so a second check would only cost an extra call on every poll.
 */
export const getRemoteHeadSha = async (): Promise<{
  success: boolean;
  sha?: string;
  error?: string;
  errorKind?: SyncErrorKind;
}> => {
  try {
    const octokit = await getOctokit();
    if (!octokit) {
      return {
        success: false,
        error: 'GitHub token not configured. Please set up your token first.',
      };
    }
    const sha = await getMainHeadSha(octokit);
    return { success: true, sha };
  } catch (error) {
    const classified = classifySyncError(error);
    return {
      success: false,
      error: classified.message,
      errorKind: classified.kind,
    };
  }
};

/**
 * Export data to GitHub repository by creating a Pull Request
 */
export const exportToGitHub = async (
  options: { force?: boolean; ruleset?: RulesetDefinition } = {}
): Promise<{
  success: boolean;
  prUrl?: string;
  error?: string;
  errorKind?: SyncErrorKind;
  remoteMoved?: boolean;
}> => {
  let octokitForCleanup: Octokit | null = null;
  let branchNameForCleanup: string | undefined;

  try {
    const octokit = await getOctokit();
    if (!octokit) {
      return {
        success: false,
        error: 'GitHub token not configured. Please set up your token first.',
      };
    }
    octokitForCleanup = octokit;

    // Verify repository exists and is accessible
    const repoCheck = await verifyRepository(octokit);
    if (!repoCheck.exists) {
      return {
        success: false,
        error: repoCheck.error || 'Repository verification failed.',
        errorKind: repoCheck.errorKind,
      };
    }

    // Get the current user info
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const branchName = `data-export-${Date.now()}`;

    // Get the default branch's latest commit SHA
    const baseSha = await getMainHeadSha(octokit);

    // Warn (unless forced) when the shared repo has moved since the last
    // completed merge sync. main only advances via a merged PR, so this
    // means someone else's changes aren't reflected locally yet.
    const config = await getGitHubConfig();
    const knownBaseSha = config.sync?.baseCommitSha;
    if (!options.force && knownBaseSha && knownBaseSha !== baseSha) {
      return {
        success: false,
        remoteMoved: true,
        errorKind: 'conflict',
        error:
          'The repository has changed since your last sync. Sync from GitHub first to merge in the latest changes, or export anyway to open a PR against the current state.',
      };
    }

    // Create a new branch from the base
    await octokit.rest.git.createRef({
      owner: DATA_REPO_OWNER,
      repo: DATA_REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
    branchNameForCleanup = branchName;

    // Export all data
    const jsonData = await exportDataset();
    const dataset = JSON.parse(jsonData);

    // Check if file exists
    let fileSha: string | undefined;
    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner: DATA_REPO_OWNER,
        repo: DATA_REPO_NAME,
        path: 'data.json',
        ref: branchName,
      });
      if ('sha' in existingFile) {
        fileSha = existingFile.sha;
      }
    } catch {
      // File doesn't exist, that's fine
    }

    // Process and upload images
    const { imageFiles, totalImages } = await collectImageFiles(dataset);

    // Sort the dataset deterministically to minimize diff noise
    const sortedDataset = sortDatasetDeterministically(dataset);

    // Update data.json with modified paths
    // Note: This happens AFTER image processing because we need to update
    // the imageUris fields in the dataset to point to the relative paths in
    // the repository (e.g., "images/characters/id_0.jpg")
    const updatedDataContent = Buffer.from(
      JSON.stringify(sortedDataset, null, 2)
    ).toString('base64');

    // Create or update the data.json file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: DATA_REPO_OWNER,
      repo: DATA_REPO_NAME,
      path: 'data.json',
      message: `Data export by ${user.login} on ${new Date().toISOString()}`,
      content: updatedDataContent,
      branch: branchName,
      sha: fileSha,
    });

    // Upload all image files to the repository
    // Note: The branch is created from the base branch, so files that exist in the base
    // will also exist in the new branch and we need to provide their SHA when updating
    console.log(
      `[GitHub Export] Uploading ${imageFiles.length} images to GitHub...`
    );
    // Get the latest commit for the branch to build the image tree on
    const { data: refData } = await octokit.rest.git.getRef({
      owner: DATA_REPO_OWNER,
      repo: DATA_REPO_NAME,
      ref: `heads/${branchName}`,
    });
    const latestCommitSha = refData.object.sha;

    const { commitSha: imagesCommitSha } = await createTreeCommit(octokit, {
      baseCommitSha: latestCommitSha,
      files: imageFiles,
      message: `Upload ${imageFiles.length} images`,
    });

    // Update the branch reference to point to the new commit
    await octokit.rest.git.updateRef({
      owner: DATA_REPO_OWNER,
      repo: DATA_REPO_NAME,
      ref: `heads/${branchName}`,
      sha: imagesCommitSha,
    });
    console.log(
      `[GitHub Export] Successfully uploaded ${imageFiles.length} images`
    );

    // Create Pull Request
    const { data: pr } = await octokit.rest.pulls.create({
      owner: DATA_REPO_OWNER,
      repo: DATA_REPO_NAME,
      title: `Data export by ${user.login}`,
      head: branchName,
      base: DATA_REPO_BRANCH,
      body: `Automated data export from ${(options.ruleset ?? getActiveRuleset()).branding.appName}.

**Export Details:**
- User: ${user.login}
- Date: ${new Date().toLocaleString()}
- Characters: ${dataset.characters?.length || 0}
- Factions: ${dataset.factions?.length || 0}
- Locations: ${dataset.locations?.length || 0}
- Events: ${dataset.events?.length || 0}
- Images: ${totalImages}

Please review the changes before merging.`,
    });

    // Record the push. main hasn't moved (a PR doesn't merge itself), so
    // sync.baseCommitSha is deliberately left untouched — only a completed
    // merge sync (applyGitHubSyncPlan) advances the merge base.
    await saveGitHubConfig({
      ...config,
      lastSync: new Date().toISOString(),
      sync: {
        ...config.sync,
        lastPushedPrUrl: pr.html_url,
        lastPushedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      prUrl: pr.html_url,
    };
  } catch (error) {
    console.error('Export to GitHub failed:', error);

    // Best-effort cleanup of a branch this run created — the classified
    // error below is what actually gets reported either way.
    if (branchNameForCleanup && octokitForCleanup) {
      try {
        await octokitForCleanup.rest.git.deleteRef({
          owner: DATA_REPO_OWNER,
          repo: DATA_REPO_NAME,
          ref: `heads/${branchNameForCleanup}`,
        });
      } catch {
        // Cleanup failure isn't actionable for the user; nothing to do.
      }
    }

    const classified = classifySyncError(error);
    return {
      success: false,
      error: classified.message,
      errorKind: classified.kind,
    };
  }
};

/**
 * Import data from GitHub repository
 */
export const importFromGitHub = async (): Promise<{
  success: boolean;
  data?: string;
  error?: string;
  errorKind?: SyncErrorKind;
}> => {
  try {
    const octokit = await getOctokit();
    if (!octokit) {
      return {
        success: false,
        error: 'GitHub token not configured. Please set up your token first.',
      };
    }

    // Verify repository exists and is accessible
    const repoCheck = await verifyRepository(octokit);
    if (!repoCheck.exists) {
      return {
        success: false,
        error: repoCheck.error || 'Repository verification failed.',
        errorKind: repoCheck.errorKind,
      };
    }

    // Fetch data.json from the main branch
    const { data: file } = await octokit.rest.repos.getContent({
      owner: DATA_REPO_OWNER,
      repo: DATA_REPO_NAME,
      path: 'data.json',
      ref: DATA_REPO_BRANCH,
    });

    if ('content' in file) {
      const content = Buffer.from(file.content, 'base64').toString('utf-8');
      const dataset = JSON.parse(content);

      // Create permanent image directories
      const permanentImageDir = FileSystem.documentDirectory + 'images/';
      await FileSystem.makeDirectoryAsync(permanentImageDir + 'characters/', {
        intermediates: true,
      });
      await FileSystem.makeDirectoryAsync(permanentImageDir + 'locations/', {
        intermediates: true,
      });
      await FileSystem.makeDirectoryAsync(permanentImageDir + 'events/', {
        intermediates: true,
      });
      await FileSystem.makeDirectoryAsync(permanentImageDir + 'factions/', {
        intermediates: true,
      });

      // Helper function to download and save images
      const downloadImages = async (
        imagePaths: string[]
      ): Promise<string[]> => {
        const localPaths: string[] = [];

        for (const imagePath of imagePaths) {
          try {
            // First try to get the file metadata to get its blob SHA
            const { data: fileInfo } = await octokit.rest.repos.getContent({
              owner: DATA_REPO_OWNER,
              repo: DATA_REPO_NAME,
              path: imagePath,
              ref: DATA_REPO_BRANCH,
            });

            if (
              'sha' in fileInfo &&
              'size' in fileInfo &&
              typeof fileInfo.size === 'number'
            ) {
              // Determine local path for the image
              const filename = imagePath.split('/').pop() || 'image.jpg';
              const entityType = imagePath.split('/')[1]; // characters, locations, events, or factions
              const localPath = permanentImageDir + entityType + '/' + filename;

              // Check if image already exists locally
              const localFileInfo = await FileSystem.getInfoAsync(localPath);

              if (
                localFileInfo.exists &&
                typeof localFileInfo.size === 'number' &&
                localFileInfo.size === fileInfo.size
              ) {
                // Image already exists with the same size - skip download
                localPaths.push(localPath);
                console.log(
                  `[GitHub Import] Image already exists (${fileInfo.size} bytes): ${imagePath} -> ${localPath}`
                );
              } else {
                // Image doesn't exist, has different size, or size check failed - download it
                // Use Git Blob API to fetch the content directly (no size limit)
                const { data: blob } = await octokit.rest.git.getBlob({
                  owner: DATA_REPO_OWNER,
                  repo: DATA_REPO_NAME,
                  file_sha: fileInfo.sha,
                });

                // Git Blob API returns base64 content - remove any whitespace
                const cleanBase64 = blob.content.replace(/\s/g, '');

                await FileSystem.writeAsStringAsync(localPath, cleanBase64, {
                  encoding: FileSystem.EncodingType.Base64,
                });

                localPaths.push(localPath);
                console.log(
                  `[GitHub Import] Successfully downloaded image (${fileInfo.size} bytes): ${imagePath} -> ${localPath}`
                );
              }
            }
          } catch (error) {
            console.error(
              `[GitHub Import] Failed to download image ${imagePath}:`,
              error
            );
            // Continue with other images even if one fails
          }
        }

        return localPaths;
      };

      // Process images for characters
      let totalImagesDownloaded = 0;
      if (dataset.characters) {
        for (const character of dataset.characters) {
          if (character.imageUris && character.imageUris.length > 0) {
            console.log(
              `[GitHub Import] Processing ${character.imageUris.length} images for character: ${character.name}`
            );
            const localPaths = await downloadImages(character.imageUris);
            if (localPaths.length > 0) {
              character.imageUris = localPaths;
              totalImagesDownloaded += localPaths.length;
            } else {
              console.warn(
                `[GitHub Import] No images downloaded for character: ${character.name}`
              );
              // Clear image references if download failed
              delete character.imageUri;
              delete character.imageUris;
            }
          } else if (character.imageUri) {
            // Legacy single-image field from an older export/repo - download
            // it and normalize onto imageUris, dropping the deprecated field.
            console.log(
              `[GitHub Import] Processing single image for character: ${character.name}`
            );
            const localPaths = await downloadImages([character.imageUri]);
            delete character.imageUri;
            if (localPaths.length > 0) {
              character.imageUris = localPaths;
              totalImagesDownloaded += localPaths.length;
            } else {
              console.warn(
                `[GitHub Import] No image downloaded for character: ${character.name}`
              );
              // Clear image references if download failed
              delete character.imageUris;
            }
          }
        }
      }

      // Process images for locations
      if (dataset.locations) {
        for (const location of dataset.locations) {
          if (location.imageUris && location.imageUris.length > 0) {
            console.log(
              `[GitHub Import] Processing ${location.imageUris.length} images for location: ${location.name}`
            );
            const localPaths = await downloadImages(location.imageUris);
            if (localPaths.length > 0) {
              location.imageUris = localPaths;
              totalImagesDownloaded += localPaths.length;
            } else {
              console.warn(
                `[GitHub Import] No images downloaded for location: ${location.name}`
              );
              // Clear image references if download failed
              delete location.imageUri;
              delete location.imageUris;
            }
          } else if (location.imageUri) {
            // Legacy single-image field from an older export/repo - download
            // it and normalize onto imageUris, dropping the deprecated field.
            console.log(
              `[GitHub Import] Processing single image for location: ${location.name}`
            );
            const localPaths = await downloadImages([location.imageUri]);
            delete location.imageUri;
            if (localPaths.length > 0) {
              location.imageUris = localPaths;
              totalImagesDownloaded += localPaths.length;
            } else {
              console.warn(
                `[GitHub Import] No image downloaded for location: ${location.name}`
              );
              // Clear image references if download failed
              delete location.imageUris;
            }
          }
        }
      }

      // Process images for events
      if (dataset.events) {
        for (const event of dataset.events) {
          if (event.imageUris && event.imageUris.length > 0) {
            console.log(
              `[GitHub Import] Processing ${event.imageUris.length} images for event: ${event.title}`
            );
            const localPaths = await downloadImages(event.imageUris);
            if (localPaths.length > 0) {
              event.imageUris = localPaths;
              totalImagesDownloaded += localPaths.length;
            } else {
              console.warn(
                `[GitHub Import] No images downloaded for event: ${event.title}`
              );
              // Clear image references if download failed
              delete event.imageUri;
              delete event.imageUris;
            }
          } else if (event.imageUri) {
            // Legacy single-image field from an older export/repo - download
            // it and normalize onto imageUris, dropping the deprecated field.
            console.log(
              `[GitHub Import] Processing single image for event: ${event.title}`
            );
            const localPaths = await downloadImages([event.imageUri]);
            delete event.imageUri;
            if (localPaths.length > 0) {
              event.imageUris = localPaths;
              totalImagesDownloaded += localPaths.length;
            } else {
              console.warn(
                `[GitHub Import] No image downloaded for event: ${event.title}`
              );
              // Clear image references if download failed
              delete event.imageUris;
            }
          }
        }
      }

      // Process images for factions
      if (dataset.factions) {
        for (const faction of dataset.factions) {
          if (faction.imageUris && faction.imageUris.length > 0) {
            console.log(
              `[GitHub Import] Processing ${faction.imageUris.length} images for faction: ${faction.name}`
            );
            const localPaths = await downloadImages(faction.imageUris);
            if (localPaths.length > 0) {
              faction.imageUris = localPaths;
              totalImagesDownloaded += localPaths.length;
            } else {
              console.warn(
                `[GitHub Import] No images downloaded for faction: ${faction.name}`
              );
              // Clear image references if download failed
              delete faction.imageUri;
              delete faction.imageUris;
            }
          } else if (faction.imageUri) {
            // Legacy single-image field from an older export/repo - download
            // it and normalize onto imageUris, dropping the deprecated field.
            console.log(
              `[GitHub Import] Processing single image for faction: ${faction.name}`
            );
            const localPaths = await downloadImages([faction.imageUri]);
            delete faction.imageUri;
            if (localPaths.length > 0) {
              faction.imageUris = localPaths;
              totalImagesDownloaded += localPaths.length;
            } else {
              console.warn(
                `[GitHub Import] No image downloaded for faction: ${faction.name}`
              );
              // Clear image references if download failed
              delete faction.imageUris;
            }
          }
        }
      }

      console.log(
        `[GitHub Import] Total images downloaded: ${totalImagesDownloaded}`
      );

      // Update last sync time
      const config = await getGitHubConfig();
      await saveGitHubConfig({
        ...config,
        lastSync: new Date().toISOString(),
      });

      return {
        success: true,
        data: JSON.stringify(dataset),
      };
    } else {
      return {
        success: false,
        error: 'File not found or is a directory',
        errorKind: 'notFound',
      };
    }
  } catch (error) {
    console.error('Import from GitHub failed:', error);
    const classified = classifySyncError(error);
    return {
      success: false,
      error: classified.message,
      errorKind: classified.kind,
    };
  }
};

/**
 * Show GitHub token configuration dialog
 */
export const showGitHubTokenDialog = (): Promise<string | null> => {
  return new Promise(resolve => {
    Alert.prompt(
      'GitHub Personal Access Token',
      'Enter your GitHub Personal Access Token with repo permissions. You can create one at: https://github.com/settings/tokens',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null),
        },
        {
          text: 'Save',
          onPress: async (token?: string) => {
            if (token && token.trim()) {
              const { valid, error } = await verifyGitHubToken(token.trim());
              if (valid) {
                const config = await getGitHubConfig();
                await saveGitHubConfig({ ...config, token: token.trim() });
                Alert.alert('Success', 'GitHub token saved successfully!', [
                  { text: 'OK' },
                ]);
                resolve(token.trim());
              } else {
                Alert.alert(
                  error?.kind === 'offline' ? 'Offline' : 'Invalid Token',
                  error?.message ||
                    'The token you entered is invalid. Please check and try again.',
                  [{ text: 'OK' }]
                );
                resolve(null);
              }
            } else {
              resolve(null);
            }
          },
        },
      ],
      'plain-text'
    );
  });
};

export interface GitHubSyncPlanResult {
  success: boolean;
  plan?: SyncPlan;
  // Head commit of DATA_REPO_BRANCH at the moment this plan was computed;
  // pass it through to applyGitHubSyncPlan so the merge base can be
  // recorded against the exact remote state this plan was built from.
  remoteCommitSha?: string;
  // True when `skipIfRemoteUnchanged` was set and the remote hadn't moved —
  // `plan` is omitted because nothing needed diffing.
  unchanged?: boolean;
  error?: string;
  errorKind?: SyncErrorKind;
}

/**
 * Fetch the remote dataset (reusing importFromGitHub's fetch + image
 * download), load the local dataset, and compute a three-way merge plan
 * against the last-synced base snapshot. Does not write anything — call
 * `applyGitHubSyncPlan` with the user's conflict resolutions to persist it.
 *
 * The head SHA is read *before* the full remote fetch — auto-sync (#31)
 * polls this on an interval, and `importFromGitHub()` is expensive (a
 * `data.json` fetch plus one request per image); `skipIfRemoteUnchanged`
 * lets a poll skip all of that the moment the branch hasn't moved. The manual
 * "Sync from GitHub" path calls this with no options and is unaffected: the
 * SHA read happens either way, just earlier, and the total call count for a
 * plan that does need computing is unchanged.
 */
export const computeGitHubSyncPlan = async (
  options: { skipIfRemoteUnchanged?: boolean } = {}
): Promise<GitHubSyncPlanResult> => {
  try {
    const octokit = await getOctokit();
    if (!octokit) {
      return {
        success: false,
        error: 'GitHub token not configured. Please set up your token first.',
      };
    }
    const remoteCommitSha = await getMainHeadSha(octokit);

    if (options.skipIfRemoteUnchanged) {
      const config = await getGitHubConfig();
      if (config.sync?.baseCommitSha === remoteCommitSha) {
        return { success: true, remoteCommitSha, unchanged: true };
      }
    }

    const remoteResult = await importFromGitHub();
    if (!remoteResult.success || !remoteResult.data) {
      return {
        success: false,
        error: remoteResult.error,
        errorKind: remoteResult.errorKind,
      };
    }

    // Normalize every side to the current field names before diffing.
    // A remote or base snapshot written before the Phase 1 renames would
    // otherwise differ from freshly-migrated local data on every single
    // character, manufacturing a conflict per record.
    const remote = normalizeDatasetRulesetFields(
      JSON.parse(remoteResult.data) as SyncDataset
    );
    const local = normalizeDatasetRulesetFields(
      JSON.parse(await exportDataset()) as SyncDataset
    );
    const rawBase = await getSyncBaseSnapshot();
    const base = rawBase ? normalizeDatasetRulesetFields(rawBase) : rawBase;

    return {
      success: true,
      plan: computeSyncPlan(base, local, remote),
      remoteCommitSha,
    };
  } catch (error) {
    console.error('Computing GitHub sync plan failed:', error);
    const classified = classifySyncError(error);
    return {
      success: false,
      error: classified.message,
      errorKind: classified.kind,
    };
  }
};

/**
 * Apply a sync plan (with the user's per-conflict resolutions) to local
 * storage, then record the merge base for the next sync: the merged dataset
 * itself (not the raw remote fetch — conflicts resolved to "local" must
 * still look unchanged next time) plus the remote commit SHA it was merged
 * against.
 */
export const applyGitHubSyncPlan = async (
  plan: SyncPlan,
  resolutions: Record<string, ConflictResolution>,
  remoteCommitSha: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const merged = applyResolutions(plan, resolutions);
    const applied = await applyMergedDataset(merged);
    if (!applied) {
      return {
        success: false,
        error: 'Failed to save the merged data locally.',
      };
    }

    await saveSyncBaseSnapshot(merged);

    const config = await getGitHubConfig();
    await saveGitHubConfig({
      ...config,
      lastSync: new Date().toISOString(),
      sync: {
        ...config.sync,
        baseCommitSha: remoteCommitSha,
        pulledAt: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Applying GitHub sync plan failed:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
};

/**
 * Commit the current local dataset straight to `DATA_REPO_BRANCH` — no
 * branch, no pull request (#31, auto-sync only). This is a deliberate
 * one-way door around the "nothing is merged automatically" rule the manual
 * `exportToGitHub` path keeps: it exists so an opted-in user's edits reach
 * everyone else without waiting on a human to merge a PR. It must never be
 * reachable from the manual export UI.
 *
 * `expectedHeadSha` is the compare-and-set: the caller (auto-sync's `run`)
 * must have just fetched it. `git.updateRef` below is called **without
 * `force`**, so if the branch moved in the meantime the update is rejected as
 * a non-fast-forward and nothing is written — the caller's next tick pulls,
 * merges, and tries again. A second, cheaper head-check right before
 * building the commit narrows that race window further, but the `updateRef`
 * call is the actual guard.
 *
 * On success this advances the merge base
 * (`saveSyncBaseSnapshot`/`sync.baseCommitSha`) exactly like
 * `applyGitHubSyncPlan` does — without that, the very next poll would see
 * "the remote moved" and pay a full merge diffing its own commit, forever.
 */
export const pushDatasetToBranch = async (options: {
  expectedHeadSha: string;
  ruleset?: RulesetDefinition;
}): Promise<{
  success: boolean;
  commitSha?: string;
  /** The branch head was no longer `expectedHeadSha` — nothing was written. */
  remoteMoved?: boolean;
  error?: string;
  errorKind?: SyncErrorKind;
}> => {
  try {
    const octokit = await getOctokit();
    if (!octokit) {
      return {
        success: false,
        error: 'GitHub token not configured. Please set up your token first.',
      };
    }

    const jsonData = await exportDataset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataset: any = JSON.parse(jsonData);

    // Snapshot the dataset *before* collectImageFiles rewrites `imageUris`
    // to repo-relative paths — the merge base should keep the same local
    // shape a later `exportDataset()` produces, so a future merge compares
    // like with like. (`stripImages` makes either shape compare equal today,
    // but persisting repo paths here would be a trap for whoever changes
    // that later.)
    const preImageDataset = JSON.parse(JSON.stringify(dataset)) as SyncDataset;

    const { imageFiles, totalImages } = await collectImageFiles(dataset);
    const sortedDataset = sortDatasetDeterministically(dataset);
    const dataContent = Buffer.from(
      JSON.stringify(sortedDataset, null, 2)
    ).toString('base64');

    // Narrow the race window: re-check the head right before building the
    // commit. The `updateRef` call below is what actually enforces it.
    const currentHeadSha = await getMainHeadSha(octokit);
    if (currentHeadSha !== options.expectedHeadSha) {
      return {
        success: false,
        remoteMoved: true,
        errorKind: 'conflict',
        error: 'The repository changed while this sync was running.',
      };
    }

    const ruleset = options.ruleset ?? getActiveRuleset();
    const { commitSha } = await createTreeCommit(octokit, {
      baseCommitSha: options.expectedHeadSha,
      files: [
        ...imageFiles,
        { path: 'data.json', content: dataContent, encoding: 'base64' },
      ],
      message: `Automatic sync from ${ruleset.branding.appName} (${totalImages} image${
        totalImages === 1 ? '' : 's'
      })`,
    });

    try {
      await octokit.rest.git.updateRef({
        owner: DATA_REPO_OWNER,
        repo: DATA_REPO_NAME,
        ref: `heads/${DATA_REPO_BRANCH}`,
        sha: commitSha,
        force: false,
      });
    } catch (error) {
      const status = (error as { status?: number } | undefined)?.status;
      if (status === 422 || status === 409) {
        return {
          success: false,
          remoteMoved: true,
          errorKind: 'conflict',
          error: 'The repository changed while this sync was running.',
        };
      }
      throw error;
    }

    // Advance the merge base — without this the very next poll would see
    // "the remote moved" and pay a full merge diffing its own commit.
    await saveSyncBaseSnapshot(preImageDataset);
    const config = await getGitHubConfig();
    await saveGitHubConfig({
      ...config,
      lastSync: new Date().toISOString(),
      sync: {
        ...config.sync,
        baseCommitSha: commitSha,
        lastPushedAt: new Date().toISOString(),
      },
    });

    return { success: true, commitSha };
  } catch (error) {
    console.error('Direct push to GitHub branch failed:', error);
    const classified = classifySyncError(error);
    return {
      success: false,
      error: classified.message,
      errorKind: classified.kind,
    };
  }
};

/**
 * Check if GitHub is configured
 */
export const isGitHubConfigured = async (): Promise<boolean> => {
  const config = await getGitHubConfig();
  return !!config.token;
};
