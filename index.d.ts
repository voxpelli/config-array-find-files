export { asyncWalk } from './lib/async-walk.js';
export type { WalkEntry, AsyncWalkOptions } from './lib/async-walk.js';

export interface ConfigLoader {
  isDirectoryIgnored(dirPath: string): boolean | Promise<boolean>;
  getConfig(filePath: string): object | undefined | Promise<object | undefined>;
}

export function configsToLoader(configs: import('@eslint/config-array').ConfigArray): ConfigLoader;

export function configArrayFindFiles(options: {
  basePath: string;
  configs?: import('@eslint/config-array').ConfigArray;
  configLoader?: ConfigLoader;
  deepFilter?: (entry: import('./lib/async-walk.js').WalkEntry) => boolean;
  entryFilter?: (entry: import('./lib/async-walk.js').WalkEntry) => boolean;
  followSymbolicLinks?: boolean;
  signal?: AbortSignal;
  errorFilter?: (error: NodeJS.ErrnoException) => boolean;
}): Promise<string[]>;
