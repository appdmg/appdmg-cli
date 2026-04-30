#!/usr/bin/env node
'use strict'

const appdmg = require('@appdmg/appdmg')
const pkg = require('../package.json')
const { main } = require('../lib/main')

main({
  argv: process.argv.slice(2),
  appdmg,
  pkg,
  stdout: process.stdout,
  stderr: process.stderr
}).then((exitCode) => {
  process.exitCode = exitCode
}, (err) => {
  process.stderr.write(`${err.stack || err.message}\n`)
  process.exitCode = 1
})
