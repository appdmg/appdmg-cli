'use strict'

const appdmg = require('./lib/appdmg')
const schema = require('./schema.json')
const { AppDmgError } = require('./lib/errors')

module.exports = appdmg
module.exports.appdmg = appdmg
module.exports.schema = schema
module.exports.AppDmgError = AppDmgError
