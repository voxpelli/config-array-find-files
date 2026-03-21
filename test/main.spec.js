import path from 'node:path';

import { ConfigArray } from '@eslint/config-array';
import chai from 'chai';
import chaiString from 'chai-string';
import { dirname } from 'desm';

import { configArrayFindFiles } from '../index.js';

chai.use(chaiString);

chai.should();

/**
 * @param {string} basePath
 * @returns {Promise<import('@eslint/config-array').ConfigArray>}
 */
async function createTestConfigs (basePath) {
  const configs = new ConfigArray([
    { files: ['*.js'] },
    { files: ['*.md'] },
  ], { basePath });

  await configs.normalize();

  return configs;
}

/**
 * @param {string[]} filePaths
 */
function assertExpectedFiles (filePaths) {
  filePaths[0]?.should.endWith('CHANGELOG.md');
  filePaths[1]?.should.endWith('README.md');
  filePaths[2]?.should.endWith('eslint.config.js');
  filePaths[3]?.should.endWith('index.js');

  filePaths.should.have.length(4);
}

describe('configArrayFindFiles', () => {
  /** @type {string} */
  let basePath;

  before(() => {
    basePath = path.join(dirname(import.meta.url), '../');
  });

  it('should find files with configs', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath,
      configs,
    });

    assertExpectedFiles(filePaths);
  });

  it('should find files with sync configLoader', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath,
      configLoader: {
        isDirectoryIgnored: (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
        getConfig: (/** @type {string} */ p) => configs.getConfig(p),
      },
    });

    assertExpectedFiles(filePaths);
  });

  it('should find files with async configLoader', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath,
      configLoader: {
        isDirectoryIgnored: async (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
        getConfig: async (/** @type {string} */ p) => configs.getConfig(p),
      },
    });

    assertExpectedFiles(filePaths);
  });

  it('should return empty array for non-existent basePath', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath: path.join(basePath, 'non-existent-directory'),
      configs,
    });

    filePaths.should.have.length(0);
  });

  it('should return empty array when basePath is a file', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath: path.join(basePath, 'index.js'),
      configs,
    });

    filePaths.should.have.length(0);
  });

  it('should respect deepFilter with configs', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath,
      configs,
      deepFilter: (entry) => !entry.path.includes('node_modules'),
    });

    assertExpectedFiles(filePaths);
  });

  it('should respect entryFilter with configs', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath,
      configs,
      entryFilter: (entry) => entry.path.endsWith('.js'),
    });

    filePaths.should.have.length(2);
    filePaths[0]?.should.endWith('eslint.config.js');
    filePaths[1]?.should.endWith('index.js');
  });

  it('should respect deepFilter with configLoader', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath,
      configLoader: {
        isDirectoryIgnored: (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
        getConfig: (/** @type {string} */ p) => configs.getConfig(p),
      },
      deepFilter: (entry) => !entry.path.includes('node_modules'),
    });

    assertExpectedFiles(filePaths);
  });

  it('should respect entryFilter with configLoader', async () => {
    const configs = await createTestConfigs(basePath);

    const filePaths = await configArrayFindFiles({
      basePath,
      configLoader: {
        isDirectoryIgnored: (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
        getConfig: (/** @type {string} */ p) => configs.getConfig(p),
      },
      entryFilter: (entry) => entry.path.endsWith('.js'),
    });

    filePaths.should.have.length(2);
    filePaths[0]?.should.endWith('eslint.config.js');
    filePaths[1]?.should.endWith('index.js');
  });

  it('should throw TypeError when neither configs nor configLoader provided', async () => {
    try {
      await configArrayFindFiles({
        basePath,
      });
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
        basePath,
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
    const configs = await createTestConfigs(basePath);
    const error = new Error('getConfig failed');

    try {
      await configArrayFindFiles({
        basePath,
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
});
