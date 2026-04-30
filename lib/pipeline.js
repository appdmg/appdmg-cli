'use strict'

const { EventEmitter } = require('node:events')

const SKIP = Symbol('skip-step')

class Pipeline extends EventEmitter {
  constructor () {
    super()

    this.steps = []
    this.cleanupSteps = []
    this.totalSteps = 0
    this.currentStep = 0
    this.hasErrored = false
  }

  addStep (title, fn) {
    this.steps.push({ title, fn })
    this.totalSteps += 1
  }

  addCleanupStep (title, fn) {
    this.cleanupSteps.push({ title, fn })
    this.totalSteps += 1
  }

  skip () {
    return SKIP
  }

  progress (info) {
    this.emit('progress', {
      ...info,
      current: this.currentStep,
      total: this.totalSteps
    })
  }

  run () {
    process.nextTick(async () => {
      try {
        await this.runSteps()
        await this.runCleanups()
        this.emit('finish')
      } catch (err) {
        this.hasErrored = true
        await this.runCleanups(err)
        this.emit('error', err)
      }
    })

    return this
  }

  async runSteps () {
    while (this.steps.length > 0) {
      const step = this.steps.shift()
      await this.runStep(step)
    }
  }

  async runCleanups (cause) {
    let cleanupError

    while (this.cleanupSteps.length > 0) {
      const step = this.cleanupSteps.pop()

      try {
        await this.runStep(step, true)
      } catch (err) {
        cleanupError = cleanupError || err
      }
    }

    if (!cause && cleanupError) {
      throw cleanupError
    }
  }

  async runStep (step, isCleanup) {
    this.currentStep += 1
    this.progress({ type: 'step-begin', title: step.title })

    try {
      const result = await step.fn(this)

      if (result === SKIP) {
        this.progress({ type: 'step-end', status: 'skip' })
      } else {
        this.progress({ type: 'step-end', status: 'ok' })
      }
    } catch (err) {
      this.progress({ type: 'step-end', status: 'error' })

      if (!isCleanup) {
        throw err
      }
    }
  }
}

module.exports = Pipeline
