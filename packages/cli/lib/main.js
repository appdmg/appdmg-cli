'use strict'

const { CliUsageError, parseCliArgs } = require('./args')
const { renderProgress } = require('./render-progress')

const usage = [
  'Generate DMG installer images for macOS applications.',
  '',
  'Usage: appdmg-cli <json-path> <dmg-path>',
  '',
  'json-path:  Path to the JSON specification file',
  'dmg-path:   Path at which to place the final DMG',
  '',
  'Options:',
  '',
  '-v, --verbose',
  '    Verbose error output',
  '',
  '--quiet',
  '    Suppress progress, success, and error output',
  '',
  '--help',
  '    Display usage and exit',
  '',
  '--version',
  '    Display version and exit',
  ''
].join('\n')

async function main (context) {
  const stdout = context.stdout
  const stderr = context.stderr
  let parsed

  try {
    parsed = parseCliArgs(context.argv)
  } catch (err) {
    if (err instanceof CliUsageError) {
      stderr.write(`${err.message}\n\n${usage}\n`)
      return 1
    }

    stderr.write(`${err.message}\n`)
    return 1
  }

  const options = parsed.options

  if (options.version) {
    stderr.write(`@appdmg/cli v${context.pkg.version}\n`)
    return 0
  }

  if (options.help) {
    stderr.write(`${usage}\n`)
    return 0
  }

  const shouldWrite = !options.quiet || options.verbose
  const source = parsed.positionals[0]
  const target = parsed.positionals[1]
  const image = context.appdmg({ source, target })

  image.on('progress', (info) => {
    if (!shouldWrite) return
    stderr.write(renderProgress(info, stderr))
  })

  try {
    await waitForImage(image)
  } catch (err) {
    if (shouldWrite) {
      if (options.verbose && err.stack) {
        stderr.write(`${err.stack}\n`)
      } else {
        stderr.write(`${err.name}: ${err.message}\n`)
      }
    }

    return 1
  }

  if (shouldWrite) {
    stderr.write(`\nYour image is ready:\n${target}\n`)
  }

  if (stdout && stdout.write) {
    stdout.write('')
  }

  return 0
}

function waitForImage (image) {
  return new Promise((resolve, reject) => {
    image.once('finish', resolve)
    image.once('error', reject)
  })
}

module.exports = {
  main,
  usage
}
