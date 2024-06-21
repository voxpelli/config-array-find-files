import fswalk from '@nodelib/fs.walk';

/**
 * Searches a directory looking for matching files. This uses the config
 * array's logic to determine if a directory or file should be ignored.
 *
 * Derived from {@link https://github.com/eslint/eslint/blob/d2d06f7a70d9b96b125ecf2de8951bea549db4da/lib/eslint/eslint-helpers.js#L217-L382|ESLint globSearch()}
 *
 * @param {Object} options The options for this function.
 * @param {string} options.basePath The directory to search.
 * @param {import('@eslint/config-array').ConfigArray} options.configs The config array to use for determining what to ignore.
 * @param {import('@nodelib/fs.walk').DeepFilterFunction} [options.deepFilter] Optional function that indicates whether the directory will be read deep or not.
 * @param {import('@nodelib/fs.walk').EntryFilterFunction} [options.entryFilter] Optional function that indicates whether the entry will be included to results or not.
 * @returns {Promise<Array<string>>} An array of matching file paths or an empty array if there are no matches.
 */
export async function configArrayFindFiles (options) {
  const {
    basePath,
    configs,
    deepFilter,
    entryFilter,
  } = options;

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
        deepFilter: wrapFilter(entry => {
          if (deepFilter && !deepFilter(entry)) {
            return false;
          }
          return !configs.isDirectoryIgnored(entry.path);
        }),
        entryFilter: wrapFilter(entry => {
          // entries may be directories or files so filter out directories
          if (entry.dirent.isDirectory()) {
            return false;
          }
          if (entryFilter && !entryFilter(entry)) {
            return false;
          }
          return configs.getConfig(entry.path) !== undefined;
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
