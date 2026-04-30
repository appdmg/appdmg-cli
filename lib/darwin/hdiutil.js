'use strict'

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

async function create (commands, volname, size, filesystem) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'appdmg-'))
  const temporaryImagePath = path.join(tmpDir, 'image.dmg')

  const args = [
    'create', temporaryImagePath,
    '-ov',
    '-fs', filesystem || 'HFS+',
    '-size', size,
    '-volname', volname
  ]

  try {
    await commands.run('hdiutil', args)
    return { temporaryImagePath, tmpDir }
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true })
    throw err
  }
}

async function attach (commands, imagePath) {
  const args = [
    'attach', imagePath,
    '-nobrowse',
    '-noverify',
    '-noautoopen'
  ]

  const result = await commands.run('hdiutil', args)
  const mountPath = parseMountPath(result.stdout)

  if (!mountPath) {
    throw new Error('Failed to mount image')
  }

  return mountPath
}

function parseMountPath (stdout) {
  for (const line of stdout.split('\n')) {
    const volumeMatch = /(\/Volumes\/.+)$/.exec(line)
    if (volumeMatch) return volumeMatch[1]

    const tabParts = line.trim().split('\t')
    const lastTabPart = tabParts[tabParts.length - 1]
    if (lastTabPart && path.isAbsolute(lastTabPart)) return lastTabPart
  }
}

async function detach (commands, mountPath) {
  const args = ['detach', mountPath]

  for (let attempt = 1; attempt <= 9; attempt += 1) {
    try {
      await commands.run('hdiutil', args)
      return
    } catch (err) {
      if ((err.details && err.details.exitCode === 16) || err.exitCode === 16 || err.code === 16) {
        if (attempt <= 8) {
          await delay(1000 * Math.pow(2, attempt - 1))
          continue
        }
      }

      throw err
    }
  }
}

async function convert (commands, source, format, target) {
  const args = [
    'convert', source,
    '-ov',
    '-format', format,
    '-imagekey', 'zlib-level=9',
    '-o', target
  ]

  try {
    await commands.run('hdiutil', args)
  } catch (err) {
    await fs.rm(target, { force: true })
    throw err
  }
}

function delay (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = {
  attach,
  convert,
  create,
  detach,
  parseMountPath
}
