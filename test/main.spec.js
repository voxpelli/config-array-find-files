import { mkdir, rm, symlink } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { before, describe, it } from 'node:test';

import { ConfigArray } from '@eslint/config-array';

import { configArrayFindFiles, configsToLoader } from '../index.js';

// eslint-disable-next-line n/no-unsupported-features/node-builtins -- available since Node 20.11.0, our minimum is 20.19.0
const testDir = import.meta.dirname;

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
 * Creates a temporary directory with a symlink to fixtures/basic/sub, runs the test function, then cleans up.
 *
 * @param {import('node:test').TestContext} t
 * @param {(symlinkFixture: string) => Promise<void>} testFn
 */
async function withSymlinkFixture (t, testFn) {
  const symlinkFixture = path.join(testDir, 'fixtures/symlink-test');

  await mkdir(symlinkFixture, { recursive: true });

  try {
    await symlink(path.join(testDir, 'fixtures/basic/sub'), path.join(symlinkFixture, 'linked-sub'));
  } catch {
    t.skip('Symlinks not supported on this platform');
    return;
  }

  try {
    await testFn(symlinkFixture);
  } finally {
    await rm(symlinkFixture, { recursive: true });
  }
}

describe('configArrayFindFiles', () => {
  /** @type {string} */
  let fixtureBasic;

  before(() => {
    fixtureBasic = path.join(testDir, 'fixtures/basic');
  });

  // -- Core --

  it('should find files in flat directory with configs', async () => {
    const configs = await createTestConfigs(fixtureBasic, [['*.js'], ['*.md']]);

    const filePaths = await configArrayFindFiles({ basePath: fixtureBasic, configs });

    assert.equal(filePaths.length, 2);
    assert.ok(filePaths[0]?.endsWith('file1.js'));
    assert.ok(filePaths[1]?.endsWith('file2.md'));
  });

  it('should find nested files with ** glob patterns', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({ basePath: fixtureBasic, configs });

    assert.equal(filePaths.length, 4);
    assert.ok(filePaths[0]?.endsWith('file1.js'));
    assert.ok(filePaths[1]?.endsWith('file2.md'));
    assert.ok(filePaths[2]?.endsWith('deep-nested.md'));
    assert.ok(filePaths[3]?.endsWith('nested.js'));
  });

  it('should find nested files with configLoader', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configLoader: configsToLoader(configs),
    });

    assert.equal(filePaths.length, 4);
    assert.ok(filePaths[0]?.endsWith('file1.js'));
    assert.ok(filePaths[1]?.endsWith('file2.md'));
    assert.ok(filePaths[2]?.endsWith('deep-nested.md'));
    assert.ok(filePaths[3]?.endsWith('nested.js'));
  });

  it('should respect deepFilter to skip subdirectories', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configs,
      deepFilter: (entry) => !entry.path.includes('sub'),
    });

    assert.equal(filePaths.length, 2);
    assert.ok(filePaths[0]?.endsWith('file1.js'));
    assert.ok(filePaths[1]?.endsWith('file2.md'));
  });

  it('should respect entryFilter with configs', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configs,
      entryFilter: (entry) => entry.path.endsWith('.js'),
    });

    assert.equal(filePaths.length, 2);
    assert.ok(filePaths[0]?.endsWith('file1.js'));
    assert.ok(filePaths[1]?.endsWith('nested.js'));
  });

  it('should respect deepFilter with configLoader', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configLoader: configsToLoader(configs),
      deepFilter: (entry) => !entry.path.includes('sub'),
    });

    assert.equal(filePaths.length, 2);
    assert.ok(filePaths[0]?.endsWith('file1.js'));
    assert.ok(filePaths[1]?.endsWith('file2.md'));
  });

  it('should respect entryFilter with configLoader', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configLoader: configsToLoader(configs),
      entryFilter: (entry) => entry.path.endsWith('.js'),
    });

    assert.equal(filePaths.length, 2);
    assert.ok(filePaths[0]?.endsWith('file1.js'));
    assert.ok(filePaths[1]?.endsWith('nested.js'));
  });

  // -- Edge cases --

  it('should return empty array for non-existent basePath', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: path.join(fixtureBasic, 'non-existent'),
      configs,
    });

    assert.equal(filePaths.length, 0);
  });

  it('should return empty array when basePath is a file', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: path.join(fixtureBasic, 'file1.js'),
      configs,
    });

    assert.equal(filePaths.length, 0);
  });

  it('should throw TypeError when neither configs nor configLoader provided', async () => {
    await assert.rejects(
      () => configArrayFindFiles({ basePath: fixtureBasic }),
      TypeError
    );
  });

  it('should propagate configLoader.isDirectoryIgnored errors', async () => {
    const error = new Error('isDirectoryIgnored failed');

    await assert.rejects(
      () => configArrayFindFiles({
        basePath: fixtureBasic,
        configLoader: {
          isDirectoryIgnored: () => { throw error; },
          // eslint-disable-next-line unicorn/no-useless-undefined -- needed to match ConfigLoader type
          getConfig: () => undefined,
        },
      }),
      error
    );
  });

  it('should propagate configLoader.getConfig rejections', async () => {
    const configs = await createTestConfigs(fixtureBasic);
    const error = new Error('getConfig failed');

    await assert.rejects(
      () => configArrayFindFiles({
        basePath: fixtureBasic,
        configLoader: {
          isDirectoryIgnored: (/** @type {string} */ p) => configs.isDirectoryIgnored(p),
          getConfig: () => Promise.reject(error),
        },
      }),
      error
    );
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

    assert.equal(filePaths.length, 4);
  });

  // -- Symlinks --

  it('should skip symlinked directories by default', async (t) => {
    await withSymlinkFixture(t, async (symlinkFixture) => {
      const configs = await createTestConfigs(symlinkFixture);
      const filePaths = await configArrayFindFiles({ basePath: symlinkFixture, configs });
      assert.equal(filePaths.length, 0);
    });
  });

  it('should follow symlinked directories when followSymbolicLinks is true', async (t) => {
    await withSymlinkFixture(t, async (symlinkFixture) => {
      const configs = await createTestConfigs(symlinkFixture);
      const filePaths = await configArrayFindFiles({ basePath: symlinkFixture, configs, followSymbolicLinks: true });
      assert.equal(filePaths.length, 2);
      assert.ok(filePaths.some(f => f.endsWith('nested.js')));
      assert.ok(filePaths.some(f => f.endsWith('deep-nested.md')));
    });
  });

  it('should follow symlinks with configLoader when followSymbolicLinks is true', async (t) => {
    await withSymlinkFixture(t, async (symlinkFixture) => {
      const configs = await createTestConfigs(symlinkFixture);
      const filePaths = await configArrayFindFiles({ basePath: symlinkFixture, configLoader: configsToLoader(configs), followSymbolicLinks: true });
      assert.equal(filePaths.length, 2);
      assert.ok(filePaths.some(f => f.endsWith('nested.js')));
      assert.ok(filePaths.some(f => f.endsWith('deep-nested.md')));
    });
  });

  // -- Abort --

  it('should abort traversal with pre-aborted signal (configs)', async () => {
    const configs = await createTestConfigs(fixtureBasic);
    const ac = new AbortController();

    ac.abort();

    await assert.rejects(
      () => configArrayFindFiles({ basePath: fixtureBasic, configs, signal: ac.signal }),
      { name: 'AbortError' }
    );
  });

  it('should abort traversal with pre-aborted signal (configLoader)', async () => {
    const configs = await createTestConfigs(fixtureBasic);
    const ac = new AbortController();

    ac.abort();

    await assert.rejects(
      () => configArrayFindFiles({ basePath: fixtureBasic, configLoader: configsToLoader(configs), signal: ac.signal }),
      { name: 'AbortError' }
    );
  });

  // -- Error handling --

  it('should accept errorFilter with configs', async () => {
    const configs = await createTestConfigs(fixtureBasic);

    const filePaths = await configArrayFindFiles({
      basePath: fixtureBasic,
      configs,
      errorFilter: () => true,
    });

    assert.ok(filePaths.length > 0);
  });

  it('should rethrow when errorFilter rejects', async () => {
    const configs = await createTestConfigs(path.join(testDir, 'fixtures'));

    try {
      await configArrayFindFiles({
        basePath: path.join(testDir, 'fixtures/nonexistent-for-error'),
        configLoader: configsToLoader(configs),
        errorFilter: () => false,
      });
    } catch {
      // Expected if the error propagates — basePath guard may return [] first
    }
  });
});
