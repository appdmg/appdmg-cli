'use strict'

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('ava').default

const appdmg = require('../')
const { parseOptions } = require('../lib/options')
const { normalizeSpecification } = require('../lib/spec/load')
const { validateSpecification } = require('../lib/spec/validate')

test('exports named appdmg function and JSON Schema 2020-12 schema', (t) => {
  t.is(appdmg.appdmg, appdmg)
  t.is(typeof appdmg.schema, 'object')
  t.is(appdmg.schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
})

test('parseOptions accepts source path contract', (t) => {
  const parsed = parseOptions({
    source: 'spec.json',
    target: 'out.dmg'
  })

  t.true(path.isAbsolute(parsed.source))
  t.true(path.isAbsolute(parsed.target))
  t.false(parsed.hasSpecification)
})

test('parseOptions rejects ambiguous input contracts with stable code', (t) => {
  const err = t.throws(() => parseOptions({
    source: 'spec.json',
    target: 'out.dmg',
    basepath: '.',
    specification: {}
  }))

  t.is(err.code, 'APPDMG_INVALID_OPTIONS')
})

test('legacy specifications are converted in the library', (t) => {
  const converted = normalizeSpecification({
    title: 'Legacy',
    app: 'Example.app',
    icons: {
      size: 96,
      alias: [448, 344],
      app: [192, 344]
    },
    extra: [
      ['Readme.txt', 512, 128]
    ]
  })

  t.deepEqual(converted.contents, [
    { x: 448, y: 344, type: 'link', path: '/Applications' },
    { x: 192, y: 344, type: 'file', path: 'Example.app' },
    { x: 512, y: 128, type: 'file', path: 'Readme.txt' }
  ])
  t.is(converted['icon-size'], 96)
})

test('minimum validation rejects bad content types', (t) => {
  const err = t.throws(() => validateSpecification({
    title: 'Invalid',
    contents: [
      { x: 1, y: 2, type: 'wat', path: 'Example.app' }
    ]
  }))

  t.is(err.code, 'APPDMG_INVALID_SPEC')
  t.deepEqual(err.details.errors, [
    'contents[0].type must be one of: link, file, position'
  ])
})

test('appdmg fails early on non-Darwin without touching the target', async (t) => {
  const tmpDir = await makeTempDir(t)
  const target = path.join(tmpDir, 'out.dmg')
  const source = path.join(tmpDir, 'missing.json')

  const err = await waitForError(appdmg({ source, target }, { platform: 'linux' }))

  t.is(err.code, 'APPDMG_UNSUPPORTED_PLATFORM')
  await t.throwsAsync(fs.stat(target), { code: 'ENOENT' })
})

test('appdmg returns an EventEmitter and emits legacy progress events', async (t) => {
  const tmpDir = await makeTempDir(t)
  const sourceFile = path.join(tmpDir, 'Example.app')
  const mountPath = path.join(tmpDir, 'mounted')
  const target = path.join(tmpDir, 'out.dmg')
  const progress = []

  await fs.mkdir(sourceFile)
  await fs.mkdir(mountPath)

  const ee = appdmg({
    target,
    basepath: tmpDir,
    specification: {
      title: 'Example',
      contents: [
        { x: 192, y: 344, type: 'file', path: 'Example.app' },
        { x: 448, y: 344, type: 'link', path: '/Applications' }
      ]
    }
  }, {
    platform: 'darwin',
    commands: fakeCommands(t, mountPath, target)
  })

  t.is(typeof ee.on, 'function')

  ee.on('progress', (info) => {
    progress.push(info)
  })

  await waitForFinish(ee)

  t.true(progress.some((info) => info.type === 'step-begin' && info.title === 'Looking for target'))
  t.true(progress.some((info) => info.type === 'step-end' && info.status === 'ok'))
  t.true((await fs.stat(target)).isFile())
  t.true((await fs.stat(path.join(mountPath, 'Example.app'))).isDirectory())
  t.true((await fs.lstat(path.join(mountPath, 'Applications'))).isSymbolicLink())
  t.true((await fs.stat(path.join(mountPath, '.DS_Store'))).isFile())
})

function fakeCommands (t, mountPath, targetPath) {
  const calls = []

  t.context.calls = calls

  return {
    async run (command, args) {
      calls.push({ command, args })

      if (command === 'du') {
        return { stdout: '1\tfixture\n', stderr: '' }
      }

      if (command === 'hdiutil' && args[0] === 'create') {
        await fs.writeFile(args[1], '')
        return { stdout: '', stderr: '' }
      }

      if (command === 'hdiutil' && args[0] === 'attach') {
        return { stdout: `/dev/disk42\tApple_HFS\t${mountPath}\n`, stderr: '' }
      }

      if (command === 'hdiutil' && args[0] === 'detach') {
        return { stdout: '', stderr: '' }
      }

      if (command === 'hdiutil' && args[0] === 'convert') {
        await fs.writeFile(targetPath, 'fake dmg')
        return { stdout: '', stderr: '' }
      }

      if (command === 'bless') {
        return { stdout: '', stderr: '' }
      }

      throw new Error(`Unexpected fake command: ${command} ${args.join(' ')}`)
    }
  }
}

function waitForFinish (ee) {
  return new Promise((resolve, reject) => {
    ee.once('finish', resolve)
    ee.once('error', reject)
  })
}

function waitForError (ee) {
  return new Promise((resolve) => {
    ee.once('error', resolve)
  })
}

async function makeTempDir (t) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'appdmg-test-'))

  t.teardown(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  return tmpDir
}
