'use strict'

const parseColor = require('parse-color')
const { appDmgError } = require('../errors')

const FORMATS = new Set(['UDRW', 'UDRO', 'UDCO', 'UDZO', 'ULFO', 'ULMO', 'UDBZ'])
const FILESYSTEMS = new Set(['HFS+', 'APFS'])
const CONTENT_TYPES = new Set(['link', 'file', 'position'])

function validateSpecification (specification) {
  const errors = []

  if (!isPlainObject(specification)) {
    throw invalidSpec(['Specification must be an object'])
  }

  requireString(errors, specification, 'title')

  optionalString(errors, specification, 'icon')
  optionalString(errors, specification, 'background')
  optionalString(errors, specification, 'background-color')

  if (typeof specification['background-color'] === 'string' && !parseColor(specification['background-color']).rgb) {
    errors.push('`background-color` must be a CSS color')
  }

  optionalInteger(errors, specification, 'icon-size')
  optionalEnum(errors, specification, 'format', FORMATS)
  optionalEnum(errors, specification, 'filesystem', FILESYSTEMS)
  validateWindow(errors, specification.window)
  validateCodeSign(errors, specification['code-sign'])
  validateContents(errors, specification.contents)

  if (errors.length > 0) {
    throw invalidSpec(errors)
  }
}

function validateContents (errors, contents) {
  if (!Array.isArray(contents)) {
    errors.push('`contents` must be an array')
    return
  }

  contents.forEach((entry, index) => {
    const prefix = `contents[${index}]`

    if (!isPlainObject(entry)) {
      errors.push(`${prefix} must be an object`)
      return
    }

    requireInteger(errors, entry, 'x', prefix)
    requireInteger(errors, entry, 'y', prefix)
    requireString(errors, entry, 'path', prefix)

    if (!CONTENT_TYPES.has(entry.type)) {
      errors.push(`${prefix}.type must be one of: ${Array.from(CONTENT_TYPES).join(', ')}`)
    }

    optionalString(errors, entry, 'name', prefix)
  })
}

function validateWindow (errors, window) {
  if (window === undefined) return

  if (!isPlainObject(window)) {
    errors.push('`window` must be an object')
    return
  }

  validatePoint(errors, window.position, 'window.position')
  validatePoint(errors, window.size, 'window.size', ['width', 'height'])
}

function validatePoint (errors, value, label, keys) {
  if (value === undefined) return

  if (!isPlainObject(value)) {
    errors.push(`\`${label}\` must be an object`)
    return
  }

  for (const key of (keys || ['x', 'y'])) {
    requireInteger(errors, value, key, label)
  }
}

function validateCodeSign (errors, options) {
  if (options === undefined) return

  if (!isPlainObject(options)) {
    errors.push('`code-sign` must be an object')
    return
  }

  requireString(errors, options, 'signing-identity', 'code-sign')
  optionalString(errors, options, 'identifier', 'code-sign')
}

function requireString (errors, obj, key, prefix) {
  if (typeof obj[key] !== 'string' || obj[key].length === 0) {
    errors.push(label(prefix, key) + ' must be a non-empty string')
  }
}

function optionalString (errors, obj, key, prefix) {
  if (obj[key] !== undefined && (typeof obj[key] !== 'string' || obj[key].length === 0)) {
    errors.push(label(prefix, key) + ' must be a non-empty string')
  }
}

function requireInteger (errors, obj, key, prefix) {
  if (!Number.isInteger(obj[key])) {
    errors.push(label(prefix, key) + ' must be an integer')
  }
}

function optionalInteger (errors, obj, key, prefix) {
  if (obj[key] !== undefined && !Number.isInteger(obj[key])) {
    errors.push(label(prefix, key) + ' must be an integer')
  }
}

function optionalEnum (errors, obj, key, values, prefix) {
  if (obj[key] !== undefined && !values.has(obj[key])) {
    errors.push(label(prefix, key) + ' must be one of: ' + Array.from(values).join(', '))
  }
}

function label (prefix, key) {
  return '`' + (prefix ? `${prefix}.${key}` : key) + '`'
}

function invalidSpec (errors) {
  return appDmgError('APPDMG_INVALID_SPEC', errors.join(', '), { errors })
}

function isPlainObject (value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

module.exports = {
  validateSpecification
}
