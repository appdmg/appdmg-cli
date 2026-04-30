'use strict'

const Pipeline = require('./pipeline')
const { runCommand } = require('./commands')
const { appDmgError } = require('./errors')
const { parseOptions } = require('./options')
const { loadSpecification } = require('./spec/load')
const { validateSpecification } = require('./spec/validate')
const { buildDmg } = require('./darwin/build')

function appdmg (options, runtimeOptions) {
  const pipeline = new Pipeline()
  const runtime = createRuntime(runtimeOptions)

  process.nextTick(async () => {
    try {
      const parsedOptions = parseOptions(options)

      if (runtime.platform !== 'darwin') {
        throw appDmgError('APPDMG_UNSUPPORTED_PLATFORM', `DMG creation is only supported on Darwin. Current platform: ${runtime.platform}`, {
          platform: runtime.platform
        })
      }

      const specification = await loadSpecification(parsedOptions)
      validateSpecification(specification)

      const state = {
        ...parsedOptions,
        specification
      }

      await buildDmg(state, pipeline, runtime)
      await pipeline.run()
    } catch (err) {
      pipeline.emit('error', err)
    }
  })

  return pipeline
}

function createRuntime (options) {
  const runtimeOptions = options || {}
  const commands = runtimeOptions.commands || {
    run: runCommand
  }

  return {
    platform: runtimeOptions.platform || process.platform,
    commands
  }
}

module.exports = appdmg
