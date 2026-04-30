'use strict'

const { execFile } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')
const test = require('ava').default

const appdmg = require('../..')
const { parseMountPath } = require('../../lib/darwin/hdiutil')

const execFileAsync = promisify(execFile)
const macOSTest = process.platform === 'darwin' ? test.serial : test.skip

macOSTest('creates and inspects a modern DMG specification', async (t) => {
  const tmpDir = await makeTempDir(t)
  const target = path.join(tmpDir, 'modern.dmg')

  await waitForImage(appdmg({
    source: assetPath('appdmg.json'),
    target
  }))

  t.is(await imageFormat(target), 'UDZO')

  await withMountedImage(target, async (mountPath) => {
    t.regex(path.basename(mountPath), /^Test Title( \d+)?$/)
    t.true((await fs.stat(path.join(mountPath, 'TestApp.app'))).isDirectory())
    t.is(await fs.readFile(path.join(mountPath, 'TestDoc.txt'), 'utf8'), 'This is just a test.\n')
    t.is(await fs.readlink(path.join(mountPath, 'Applications')), '/Applications')
    t.true((await fs.stat(path.join(mountPath, '.background', 'TestBkg.tiff'))).isFile())
    t.true((await fs.stat(path.join(mountPath, '.DS_Store'))).isFile())
    t.true((await fs.stat(path.join(mountPath, '.VolumeIcon.icns'))).isFile())
  })
})

macOSTest('keeps legacy JSON input support', async (t) => {
  const tmpDir = await makeTempDir(t)
  const target = path.join(tmpDir, 'legacy.dmg')

  await waitForImage(appdmg({
    source: assetPath('appdmg-legacy.json'),
    target
  }))

  t.is(await imageFormat(target), 'UDZO')

  await withMountedImage(target, async (mountPath) => {
    t.true((await fs.stat(path.join(mountPath, 'TestApp.app'))).isDirectory())
    t.is(await fs.readlink(path.join(mountPath, 'Applications')), '/Applications')
  })
})

macOSTest('creates a DMG with custom names and explicit format', async (t) => {
  const tmpDir = await makeTempDir(t)
  const target = path.join(tmpDir, 'custom.dmg')

  await waitForImage(appdmg({
    target,
    basepath: assetPath('.'),
    specification: {
      title: 'Custom Names',
      format: 'UDRO',
      background: 'TestBkg.png',
      contents: [
        { x: 448, y: 344, type: 'link', path: '/Applications', name: 'System Apps' },
        { x: 192, y: 344, type: 'file', path: 'TestApp.app', name: 'My Nice App.app' },
        { x: 512, y: 128, type: 'file', path: 'TestDoc.txt', name: 'Documentation.txt' }
      ]
    }
  }))

  t.is(await imageFormat(target), 'UDRO')

  await withMountedImage(target, async (mountPath) => {
    t.is(await fs.readlink(path.join(mountPath, 'System Apps')), '/Applications')
    t.true((await fs.stat(path.join(mountPath, 'My Nice App.app'))).isDirectory())
    t.is(await fs.readFile(path.join(mountPath, 'Documentation.txt'), 'utf8'), 'This is just a test.\n')
    t.true((await fs.stat(path.join(mountPath, '.background', 'TestBkg.tiff'))).isFile())
    t.true((await fs.stat(path.join(mountPath, '.DS_Store'))).isFile())
  })
})

function waitForImage (image) {
  return new Promise((resolve, reject) => {
    image.once('finish', resolve)
    image.once('error', reject)
  })
}

async function imageFormat (imagePath) {
  const result = await execFileAsync('hdiutil', ['imageinfo', '-format', imagePath])
  return result.stdout.trim()
}

async function withMountedImage (imagePath, fn) {
  const mountPath = await attach(imagePath)

  try {
    await fn(mountPath)
  } finally {
    await detach(mountPath)
  }
}

async function attach (imagePath) {
  const result = await execFileAsync('hdiutil', [
    'attach',
    imagePath,
    '-readonly',
    '-nobrowse',
    '-noverify',
    '-noautoopen'
  ])

  const mountPath = parseMountPath(result.stdout)

  if (!mountPath) {
    throw new Error('Failed to mount image during integration test')
  }

  return mountPath
}

async function detach (mountPath) {
  await execFileAsync('hdiutil', ['detach', mountPath])
}

function assetPath (name) {
  return path.join(__dirname, '..', 'assets', name)
}

async function makeTempDir (t) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'appdmg-integration-'))

  t.teardown(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  return tmpDir
}
