import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {'ignored' | 'external' | 'unconfigured' | 'matched'} ConfigStatus
 */

/**
 * @typedef {object} ConfigLoader
 * @property {(dirPath: string) => boolean | Promise<boolean>} isDirectoryIgnored Check if a directory is ignored.
 * @property {(filePath: string) => object | undefined | Promise<object | undefined>} getConfig Get config for a file. Returns undefined if file has no matching config.
 * @property {(filePath: string) => ConfigStatus | Promise<ConfigStatus>} [getConfigStatus] Optional. Returns the config status for a file: "ignored", "external", "unconfigured", or "matched".
 */

/**
 * @typedef {object} WalkEntry
 * @property {string} path The full path of the entry.
 * @property {import('node:fs').Dirent} dirent The directory entry.
 * @property {string} name The name of the entry.
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
async function asyncWalk (options) {
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
      if (!errorFilter || errorFilter(/** @type {NodeJS.ErrnoException} */ (err))) return;
      throw err;
    }

    try {
      for await (const dirent of dir) {
        const fullPath = path.join(dirPath, dirent.name);

        /** @type {WalkEntry} */
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
 * Wraps a ConfigArray as a ConfigLoader.
 *
 * @param {import('@eslint/config-array').ConfigArray} configs
 * @returns {ConfigLoader}
 */
function configsToLoader (configs) {
  return {
    isDirectoryIgnored: (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
    getConfig: (/** @type {string} */ p) => configs.getConfig(p),
    getConfigStatus: (/** @type {string} */ p) => /** @type {ConfigStatus} */ (configs.getConfigStatus(p)),
  };
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
 * @param {(entry: WalkEntry) => boolean} [options.deepFilter] Optional function that indicates whether the directory will be read deep or not.
 * @param {(entry: WalkEntry) => boolean} [options.entryFilter] Optional function that indicates whether the entry will be included to results or not.
 * @param {boolean} [options.followSymbolicLinks] Follow symbolic links when walking directories. Default: false.
 * @param {AbortSignal} [options.signal] An AbortSignal to cancel the traversal.
 * @param {(error: NodeJS.ErrnoException) => boolean} [options.errorFilter] Optional function to filter errors during traversal. Return true to skip the error and continue.
 * @returns {Promise<Array<string>>} An array of matching file paths or an empty array if there are no matches.
 */
export async function configArrayFindFiles (options) {
  const {
    basePath,
    configLoader,
    configs,
    deepFilter,
    entryFilter,
    errorFilter,
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

  const loader = configLoader || configsToLoader(/** @type {import('@eslint/config-array').ConfigArray} */ (configs));

  return asyncWalk({
    basePath,
    deepFilter: async (entry) => {
      if (deepFilter && !deepFilter(entry)) {
        return false;
      }
      return !(await loader.isDirectoryIgnored(entry.path));
    },
    entryFilter: async (entry) => {
      if (entry.dirent.isDirectory()) {
        return false;
      }
      if (entryFilter && !entryFilter(entry)) {
        return false;
      }
      return (await loader.getConfig(entry.path)) !== undefined;
    },
    followSymbolicLinks: Boolean(followSymbolicLinks),
    ...(signal ? { signal } : {}),
    ...(errorFilter ? { errorFilter } : {}),
  });
}
