'use strict'

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const DSStore = require('@appdmg/ds-store')
const sizeOf = require('image-size')
const parseColor = require('parse-color')

const hdiutil = require('./hdiutil')
const { appDmgError } = require('../errors')

async function buildDmg (state, pipeline, runtime) {
  const commands = runtime.commands
  const resolvePath = (value) => path.resolve(state.basepath, value)

  pipeline.addStep('Looking for target', async () => {
    let handle

    try {
      handle = await fs.open(state.target, 'wx')
      await handle.close()
      handle = null
    } catch (err) {
      if (handle) await handle.close()

      if (err.code === 'EEXIST') {
        throw appDmgError('APPDMG_TARGET_EXISTS', 'Target already exists', { path: state.target })
      }

      throw err
    }

    pipeline.addCleanupStep('Removing target image', async () => {
      if (pipeline.hasErrored) {
        await fs.rm(state.target, { force: true })
      }
    })
  })

  pipeline.addStep('Looking for files', async () => {
    state.links = state.specification.contents.filter((entry) => entry.type === 'link')
    state.files = state.specification.contents.filter((entry) => entry.type === 'file')

    for (const file of state.files) {
      const filePath = resolvePath(file.path)

      try {
        await fs.access(filePath)
      } catch (err) {
        if (err.code === 'ENOENT') {
          throw appDmgError('APPDMG_FILE_NOT_FOUND', `"${file.path}" not found at: ${filePath}`, {
            path: file.path,
            resolvedPath: filePath
          })
        }

        throw err
      }
    }
  })

  pipeline.addStep('Calculating size of image', async () => {
    let megabytes = 0

    for (const entry of state.files) {
      const result = await commands.run('du', ['-sm', resolvePath(entry.path)])
      const match = /^([0-9]+)\t/.exec(result.stdout)

      if (match === null) {
        throw appDmgError('APPDMG_COMMAND_FAILED', 'du -sm did not return a size', {
          command: 'du',
          args: ['-sm', resolvePath(entry.path)],
          stdout: result.stdout,
          stderr: result.stderr || ''
        })
      }

      megabytes += Number.parseInt(match[1], 10)
    }

    state.megabytes = (megabytes * 1.5) + 32
  })

  pipeline.addStep('Creating temporary image', async () => {
    const result = await hdiutil.create(
      commands,
      state.specification.title,
      `${state.megabytes}m`,
      state.specification.filesystem
    )

    state.temporaryImagePath = result.temporaryImagePath
    state.temporaryDirectory = result.tmpDir

    pipeline.addCleanupStep('Removing temporary image', async () => {
      if (state.temporaryDirectory) {
        await fs.rm(state.temporaryDirectory, { recursive: true, force: true })
      } else if (state.temporaryImagePath) {
        await fs.rm(state.temporaryImagePath, { force: true })
      }
    })
  })

  pipeline.addStep('Mounting temporary image', async () => {
    state.temporaryMountPath = await hdiutil.attach(commands, state.temporaryImagePath)

    pipeline.addCleanupStep('Unmounting temporary image', async () => {
      if (state.temporaryMountPath) {
        await hdiutil.detach(commands, state.temporaryMountPath)
      }
    })
  })

  pipeline.addStep('Making hidden background folder', async () => {
    state.backgroundDirectory = path.join(state.temporaryMountPath, '.background')
    await fs.mkdir(state.backgroundDirectory)
  })

  pipeline.addStep('Copying background', async (p) => {
    if (!state.specification.background) return p.skip()

    const absolutePath = resolvePath(state.specification.background)
    const retinaPath = absolutePath.replace(/\.([a-z]+)$/i, '@2x.$1')
    const hasRetinaBackground = await exists(retinaPath)

    if (hasRetinaBackground) {
      const originalExt = path.extname(state.specification.background)
      const outputName = `${path.basename(state.specification.background, originalExt)}.tiff`
      const finalPath = path.join(state.backgroundDirectory, outputName)
      state.backgroundName = path.join('.background', outputName)
      await commands.run('tiffutil', ['-cathidpicheck', absolutePath, retinaPath, '-out', finalPath])
    } else {
      const outputName = path.basename(state.specification.background)
      const finalPath = path.join(state.backgroundDirectory, outputName)
      state.backgroundName = path.join('.background', outputName)
      await fs.copyFile(absolutePath, finalPath)
    }
  })

  pipeline.addStep('Reading background dimensions', async (p) => {
    if (!state.specification.background) return p.skip()

    const size = await imageSize(resolvePath(state.specification.background))
    state.backgroundSize = [size.width, size.height]
  })

  pipeline.addStep('Copying icon', async (p) => {
    if (!state.specification.icon) return p.skip()

    const finalPath = path.join(state.temporaryMountPath, '.VolumeIcon.icns')
    await fs.copyFile(resolvePath(state.specification.icon), finalPath)
  })

  pipeline.addStep('Setting icon', async (p) => {
    if (!state.specification.icon) return p.skip()

    const finderInfo = Buffer.alloc(32)
    finderInfo.writeUInt8(4, 8)
    await commands.run('xattr', ['-wx', 'com.apple.FinderInfo', finderInfo.toString('hex'), state.temporaryMountPath])
  })

  pipeline.addStep('Creating links', async (p) => {
    if (state.links.length === 0) return p.skip()

    for (const entry of state.links) {
      const name = entry.name || path.basename(entry.path)
      await fs.symlink(entry.path, path.join(state.temporaryMountPath, name))
    }
  })

  pipeline.addStep('Copying files', async (p) => {
    if (state.files.length === 0) return p.skip()

    for (const entry of state.files) {
      const name = entry.name || path.basename(entry.path)
      await fs.cp(resolvePath(entry.path), path.join(state.temporaryMountPath, name), { recursive: true })
    }
  })

  pipeline.addStep('Making all the visuals', async () => {
    const ds = new DSStore()

    ds.vSrn(1)
    ds.setIconSize(state.specification['icon-size'] || 80)

    if (state.specification['background-color']) {
      const rgb = parseColor(state.specification['background-color']).rgb
      ds.setBackgroundColor(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
    }

    if (state.specification.background) {
      ds.setBackgroundPath(path.join(state.temporaryMountPath, state.backgroundName), { volumeName: state.specification.title })
    }

    if (state.specification.window && state.specification.window.size) {
      ds.setWindowSize(state.specification.window.size.width, state.specification.window.size.height)
    } else if (state.backgroundSize) {
      ds.setWindowSize(state.backgroundSize[0], state.backgroundSize[1])
    } else {
      ds.setWindowSize(640, 480)
    }

    if (state.specification.window && state.specification.window.position) {
      ds.setWindowPos(state.specification.window.position.x, state.specification.window.position.y)
    }

    for (const entry of state.specification.contents) {
      ds.setIconPos(entry.name || path.basename(entry.path), entry.x, entry.y)
    }

    await ds.write(path.join(state.temporaryMountPath, '.DS_Store'))
  })

  pipeline.addStep('Blessing image', async (p) => {
    if (state.specification.filesystem === 'APFS') return p.skip()

    const args = ['--folder', state.temporaryMountPath]

    if (os.arch() !== 'arm64') {
      args.push('--openfolder', state.temporaryMountPath)
    }

    await commands.run('bless', args)
  })

  pipeline.addStep('Unmounting temporary image', async () => {
    await hdiutil.detach(commands, state.temporaryMountPath)
    state.temporaryMountPath = null
  })

  pipeline.addStep('Finalizing image', async () => {
    await hdiutil.convert(commands, state.temporaryImagePath, state.specification.format || 'UDZO', state.target)
  })

  pipeline.addStep('Signing image', async (p) => {
    const codeSignOptions = state.specification['code-sign']

    if (!codeSignOptions || !codeSignOptions['signing-identity']) {
      return p.skip()
    }

    const args = ['--verbose', '--sign', codeSignOptions['signing-identity']]

    if (codeSignOptions.identifier) {
      args.push('--identifier', codeSignOptions.identifier)
    }

    args.push(state.target)
    await commands.run('codesign', args)
  })
}

async function exists (filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch (err) {
    if (err.code === 'ENOENT') return false
    throw err
  }
}

async function imageSize (filePath) {
  const buffer = await fs.readFile(filePath)

  if (typeof sizeOf === 'function') {
    return sizeOf(buffer)
  }

  if (typeof sizeOf.imageSize === 'function') {
    return sizeOf.imageSize(buffer)
  }

  throw new TypeError('Unsupported image-size API')
}

module.exports = {
  buildDmg
}
