'use strict'

const test = require('ava').default
const { wrapCommandError } = require('../lib/errors')

test('wrapCommandError preserves structured command details', (t) => {
  const cause = new Error('boom')
  cause.exitCode = 7
  cause.stdout = 'out'
  cause.stderr = 'err'

  const err = wrapCommandError('hdiutil', ['create', 'out.dmg'], cause)

  t.is(err.code, 'APPDMG_COMMAND_FAILED')
  t.is(err.cause, cause)
  t.deepEqual(err.details, {
    command: 'hdiutil',
    args: ['create', 'out.dmg'],
    exitCode: 7,
    stdout: 'out',
    stderr: 'err'
  })
})
