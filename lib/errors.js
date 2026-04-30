'use strict'

class AppDmgError extends Error {
  constructor (code, message, details) {
    super(message)
    this.name = 'AppDmgError'
    this.code = code

    if (details !== undefined) {
      this.details = details
    }
  }
}

function appDmgError (code, message, details) {
  return new AppDmgError(code, message, details)
}

function wrapCommandError (command, args, err) {
  const details = {
    command,
    args,
    exitCode: err.exitCode ?? err.code ?? null,
    stdout: err.stdout || '',
    stderr: err.stderr || ''
  }

  const message = `Command failed: ${command} ${args.join(' ')}`
  const wrapped = appDmgError('APPDMG_COMMAND_FAILED', message, details)
  wrapped.cause = err
  return wrapped
}

module.exports = {
  AppDmgError,
  appDmgError,
  wrapCommandError
}
