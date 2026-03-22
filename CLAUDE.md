# Project: @voxpelli/config-array-find-files

ESLint ConfigArray file-finding utility. ESM, Node.js ^20.19.0 || ^22.13.0 || >=24.

## Testing

- NEVER use `t.plan()` with `node:assert` — it is incompatible
- Run tests: `npm run test:unit`
- Full check + build + test: `npm test`
- After every commit, run `npm run test:unit` to verify nothing is broken
- After any commit that changes build configuration or declaration settings, run `npm test` (full suite including build) before proceeding

## Code Editing Rules

- When using `replace_all` or find-and-replace, verify ALL instances are caught by checking for variant line structures, whitespace differences, and edge cases. Run a grep after replacement to confirm zero remaining instances.
- Do not rename build scripts or remove `clean` from `check` unless explicitly asked. Preserve existing script names and compositions by default.
- Follow DRY/KISS/YAGNI principles for all changes.

## Git Conventions

- Never force-add files over `.gitignore`. If a file is in `.gitignore`, ask before adding it.
- Use conventional commits.

## Build

- Declarations are built with `npm run build:1-declaration` (TypeScript `tsc -p declaration.tsconfig.json`)
- After any config change, verify declarations still build: `npm run build`
