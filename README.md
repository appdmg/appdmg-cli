# @appdmg/appdmg

Node.js library for generating macOS DMG installer images.

This is the Node.js 24+ CommonJS modernization of the original `appdmg`
library. The first stage keeps the JSON format and the EventEmitter API while
moving the maintained package under the `@appdmg` npm scope.

## Installation

```sh
npm install @appdmg/appdmg
```

## API

```javascript
const appdmg = require('@appdmg/appdmg')

const image = appdmg({
  source: 'appdmg.json',
  target: 'Example.dmg'
})

image.on('progress', (info) => {
  // info.type is "step-begin" or "step-end".
  // step-begin includes info.title.
  // step-end includes info.status: "ok", "skip", or "error".
  // info.current and info.total describe progress through the pipeline.
})

image.on('finish', () => {
  // The DMG was created.
})

image.on('error', (err) => {
  // err.code is stable for appdmg-owned failures.
})
```

You can also pass a specification object directly:

```javascript
const image = appdmg({
  target: 'Example.dmg',
  basepath: __dirname,
  specification: {
    title: 'Example',
    contents: [
      { x: 448, y: 344, type: 'link', path: '/Applications' },
      { x: 192, y: 344, type: 'file', path: 'Example.app' }
    ]
  }
})
```

The package also exposes named helpers:

```javascript
const { appdmg, schema, AppDmgError } = require('@appdmg/appdmg')
```

`schema` is the exported JSON Schema 2020-12 document. It is public API, but
runtime validation is intentionally limited to basic data type and required
field checks in this stage.

## JSON Specification

Paths are resolved relative to the JSON file path, or relative to `basepath`
when using the direct `specification` API.

```json
{
  "title": "Example",
  "icon": "Example.icns",
  "background": "Background.png",
  "contents": [
    { "x": 448, "y": 344, "type": "link", "path": "/Applications" },
    { "x": 192, "y": 344, "type": "file", "path": "Example.app" }
  ]
}
```

The legacy `0.1.x` JSON format is still parsed by the library and converted
before planning the image.

## Platform Support

DMG creation requires macOS and fails early with
`APPDMG_UNSUPPORTED_PLATFORM` elsewhere. Parser, schema, validation, planning,
and error behavior are unit-tested without requiring macOS-specific tools.

## Error Codes

Stable appdmg-owned error codes include:

- `APPDMG_INVALID_OPTIONS`
- `APPDMG_UNSUPPORTED_PLATFORM`
- `APPDMG_SOURCE_NOT_FOUND`
- `APPDMG_INVALID_JSON`
- `APPDMG_INVALID_SPEC`
- `APPDMG_TARGET_EXISTS`
- `APPDMG_FILE_NOT_FOUND`
- `APPDMG_COMMAND_FAILED`
