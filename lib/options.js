'use strict'

const path = require('node:path')
const { appDmgError } = require('./errors')

function hasOwn (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function parseOptions (options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw appDmgError('APPDMG_INVALID_OPTIONS', '`options` must be an object')
  }

  if (!hasOwn(options, 'target')) {
    throw appDmgError('APPDMG_INVALID_OPTIONS', 'Missing option `target`')
  }

  if (typeof options.target !== 'string' || options.target.length === 0) {
    throw appDmgError('APPDMG_INVALID_OPTIONS', '`target` must be a non-empty string')
  }

  const hasSource = hasOwn(options, 'source')
  const hasSpec = hasOwn(options, 'basepath') && hasOwn(options, 'specification')

  if (hasSource === hasSpec) {
    throw appDmgError('APPDMG_INVALID_OPTIONS', 'Supply one of `source` or `(basepath, specification)`')
  }

  if (hasSource) {
    if (typeof options.source !== 'string' || options.source.length === 0) {
      throw appDmgError('APPDMG_INVALID_OPTIONS', '`source` must be a non-empty string')
    }

    return {
      target: path.resolve(options.target),
      source: path.resolve(options.source),
      basepath: path.dirname(path.resolve(options.source)),
      specification: null,
      hasSpecification: false
    }
  }

  if (typeof options.basepath !== 'string' || options.basepath.length === 0) {
    throw appDmgError('APPDMG_INVALID_OPTIONS', '`basepath` must be a non-empty string')
  }

  return {
    target: path.resolve(options.target),
    source: null,
    basepath: path.resolve(options.basepath),
    specification: options.specification,
    hasSpecification: true
  }
}

module.exports = {
  parseOptions
}
