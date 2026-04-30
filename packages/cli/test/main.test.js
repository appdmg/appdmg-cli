'use strict'

const { EventEmitter } = require('node:events')
const test = require('ava').default
const { main } = require('../lib/main')

test('prints version to stderr and nothing to stdout', async (t) => {
  const io = streams()
  const exitCode = await main({
    argv: ['--version'],
    appdmg: neverCalled(t),
    pkg: { version: '1.2.3' },
    ...io
  })

  t.is(exitCode, 0)
  t.is(io.stdout.text, '')
  t.regex(io.stderr.text, /1\.2\.3/)
})

test('quiet successful run writes no output', async (t) => {
  const io = streams()
  const exitCode = await main({
    argv: ['--quiet', 'spec.json', 'out.dmg'],
    appdmg: successfulAppdmg,
    pkg: { version: '1.0.0' },
    ...io
  })

  t.is(exitCode, 0)
  t.is(io.stdout.text, '')
  t.is(io.stderr.text, '')
})

test('verbose wins over quiet for failures', async (t) => {
  const io = streams()
  const exitCode = await main({
    argv: ['--quiet', '--verbose', 'spec.json', 'out.dmg'],
    appdmg: failingAppdmg,
    pkg: { version: '1.0.0' },
    ...io
  })

  t.is(exitCode, 1)
  t.is(io.stdout.text, '')
  t.regex(io.stderr.text, /Error: nope/)
})

test('successful run renders progress to stderr', async (t) => {
  const io = streams()
  const exitCode = await main({
    argv: ['spec.json', 'out.dmg'],
    appdmg: successfulAppdmg,
    pkg: { version: '1.0.0' },
    ...io
  })

  t.is(exitCode, 0)
  t.is(io.stdout.text, '')
  t.regex(io.stderr.text, /Looking/)
  t.regex(io.stderr.text, /Your image is ready/)
})

function successfulAppdmg () {
  const ee = new EventEmitter()

  process.nextTick(() => {
    ee.emit('progress', { type: 'step-begin', current: 1, total: 1, title: 'Looking' })
    ee.emit('progress', { type: 'step-end', current: 1, total: 1, status: 'ok' })
    ee.emit('finish')
  })

  return ee
}

function failingAppdmg () {
  const ee = new EventEmitter()

  process.nextTick(() => {
    ee.emit('error', new Error('nope'))
  })

  return ee
}

function neverCalled (t) {
  return () => t.fail('appdmg should not be called')
}

function streams () {
  return {
    stdout: stream(),
    stderr: stream()
  }
}

function stream () {
  return {
    text: '',
    isTTY: false,
    write (value) {
      this.text += value
    }
  }
}
