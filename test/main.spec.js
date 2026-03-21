import path from 'node:path';

import { ConfigArray } from '@eslint/config-array';
import chai from 'chai';
import chaiString from 'chai-string';
import { dirname } from 'desm';

import { configArrayFindFiles } from '../index.js';

chai.use(chaiString);

chai.should();

const testDir = dirname(import.meta.url);

/**
 * @param {string} basePath
 * @param {string[][]} [patterns]
 * @returns {Promise<import('@eslint/config-array').ConfigArray>}
 */
async function createTestConfigs (basePath, patterns) {
  const configs = new ConfigArray(
    (patterns || [['**/*.js'], ['**/*.md']]).map(files => ({ files })),
    { basePath }
  );

  await configs.normalize();

  return configs;
}

/**
 * @param {import('@eslint/config-array').ConfigArray} configs
 * @returns {import('../index.js').ConfigLoader}
 */
function toConfigLoader (configs) {
  return {
    isDirectoryIgnored: (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
    getConfig: (/** @type {string} */ p) => configs.getConfig(p),
  };
}

describe('configArrayFindFiles', () => {
  /** @type {string} */
  let fixtureBasic;
  /** @type {string} */
  let projectRoot;

  before(() => {
    fixtureBasic = path.join(testDir, 'fixtures/basic');
    projectRoot = path.join(testDir, '../');
  });

  // -- Fixture-based tests --

  it('should find files in flat directory with configs', async () => {
    const configs = await createTestConfigs(fixtureBasic, [['*.js'], ['*.md']]);

    const filePaths = await configArrayFindFiles({ basePath: fixtureBasic, configs });

    filePaths.should.have.length(2);
    filePaths[0]?.should.endWith('file1.js');
    filePaths[1]?.should.endWith('file2.md');
  });

  it('should find nested files with ** glob patterns', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({ basePath: fixtureBasic, configs });

    filePaths.should.have.length(4);
    filePaths[0]?.should.endWith('file1.js');
    filePaths[1]?.should.endWith('file2.md');
    filePaths[2]?.should.endWith('nested.js');
    filePaths[3]?.should.endWith('deep-nested.md');
  });

  it('should find nested files with configLoader', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configLoader: toConfigLoader(configs),
    });

    filePaths.should.have.length(4);
    filePaths[0]?.should.endWith('file1.js');
    filePaths[1]?.should.endWith('file2.md');
    filePaths[2]?.should.endWith('deep-nested.md');
    filePaths[3]?.should.endWith('nested.js');
  });

  it('should respect deepFilter to skip subdirectories', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configs,
      deepFilter: (entry) => !entry.path.includes('sub'),
    });

    filePaths.should.have.length(2);
    filePaths[0]?.should.endWith('file1.js');
    filePaths[1]?.should.endWith('file2.md');
  });

  it('should respect entryFilter with configs', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configs,
      entryFilter: (entry) => entry.path.endsWith('.js'),
    });

    filePaths.should.have.length(2);
    filePaths[0]?.should.endWith('file1.js');
    filePaths[1]?.should.endWith('nested.js');
  });

  it('should respect deepFilter with configLoader', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configLoader: toConfigLoader(configs),
      deepFilter: (entry) => !entry.path.includes('sub'),
    });

    filePaths.should.have.length(2);
    filePaths[0]?.should.endWith('file1.js');
    filePaths[1]?.should.endWith('file2.md');
  });

  it('should respect entryFilter with configLoader', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configLoader: toConfigLoader(configs),
      entryFilter: (entry) => entry.path.endsWith('.js'),
    });

    filePaths.should.have.length(2);
    filePaths[0]?.should.endWith('file1.js');
    filePaths[1]?.should.endWith('nested.js');
  });
  // -- Edge cases --

  it('should return empty array for non-existent basePath', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: path.join(fixtureBasic, 'non-existent'),
      configs,
    });

    filePaths.should.have.length(0);
  });

  it('should return empty array when basePath is a file', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: path.join(fixtureBasic, 'file1.js'),
      configs,
    });

    filePaths.should.have.length(0);
  });

  it('should throw TypeError when neither configs nor configLoader provided', async () => {
    try {
      await configArrayFindFiles({ basePath: fixtureBasic });
      throw new Error('should have thrown');
    } catch (/** @type {any} */ err) {
      err.should.be.instanceOf(TypeError);
      err.message.should.include('configs');
      err.message.should.include('configLoader');
    }
  });

  it('should propagate configLoader.isDirectoryIgnored errors', async () => {
    const error = new Error('isDirectoryIgnored failed');

    try {
      await configArrayFindFiles({
        basePath: projectRoot,
        configLoader: {
          isDirectoryIgnored: () => { throw error; },
          // eslint-disable-next-line unicorn/no-useless-undefined -- needed to match ConfigLoader type
          getConfig: () => undefined,
        },
      });
      throw new Error('should have thrown');
    } catch (/** @type {any} */ err) {
      err.should.equal(error);
    }
  });

  it('should propagate configLoader.getConfig rejections', async () => {
    const configs = await createTestConfigs(projectRoot);
    const error = new Error('getConfig failed');

    try {
      await configArrayFindFiles({
        basePath: projectRoot,
        configLoader: {
          isDirectoryIgnored: (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
          getConfig: () => Promise.reject(error),
        },
      });
      throw new Error('should have thrown');
    } catch (/** @type {any} */ err) {
      err.should.equal(error);
    }
  });

  it('should find files with async configLoader', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configLoader: {
        isDirectoryIgnored: async (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
        getConfig: async (/** @type {string} */ p) => configs.getConfig(p),
      },
    });

    filePaths.should.have.length(4);
  });
});
