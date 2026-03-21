import { stat } from 'node:fs/promises';

import { asyncWalk as asyncWalkImpl } from './lib/async-walk.js';

export { asyncWalk } from './lib/async-walk.js';

/**
 * @typedef {object} ConfigLoader
 * @property {(dirPath: string) => boolean | Promise<boolean>} isDirectoryIgnored Check if a directory is ignored.
 * @property {(filePath: string) => object | undefined | Promise<object | undefined>} getConfig Get config for a file. Returns undefined if file has no matching config.
 */

/** @typedef {import('./lib/async-walk.js').WalkEntry} WalkEntry */
/** @typedef {import('./lib/async-walk.js').AsyncWalkOptions} AsyncWalkOptions */

/**
 * Wraps a ConfigArray as a ConfigLoader.
 *
 * @param {import('@eslint/config-array').ConfigArray} configs
 * @returns {ConfigLoader}
 */
export function configsToLoader (configs) {
  return {
    isDirectoryIgnored: (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
    getConfig: (/** @type {string} */ p) => configs.getConfig(p),
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
 * @param {(entry: import('./lib/async-walk.js').WalkEntry) => boolean} [options.deepFilter] Optional function that indicates whether the directory will be read deep or not.
 * @param {(entry: import('./lib/async-walk.js').WalkEntry) => boolean} [options.entryFilter] Optional function that indicates whether the entry will be included to results or not.
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

  return asyncWalkImpl({
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
    errorFilter,
    followSymbolicLinks: Boolean(followSymbolicLinks),
    signal,
  });
}
