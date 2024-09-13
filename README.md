# @voxpelli/config-array-find-files

A proof of concept of a generic equivalent of ESLint's [`globSearch()`](https://github.com/eslint/eslint/blob/d2d06f7a70d9b96b125ecf2de8951bea549db4da/lib/eslint/eslint-helpers.js#L217-L382) for use with [`ConfigArray`](https://www.npmjs.com/package/@eslint/config-array)

[![npm version](https://img.shields.io/npm/v/@voxpelli/config-array-find-files.svg?style=flat)](https://www.npmjs.com/package/@voxpelli/config-array-find-files)
[![npm downloads](https://img.shields.io/npm/dm/@voxpelli/config-array-find-files.svg?style=flat)](https://www.npmjs.com/package/@voxpelli/config-array-find-files)
[![neostandard javascript style](https://img.shields.io/badge/code_style-neostandard-7fffff?style=flat&labelColor=ff80ff)](https://github.com/neostandard/neostandard)
[![Module type: ESM](https://img.shields.io/badge/module%20type-esm-brightgreen)](https://github.com/voxpelli/badges-cjs-esm)
[![Types in JS](https://img.shields.io/badge/types_in_js-yes-brightgreen)](https://github.com/voxpelli/types-in-js)
[![Follow @voxpelli@mastodon.social](https://img.shields.io/mastodon/follow/109247025527949675?domain=https%3A%2F%2Fmastodon.social&style=social)](https://mastodon.social/@voxpelli)

## Usage

```javascript
import { ConfigArray } from '@eslint/config-array';
import { configArrayFindFiles } from '@voxpelli/config-array-find-files';

// Ensure you have a normalized config at hand...

const configs = new ConfigArray([
  { files: ['*.js'] },
  { files: ['*.md'] },
]);
await configs.normalize();

// ...then you are ready to find some files!

const filePaths = await configArrayFindFiles({
  basePath: path.join(dirname(import.meta.url), '../'),
  configs,
});
```

## API

### configArrayFindFiles()

Takes a value (`input`), does something configured by the config (`configParam`) and returns the processed value asyncly(`output`)

#### Syntax

```ts
configArrayFindFiles(options) => Promise<string[]>
```

#### Options

* `basePath` - the directory to search
* `configs` - the config array to use for determining what to ignore
* `deepFilter` - optional function that indicates whether the directory will be read deep or not
* `entryFilter` - optional function that indicates whether the entry will be included to results or not

#### Returns

A `Promise` that resolves to an array with `string` file paths for all matching files

