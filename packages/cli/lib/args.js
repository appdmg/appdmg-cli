'use strict'

const path = require('node:path')
const { parseArgs } = require('node:util')

function parseCliArgs (argv) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: 'boolean' },
      version: { type: 'boolean' },
      quiet: { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' }
    }
  })

  const options = parsed.values
  const positionals = parsed.positionals

  if (options.help || options.version) {
    return { options, positionals }
  }

  if (positionals.length < 2) {
    throw new CliUsageError('Missing required arguments')
  }

  if (positionals.length > 2) {
    throw new CliUsageError('Too many arguments')
  }

  if (path.extname(positionals[0]) !== '.json') {
    throw new CliUsageError('Input must have the .json file extension')
  }

  if (path.extname(positionals[1]) !== '.dmg') {
    throw new CliUsageError('Output must have the .dmg file extension')
  }

  return { options, positionals }
}

class CliUsageError extends Error {
  constructor (message) {
    super(message)
    this.name = 'CliUsageError'
  }
}

module.exports = {
  CliUsageError,
  parseCliArgs
}
