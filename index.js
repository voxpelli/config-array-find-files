import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';

import fswalk from '@nodelib/fs.walk';

/**
 * @typedef {object} ConfigLoader
 * @property {(dirPath: string) => boolean | Promise<boolean>} isDirectoryIgnored Check if a directory is ignored.
 * @property {(filePath: string) => object | undefined | Promise<object | undefined>} getConfig Get config for a file. Returns undefined if file has no matching config.
 */

/**
 * Recursively walks a directory tree, applying async filter functions.
 *
 * @param {string} basePath The directory to walk.
 * @param {(entry: import('@nodelib/fs.walk').Entry) => boolean | Promise<boolean>} deepFilter Filter for directory traversal.
 * @param {(entry: import('@nodelib/fs.walk').Entry) => boolean | Promise<boolean>} entryFilter Filter for file inclusion.
 * @param {boolean} followSymbolicLinks Whether to follow symbolic links.
 * @param {AbortSignal} [signal] An AbortSignal to cancel the traversal.
 * @returns {Promise<string[]>} An array of matching file paths.
 */
async function asyncWalk (basePath, deepFilter, entryFilter, followSymbolicLinks, signal) {
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
    } catch {
      return;
    }

    try {
      for await (const dirent of dir) {
        const fullPath = path.join(dirPath, dirent.name);

        /** @type {import('@nodelib/fs.walk').Entry} */
        const entry = { path: fullPath, dirent, name: dirent.name };

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

/**
 * Searches a directory looking for matching files. This uses the config
 * array's logic to determine if a directory or file should be ignored.
 *
 * Derived from {@link https://github.com/eslint/eslint/blob/d2d06f7a70d9b96b125ecf2de8951bea549db4da/lib/eslint/eslint-helpers.js#L217-L382|ESLint globSearch()}
 *
 * @param {Object} options The options for this function.
 * @param {string} options.basePath The directory to search.
 * @param {import('@eslint/config-array').ConfigArray} [options.configs] The config array to use for determining what to ignore.
 * @param {ConfigLoader} [options.configLoader] A config loader with async-capable isDirectoryIgnored/getConfig methods. Alternative to configs.
 * @param {import('@nodelib/fs.walk').DeepFilterFunction} [options.deepFilter] Optional function that indicates whether the directory will be read deep or not.
 * @param {import('@nodelib/fs.walk').EntryFilterFunction} [options.entryFilter] Optional function that indicates whether the entry will be included to results or not.
 * @param {boolean} [options.followSymbolicLinks] Follow symbolic links when walking directories. Default: false.
 * @param {AbortSignal} [options.signal] An AbortSignal to cancel the traversal.
 * @returns {Promise<Array<string>>} An array of matching file paths or an empty array if there are no matches.
 */
export async function configArrayFindFiles (options) {
  const {
    basePath,
    configLoader,
    configs,
    deepFilter,
    entryFilter,
    followSymbolicLinks,
    signal,
  } = options;

  if (!configs && !configLoader) {
    throw new TypeError('Either "configs" or "configLoader" must be provided');
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- basePath is caller-provided
  const baseStat = await stat(basePath).catch(() => {});

  if (!baseStat?.isDirectory()) {
    return [];
  }

  // Determine the config source — either configLoader or a wrapper around configs
  const resolvedConfigs = configLoader || /** @type {import('./index.js').ConfigLoader} */ ({
    isDirectoryIgnored: (/** @type {string} */ p) => /** @type {import('@eslint/config-array').ConfigArray} */ (configs).isDirectoryIgnored(p),
    getConfig: (/** @type {string} */ p) => /** @type {import('@eslint/config-array').ConfigArray} */ (configs).getConfig(p),
  });

  // Use asyncWalk when configLoader is provided or when followSymbolicLinks is needed
  // (@nodelib/fs.walk doesn't properly traverse into symlinked directories)
  if (configLoader || followSymbolicLinks) {
    return asyncWalk(
      basePath,
      async (entry) => {
        if (deepFilter && !deepFilter(entry)) {
          return false;
        }
        return !(await resolvedConfigs.isDirectoryIgnored(entry.path));
      },
      async (entry) => {
        if (entry.dirent.isDirectory()) {
          return false;
        }
        if (entryFilter && !entryFilter(entry)) {
          return false;
        }
        return (await resolvedConfigs.getConfig(entry.path)) !== undefined;
      },
      Boolean(followSymbolicLinks),
      signal
    );
  }

  /** @type {import('@nodelib/fs.walk').Entry[]} */
  const filePaths = (await new Promise((resolve, reject) => {
    let promiseRejected = false;

    /**
     * Wraps a boolean-returning filter function. The wrapped function will reject the promise if an error occurs.
     *
     * @param {import('@nodelib/fs.walk').DeepFilterFunction | import('@nodelib/fs.walk').EntryFilterFunction} filter A filter function to wrap.
     * @returns {import('@nodelib/fs.walk').DeepFilterFunction | import('@nodelib/fs.walk').EntryFilterFunction} A function similar to the wrapped filter that rejects the promise if an error occurs.
     */
    function wrapFilter (filter) {
      /** @type {import('@nodelib/fs.walk').DeepFilterFunction | import('@nodelib/fs.walk').EntryFilterFunction} */
      const result = (...args) => {
        // No need to run the filter if an error has been thrown.
        if (!promiseRejected) {
          try {
            return filter(...args);
          } catch (err) {
            promiseRejected = true;
            reject(err);
          }
        }
        return false;
      };

      return result;
    }

    fswalk.walk(
      basePath,
      {
        ...(signal ? { signal } : {}),
        deepFilter: wrapFilter(entry => {
          if (deepFilter && !deepFilter(entry)) {
            return false;
          }
          return !resolvedConfigs.isDirectoryIgnored(entry.path);
        }),
        entryFilter: wrapFilter(entry => {
          // entries may be directories or files so filter out directories
          if (entry.dirent.isDirectory()) {
            return false;
          }
          if (entryFilter && !entryFilter(entry)) {
            return false;
          }
          return resolvedConfigs.getConfig(entry.path) !== undefined;
        }),
      },
      (error, entries) => {
        // If the promise is already rejected, calling `resolve` or `reject` will do nothing.
        if (error) {
          reject(error);
        } else {
          resolve(entries);
        }
      }
    );
  }));

  return filePaths.map(entry => entry.path);
}
