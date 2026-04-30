# @appdmg/cli

Command line interface for `@appdmg/appdmg`.

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

## Options

- `--help`: print usage
- `--version`: print the CLI package version
- `--quiet`: suppress progress, success, and error output
- `--verbose`, `-v`: print verbose diagnostics; this wins over `--quiet`
