import { voxpelli } from '@voxpelli/eslint-config';

export default [
  ...voxpelli({ noMocha: true, ignores: ['test/fixtures/**'] }),
  {
    files: ['test/**'],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
];
