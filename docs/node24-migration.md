# Node.js 24 migration and v1.0.0 release notes

This document records the first-stage modernization contract for the appdmg
Node.js 24 release. It is written for maintainers and package consumers who are
moving from the original unscoped `appdmg` package to the appdmg-owned scoped
packages.

## Package names

The maintained packages now live under the `@appdmg` npm scope.

| Old surface | New surface | Notes |
| --- | --- | --- |
| `appdmg` package | `@appdmg/appdmg` | Library package. Owns JSON parsing and DMG generation. |
| `appdmg` executable | `appdmg-cli` from `@appdmg/cli` | No `appdmg` compatibility alias is provided. |
| helper packages from old dependency tree | `@appdmg/*` helper packages where needed | Helpers are scoped only when appdmg needs release control. |

The v1.0.0 line intentionally starts a new dependency tree. It does not try to
publish compatibility bridge packages for unscoped names that the appdmg
organization does not control.

## Runtime and module format

- Node.js `>=24` is required.
- CommonJS remains the module format for this stage.
- Packages should install on non-Darwin platforms when dependencies allow it.
- Actual DMG creation remains Darwin-only because it calls macOS tools such as
  `hdiutil`, `tiffutil`, `bless`, and optionally `codesign`.

On non-Darwin platforms, `@appdmg/appdmg` fails early with
`APPDMG_UNSUPPORTED_PLATFORM` before trying to create a disk image.

## CLI migration

Install the CLI package:

```sh
npm install --global @appdmg/cli
```

Run the new executable:

```sh
appdmg-cli <json-path> <dmg-path>
```

The positional argument contract is unchanged: the first argument is the JSON
specification path and the second argument is the output DMG path.

Output behavior is intentionally strict:

- stdout remains empty;
- human-readable output goes to stderr;
- `--quiet` suppresses progress, success, and error output, so the exit code is
  the only result signal;
- `--verbose` prints detailed diagnostics on failure and wins over `--quiet`;
- `--help` and `--version` are supported.

`@appdmg/cli` depends on `@appdmg/appdmg` with an exact version. The CLI is a
thin wrapper and does not own JSON parsing or schema behavior.

## Library migration

Install the library package:

```sh
npm install @appdmg/appdmg
```

The primary API remains the `appdmg(options)` function returning an
EventEmitter:

```js
const appdmg = require('@appdmg/appdmg')

const image = appdmg({
  source: 'appdmg.json',
  target: 'Example.dmg'
})

image.on('progress', (info) => {})
image.on('finish', () => {})
image.on('error', (err) => {})
```

Named exports are also available:

```js
const { appdmg, schema, AppDmgError } = require('@appdmg/appdmg')
```

The following public behavior is preserved:

- `appdmg({ source, target })`;
- `appdmg({ basepath, specification, target })`;
- `progress`, `finish`, and `error` events;
- progress payload fields `type`, `current`, `total`, `title`, and `status`;
- existing JSON specification format;
- legacy JSON conversion.

Exact progress step count, step titles, and internal step order are not public
compatibility guarantees.

## JSON schema and validation

`@appdmg/appdmg` exports the JSON Schema as public API:

```js
const schema = require('@appdmg/appdmg/schema.json')
```

The schema dialect is JSON Schema 2020-12.

Runtime validation is deliberately smaller than full JSON Schema validation in
v1.0.0. The library performs minimum operational checks so failures happen
early and produce stable errors:

- required operational fields;
- basic data types;
- non-empty required strings;
- NUL-byte rejection for strings;
- array and object shape checks needed by the DMG pipeline.

The first stage does not add a runtime schema validator such as Ajv and does not
invent arbitrary maximum string lengths without macOS API evidence.

## Error codes

Appdmg-owned failures use stable `.code` values.

Current public codes:

- `APPDMG_INVALID_OPTIONS`
- `APPDMG_UNSUPPORTED_PLATFORM`
- `APPDMG_SOURCE_NOT_FOUND`
- `APPDMG_INVALID_JSON`
- `APPDMG_INVALID_SPEC`
- `APPDMG_TARGET_EXISTS`
- `APPDMG_FILE_NOT_FOUND`
- `APPDMG_COMMAND_FAILED`

Command failures are wrapped as `APPDMG_COMMAND_FAILED` and include structured
details for the command, arguments, exit code, stdout, and stderr when
available.

## Dependency and release status

The package rewrite removes old utility dependencies where Node.js 24 provides
the behavior directly, including callback orchestration, temporary directory
helpers, simple path-existence helpers, and CLI argument parsing.

The scoped release chain is:

1. `@appdmg/bplist-creator`
2. `@appdmg/tn1150`
3. `@appdmg/macos-alias`
4. `@appdmg/ds-store`
5. `@appdmg/appdmg`
6. `@appdmg/cli`

Before publishing the final CLI to npm, verify that each scoped helper package
is available from npm at the intended version and that a clean install of
`@appdmg/cli` resolves only npm-published artifacts.

The npm release process is documented in
[npm-publishing.md](npm-publishing.md). Packages must be published from GitHub
Actions with provenance and package artifact attestations.

## Test coverage

The rewrite is backed by AVA tests.

Cross-platform unit tests cover option parsing, JSON parsing, legacy
conversion, minimum validation, stable errors, EventEmitter behavior, CLI
argument handling, quiet/verbose output, and non-Darwin fail-fast behavior.

macOS integration tests create real DMGs with `hdiutil`, mount them, inspect
their contents and Finder metadata files, and detach them. This replaces the
old default screenshot-comparison path for release confidence.
