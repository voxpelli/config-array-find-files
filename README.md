# @voxpelli/config-array-find-files

A generic equivalent of ESLint's [`globSearch()`](https://github.com/eslint/eslint/blob/d2d06f7a70d9b96b125ecf2de8951bea549db4da/lib/eslint/eslint-helpers.js#L217-L382) for use with [`ConfigArray`](https://www.npmjs.com/package/@eslint/config-array)

[![npm version](https://img.shields.io/npm/v/@voxpelli/config-array-find-files.svg?style=flat)](https://www.npmjs.com/package/@voxpelli/config-array-find-files)
[![npm downloads](https://img.shields.io/npm/dm/@voxpelli/config-array-find-files.svg?style=flat)](https://www.npmjs.com/package/@voxpelli/config-array-find-files)
[![neostandard javascript style](https://img.shields.io/badge/code_style-neostandard-7fffff?style=flat&labelColor=ff80ff)](https://github.com/neostandard/neostandard)
[![Module type: ESM](https://img.shields.io/badge/module%20type-esm-brightgreen)](https://github.com/voxpelli/badges-cjs-esm)
[![Types in JS](https://img.shields.io/badge/types_in_js-yes-brightgreen)](https://github.com/voxpelli/types-in-js)
[![Follow @voxpelli@mastodon.social](https://img.shields.io/mastodon/follow/109247025527949675?domain=https%3A%2F%2Fmastodon.social&style=social)](https://mastodon.social/@voxpelli)

## Usage

### With a ConfigArray

```javascript
import { ConfigArray } from '@eslint/config-array';
import { configArrayFindFiles } from '@voxpelli/config-array-find-files';

const basePath = new URL('.', import.meta.url).pathname;

const configs = new ConfigArray([
  { files: ['**/*.js'] },
  { files: ['**/*.md'] },
], { basePath });

await configs.normalize();

const filePaths = await configArrayFindFiles({
  basePath,
  configs,
});
```

### With a configLoader

For async per-file config resolution (e.g. ESLint 10's monorepo config lookup), use `configLoader` instead of `configs`:

```javascript
import { configArrayFindFiles } from '@voxpelli/config-array-find-files';

const filePaths = await configArrayFindFiles({
  basePath: '/path/to/project',
  configLoader: {
    isDirectoryIgnored: async (dirPath) => {
      const configs = await loadConfigForDir(dirPath);
      return configs.isDirectoryIgnored(dirPath);
    },
    getConfig: async (filePath) => {
      const configs = await loadConfigForDir(path.dirname(filePath));
      return configs.getConfig(filePath);
    },
  },
});
```

### Cancellable search with AbortSignal

```javascript
const ac = new AbortController();
setTimeout(() => ac.abort(), 5000); // 5s timeout

const filePaths = await configArrayFindFiles({
  basePath,
  configs,
  signal: ac.signal,
});
```

### Following symbolic links

```javascript
const filePaths = await configArrayFindFiles({
  basePath,
  configs,
  followSymbolicLinks: true,
});
```

## API

### configArrayFindFiles()

Searches a directory recursively for files that match the provided configuration, using either a `ConfigArray` or a `configLoader` to determine which files to include and which directories to ignore.

Returns an empty array if `basePath` does not exist or is not a directory.

#### Syntax

```ts
configArrayFindFiles(options) => Promise<string[]>
```

#### Options

Exactly one of `configs` or `configLoader` must be provided.

* `basePath` — `string` — the directory to search
* `configs` — `ConfigArray` — a normalized config array to use for determining what to ignore
* `configLoader` — `ConfigLoader` — an async-capable alternative to `configs` (see below)
* `deepFilter` — optional function that indicates whether the directory will be read deep or not
* `entryFilter` — optional function that indicates whether the entry will be included to results or not
* `errorFilter` — optional function to filter errors during traversal; return `true` to skip the error and continue
* `followSymbolicLinks` — `boolean` — follow symbolic links when walking directories (default: `false`)
* `signal` — `AbortSignal` — cancel the traversal; throws `AbortError` when aborted

#### ConfigLoader

An object with methods for config resolution, all of which may return a value or a `Promise`:

* `isDirectoryIgnored(dirPath: string)` — returns `boolean` — whether the directory should be skipped
* `getConfig(filePath: string)` — returns `object | undefined` — the config for the file, or `undefined` if the file has no matching config

#### Returns

A `Promise` that resolves to an array with `string` file paths for all matching files.

### asyncWalk()

A standalone async directory walker with no config-array dependency. Available as a separate import:

```javascript
import { asyncWalk } from '@voxpelli/config-array-find-files/walk';

const files = await asyncWalk({
  basePath: '/path/to/dir',
  deepFilter: (entry) => !entry.path.includes('node_modules'),
  entryFilter: (entry) => entry.path.endsWith('.js'),
});
```

### configsToLoader()

Wraps a `ConfigArray` as a `ConfigLoader`:

```javascript
import { configsToLoader } from '@voxpelli/config-array-find-files';

const loader = configsToLoader(configs);
```

## Types

TypeScript types are available via JSDoc-generated `.d.ts` files:

```typescript
import type { ConfigLoader, WalkEntry, AsyncWalkOptions } from '@voxpelli/config-array-find-files';
```
