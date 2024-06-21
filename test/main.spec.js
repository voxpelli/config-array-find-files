import path from 'node:path';

import { ConfigArray } from '@eslint/config-array';
import chai from 'chai';
import chaiString from 'chai-string';
import { dirname } from 'desm';

import { configArrayFindFiles } from '../index.js';

chai.use(chaiString);

chai.should();

describe('configArrayFindFiles', () => {
  it('should work', async () => {
    const configs = new ConfigArray([
      { files: ['*.js'] },
      { files: ['*.md'] },
    ]);

    await configs.normalize();

    const filePaths = await configArrayFindFiles({
      basePath: path.join(dirname(import.meta.url), '../'),
      configs,
    });

    filePaths[0]?.should.endWith('README.md');
    filePaths[1]?.should.endWith('eslint.config.js');
    filePaths[2]?.should.endWith('index.js');

    filePaths.should.have.length(3);
  });
});
