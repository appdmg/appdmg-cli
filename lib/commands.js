'use strict'

const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { wrapCommandError } = require('./errors')

const execFileAsync = promisify(execFile)

async function runCommand (command, args) {
  try {
    return await execFileAsync(command, args)
  } catch (err) {
    throw wrapCommandError(command, args, err)
  }
}

module.exports = {
  runCommand
}
