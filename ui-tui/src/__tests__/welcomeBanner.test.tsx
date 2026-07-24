import { PassThrough } from 'stream'

import { renderSync } from '@zorin/ink'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { Banner, STARTER_COMMANDS } from '../components/branding.js'
import { stripAnsi } from '../lib/text.js'
import { DEFAULT_THEME } from '../theme.js'

const renderBanner = (columns: number): string => {
  const stdout = new PassThrough()
  const stdin = new PassThrough()
  const stderr = new PassThrough()
  let output = ''

  Object.assign(stdout, { columns, isTTY: false, rows: 30 })
  Object.assign(stdin, { isTTY: false })
  Object.assign(stderr, { isTTY: false })
  stdout.on('data', chunk => {
    output += chunk.toString()
  })

  const instance = renderSync(React.createElement(Banner, { maxWidth: columns, t: DEFAULT_THEME }), {
    patchConsole: false,
    stderr: stderr as NodeJS.WriteStream,
    stdin: stdin as NodeJS.ReadStream,
    stdout: stdout as NodeJS.WriteStream
  })

  instance.unmount()
  instance.cleanup()

  return stripAnsi(output)
}

describe('startup banner', () => {
  it('renders the ZORIN wordmark, product line, and five essential commands', () => {
    const frame = renderBanner(90)

    expect(frame).toContain('███████╗ ██████╗ ██████╗ ██╗███╗   ██╗')
    expect(frame).toContain('A product of NPCAUTOMATORS.')
    expect(STARTER_COMMANDS).toHaveLength(5)

    for (const [command, description] of STARTER_COMMANDS) {
      expect(frame).toContain(command)
      expect(frame).not.toContain(description)
    }

    expect(frame.split('\n').some(line => STARTER_COMMANDS.every(([command]) => line.includes(command)))).toBe(true)
    expect(frame).not.toContain('Messenger of the Digital Gods')
  })

  it('keeps all five commands on narrow terminals', () => {
    const frame = renderBanner(30)

    expect(frame).toContain('ZORIN')
    expect(frame).toContain('A product of NPCAUTOMATORS.')

    for (const [command] of STARTER_COMMANDS) {
      expect(frame).toContain(command)
    }
  })
})
