'use strict'

const test = require('ava').default
const { parseCliArgs } = require('../lib/args')

test('parses positional JSON and DMG paths', (t) => {
  const parsed = parseCliArgs(['spec.json', 'out.dmg'])

  t.deepEqual(parsed.positionals, ['spec.json', 'out.dmg'])
  t.false(Boolean(parsed.options.quiet))
})

test('requires json input extension', (t) => {
  const err = t.throws(() => parseCliArgs(['spec.txt', 'out.dmg']))

  t.is(err.message, 'Input must have the .json file extension')
})

test('requires dmg output extension', (t) => {
  const err = t.throws(() => parseCliArgs(['spec.json', 'out.iso']))

  t.is(err.message, 'Output must have the .dmg file extension')
})
