'use strict'

const fs = require('node:fs/promises')
const { appDmgError } = require('../errors')
const legacy = require('./legacy')

async function loadSpecification (options) {
  if (options.hasSpecification) {
    return normalizeSpecification(options.specification)
  }

  let buffer

  try {
    buffer = await fs.readFile(options.source)
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw appDmgError('APPDMG_SOURCE_NOT_FOUND', `JSON Specification not found at: ${options.source}`, { path: options.source })
    }

    throw err
  }

  try {
    return normalizeSpecification(JSON.parse(buffer.toString()))
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw appDmgError('APPDMG_INVALID_JSON', `Could not parse JSON Specification: ${err.message}`, { path: options.source })
    }

    throw err
  }
}

function normalizeSpecification (specification) {
  if (specification && typeof specification === 'object' && specification.icons) {
    return legacy.convert(specification)
  }

  return specification
}

module.exports = {
  loadSpecification,
  normalizeSpecification
}
