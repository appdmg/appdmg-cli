# @appdmg/cli

Command line interface for `@appdmg/appdmg`.

This package provides the Node.js 24+ replacement command for the original
unscoped `appdmg` executable. The command is intentionally named
`appdmg-cli`; there is no `appdmg` compatibility alias.

See [../../docs/node24-migration.md](../../docs/node24-migration.md) for the
v1.0.0 migration and release notes.

## Installation

```sh
npm install --global @appdmg/cli
```

## Usage

```sh
appdmg-cli <json-path> <dmg-path>
```

- `json-path`: path to the JSON specification file
- `dmg-path`: path where the final DMG should be written

The command writes human-readable output to stderr and writes nothing to
stdout in this first stage.

DMG creation is supported on Darwin only. On other platforms the CLI can be
installed and argument parsing can run, but generation exits with the library
platform error before calling macOS tools.

## Options

- `--help`: print usage
- `--version`: print the CLI package version
- `--quiet`: suppress progress, success, and error output; the exit code is the
  only result signal
- `--verbose`, `-v`: print verbose diagnostics; this wins over `--quiet` on
  failures

All user-facing output goes to stderr. stdout is reserved and remains empty.

## Library Dependency

`@appdmg/cli` depends on `@appdmg/appdmg` with an exact version. The CLI does
not parse the JSON specification itself; it passes `{ source, target }` to the
library so JSON loading, legacy conversion, schema ownership, validation,
events, and DMG generation stay in one public API.
