import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {object} WalkEntry
 * @property {string} path The full path of the entry.
 * @property {import('node:fs').Dirent} dirent The directory entry.
 */

/**
 * @typedef {object} AsyncWalkOptions
 * @property {string} basePath The directory to walk.
 * @property {(entry: WalkEntry) => boolean | Promise<boolean>} deepFilter Filter for directory traversal.
 * @property {(entry: WalkEntry) => boolean | Promise<boolean>} entryFilter Filter for file inclusion.
 * @property {boolean} [followSymbolicLinks] Whether to follow symbolic links.
 * @property {AbortSignal} [signal] An AbortSignal to cancel the traversal.
 * @property {(error: NodeJS.ErrnoException) => boolean} [errorFilter] Optional function to filter errors. Return true to skip the error.
 */

/**
 * Recursively walks a directory tree, applying async filter functions.
 *
 * @param {AsyncWalkOptions} options
 * @returns {Promise<string[]>} An array of matching file paths.
 */
export async function asyncWalk (options) {
  const { basePath, deepFilter, entryFilter, errorFilter, followSymbolicLinks, signal } = options;
  /** @type {string[]} */
  const results = [];

  /**
   * @param {string} dirPath
   * @returns {Promise<void>}
   */
  async function walk (dirPath) {
    signal?.throwIfAborted();

    /** @type {import('node:fs').Dir | undefined} */
    let dir;

    try {
      dir = await opendir(dirPath);
    } catch (err) {
      if (errorFilter?.(/** @type {NodeJS.ErrnoException} */ (err))) return;
      throw err;
    }

    try {
      for await (const dirent of dir) {
        const fullPath = path.join(dirPath, dirent.name);

        /** @type {WalkEntry} */
        const entry = { path: fullPath, dirent };

        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fullPath is derived from walked directory
        const resolvedStat = followSymbolicLinks && dirent.isSymbolicLink() ? await stat(fullPath).catch(() => {}) : undefined;
        const isDir = dirent.isDirectory() || resolvedStat?.isDirectory();

        if (isDir) {
          if (await deepFilter(entry)) {
            await walk(fullPath);
          }
        } else if (await entryFilter(entry)) {
          results.push(fullPath);
        }
      }
    } finally {
      await dir.close().catch(() => {});
    }
  }

  await walk(basePath);

  return results.sort();
}
