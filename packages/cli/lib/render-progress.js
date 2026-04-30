'use strict'

function renderProgress (info, stream) {
  if (info.type === 'step-begin') {
    const current = String(info.current).padStart(2, ' ')
    const line = `[${current}/${info.total}] ${info.title}...`
    return line + ' '.repeat(Math.max(1, 45 - line.length))
  }

  if (info.type === 'step-end') {
    const labels = {
      ok: ' OK ',
      skip: 'SKIP',
      error: 'FAIL'
    }

    return `[${labels[info.status] || info.status}]\n`
  }

  return ''
}

module.exports = {
  renderProgress
}
