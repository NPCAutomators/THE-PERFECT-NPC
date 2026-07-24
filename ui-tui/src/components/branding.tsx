import { Box, Text, useStdout } from '@zorin/ink'
import { useEffect, useState } from 'react'
import unicodeSpinners from 'unicode-animations'

import { artWidth, caduceus, CADUCEUS_WIDTH, logo, LOGO_WIDTH } from '../banner.js'
import { mix } from '../lib/color.js'
import { flat } from '../lib/text.js'
import type { Theme } from '../theme.js'
import type { PanelSection, SessionInfo } from '../types.js'

import { Accordion } from './accordion.js'
import { ShimmerRows } from './loaders.js'
import { WidgetGrid } from './widgetGrid.js'

const LOADER_TICK_MS = 120

function InlineLoader({ label, t }: { label: string; t: Theme }) {
  const [tick, setTick] = useState(0)
  const spinner = unicodeSpinners.braille
  const frame = spinner.frames[tick % spinner.frames.length] ?? '⠋'

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), Math.max(LOADER_TICK_MS, spinner.interval))

    return () => clearInterval(id)
  }, [spinner.interval])

  return (
    <Text color={t.color.muted} wrap="truncate">
      <Text color={t.color.accent}>{frame}</Text> {label}
    </Text>
  )
}

export function ArtLines({ lines }: { lines: [string, string][] }) {
  // No `opaque`: the banner is top-level content with nothing behind it, so
  // it never needs the opaque space-fill (that's for absolute overlays). On a
  // transparent terminal (terminal.background #00000000) the fill's "default
  // background" spaces composite to black bars instead of the intended
  // see-through — the reported ugly banner. Glyphs paint fine on their own.
  return (
    <Box flexDirection="column" height={lines.length} width={artWidth(lines)}>
      {lines.map(([c, text], i) => (
        <Text color={c} key={i} wrap="truncate-end">
          {text}
        </Text>
      ))}
    </Box>
  )
}

export const STARTER_COMMANDS = [
  ['/help', 'Show all commands and hotkeys'],
  ['/new', 'Start a new session'],
  ['/resume', 'Resume a previous session'],
  ['/model', 'Choose a model'],
  ['/quit', 'Exit Zorin']
] as const

const PRODUCT_LINE = 'A product of NPCAUTOMATORS.'
const MAX_LEFT_PADDING = 2
const RIGHT_MARGIN = 1
const MAX_COMMAND_GAP = 3
const HIDE_BELOW = PRODUCT_LINE.length + RIGHT_MARGIN

const bannerLeftPadding = (cols: number) =>
  Math.max(0, Math.min(MAX_LEFT_PADDING, cols - PRODUCT_LINE.length - RIGHT_MARGIN))

const starterCommandRows = (cols: number): string[][] => {
  const rows: string[][] = []
  let current: string[] = []

  for (const [command] of STARTER_COMMANDS) {
    const candidate = [...current, command]
    const minimumWidth = candidate.reduce((total, item) => total + item.length, 0) + Math.max(0, candidate.length - 1)

    if (current.length && minimumWidth > cols) {
      rows.push(current)
      current = [command]
    } else {
      current = candidate
    }
  }

  if (current.length) {
    rows.push(current)
  }

  const last = rows.at(-1)
  const previous = rows.at(-2)

  if (last?.length === 1 && previous && previous.length > 2) {
    const moved = previous.at(-1)!
    const balancedLast = [moved, ...last]
    const balancedWidth = balancedLast.reduce((total, item) => total + item.length, 0) + balancedLast.length - 1

    if (balancedWidth <= cols) {
      rows[rows.length - 2] = previous.slice(0, -1)
      rows[rows.length - 1] = balancedLast
    }
  }

  return rows
}

const starterCommandGap = (commands: string[], cols: number) => {
  if (commands.length < 2) {
    return ''
  }

  const targetWidth = Math.min(cols, LOGO_WIDTH + 1)
  const commandWidth = commands.reduce((total, command) => total + command.length, 0)

  const gapWidth = Math.max(
    1,
    Math.min(MAX_COMMAND_GAP, Math.floor((targetWidth - commandWidth) / (commands.length - 1)))
  )

  return ' '.repeat(gapWidth)
}

function StarterCommands({ cols, t }: { cols: number; t: Theme }) {
  const rows = starterCommandRows(cols)

  return (
    <Box flexDirection="column" marginTop={1}>
      {rows.map((commands, rowIndex) => {
        const gap = starterCommandGap(commands, cols)

        return (
          <Text key={rowIndex} wrap="truncate-end">
            {commands.map((command, index) => (
              <Text bold color={t.color.accent} key={command}>
                {index ? gap : ''}
                {command}
              </Text>
            ))}
          </Text>
        )
      })}
    </Box>
  )
}

export function Banner({ maxWidth, t }: { maxWidth?: number; t: Theme }) {
  const term = useStdout().stdout?.columns ?? 80
  const cols = Math.max(1, Math.min(term, maxWidth ?? term))

  if (cols < HIDE_BELOW) {
    return null
  }

  const leftPadding = bannerLeftPadding(cols)
  const contentCols = Math.max(1, cols - leftPadding - RIGHT_MARGIN)

  const logoLines = logo(t.color, t.bannerLogo || undefined)
  const logoW = t.bannerLogo ? artWidth(logoLines) : LOGO_WIDTH

  const showLogo = contentCols >= logoW

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={leftPadding} width={Math.max(1, cols - RIGHT_MARGIN)}>
      {showLogo ? (
        <ArtLines lines={logoLines} />
      ) : (
        <Text bold color={t.color.primary} wrap="truncate-end">
          {t.brand.name}
        </Text>
      )}

      <Text color={t.color.muted} wrap="truncate-end">
        A product of{' '}
        <Text bold color={t.color.primary}>
          NPCAUTOMATORS.
        </Text>
      </Text>

      <StarterCommands cols={contentCols} t={t} />
    </Box>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────
//
// Lazy sections render shimmer rows shaped like the real content (label
// block + value run) instead of a blank gap that pops when data lands.
// Row widths mirror the typical toolsets listing.
const SKELETON_ROWS: readonly (readonly [number, number])[] = [
  [7, 30],
  [7, 9],
  [14, 12],
  [12, 12],
  [7, 7],
  [10, 13]
]

// ── SessionPanel ─────────────────────────────────────────────────────

const SKILLS_MAX = 8
const TOOLSETS_MAX = 8

export function SessionPanel({ info, maxWidth, sid, t }: SessionPanelProps) {
  const term = useStdout().stdout?.columns ?? 100
  const cols = Math.max(20, Math.min(term, maxWidth ?? term))
  const heroLines = caduceus(t.color, t.bannerHero || undefined)
  const leftW = Math.min((artWidth(heroLines) || CADUCEUS_WIDTH) + 4, Math.floor(cols * 0.4))
  const wide = cols >= 90 && leftW + 40 < cols
  const w = Math.max(20, wide ? cols - leftW - 14 : cols - 12)
  const lineBudget = Math.max(12, w - 2)
  const strip = (s: string) => (s.endsWith('_tools') ? s.slice(0, -6) : s)

  // Hierarchy: labels lead in the label tone; member lists recede in the
  // muted/text midpoint. Anchoring on MUTED (mid-luminance by construction)
  // keeps the fade readable on both poles even when polarity detection is
  // wrong — surface-relative blends go invisible when text is already pale.
  const listFade = mix(t.color.muted, t.color.text, 0.5)

  // ── Local collapse state for each section ──
  const [toolsOpen, setToolsOpen] = useState(true)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [systemOpen, setSystemOpen] = useState(false)
  const [mcpOpen, setMcpOpen] = useState(false)

  const truncLine = (pfx: string, items: string[]) => {
    let line = ''
    let shown = 0

    for (const item of [...items].sort()) {
      const next = line ? `${line}, ${item}` : item

      if (pfx.length + next.length > lineBudget) {
        return line ? `${line}, …+${items.length - shown}` : `${item}, …`
      }

      line = next
      shown++
    }

    return line
  }

  // ── Collapsible skills section ──
  const skillEntries = Object.entries(info.skills).sort()
  const skillsTotal = flat(info.skills).length
  const skillsCatCount = skillEntries.length

  const skillsBody = () => {
    if (info.lazy && skillEntries.length === 0) {
      return <InlineLoader label="scanning skills" t={t} />
    }

    const shown = skillEntries.slice(0, SKILLS_MAX)
    const overflow = skillEntries.length - SKILLS_MAX

    return (
      <>
        {shown.map(([k, vs]) => (
          <Text key={k} wrap="truncate">
            <Text color={t.color.label}>{strip(k)}: </Text>
            <Text color={listFade}>{truncLine(strip(k) + ': ', vs)}</Text>
          </Text>
        ))}
        {overflow > 0 && <Text color={t.color.muted}>(and {overflow} more categories…)</Text>}
      </>
    )
  }

  // ── Collapsible tools section ──
  const toolEntries = Object.entries(info.tools).sort()
  const toolsTotal = flat(info.tools).length

  // MCP headline counts *connected* servers, not configured-but-disabled ones,
  // so it matches the classic CLI banner (`sum(s.connected)` in
  // zorin_cli/banner.py) and the "connected" label on the collapse toggle.
  const mcpServers = info.mcp_servers ?? []
  const mcpConnected = mcpServers.filter(s => s.connected).length

  const toolsBody = () => {
    if (info.lazy && toolEntries.length === 0) {
      return <ShimmerRows color={listFade} highlight={t.color.label} rows={SKELETON_ROWS} />
    }

    const shown = toolEntries.slice(0, TOOLSETS_MAX)
    const overflow = toolEntries.length - TOOLSETS_MAX

    return (
      <>
        {shown.map(([k, vs]) => (
          <Text key={k} wrap="truncate">
            <Text color={t.color.label}>{strip(k)}: </Text>
            <Text color={listFade}>{truncLine(strip(k) + ': ', vs)}</Text>
          </Text>
        ))}
        {overflow > 0 && <Text color={t.color.muted}>(and {overflow} more toolsets…)</Text>}
      </>
    )
  }

  // ── Collapsible MCP section ──
  const mcpBody = () => (
    <>
      {(info.mcp_servers ?? []).map(s => (
        <Text key={s.name} wrap="truncate">
          <Text color={t.color.muted}>{`  ${s.name} `}</Text>
          <Text color={t.color.muted}>{`[${s.transport}]`}</Text>
          <Text color={t.color.muted}>: </Text>
          {s.connected ? (
            <Text color={t.color.text}>
              {s.tools} tool{s.tools === 1 ? '' : 's'}
            </Text>
          ) : s.disabled || s.status === 'disabled' ? (
            <Text color={t.color.muted}>disabled</Text>
          ) : s.status === 'connecting' ? (
            <Text color={t.color.warn}>connecting</Text>
          ) : s.status === 'configured' ? (
            <Text color={t.color.muted}>configured</Text>
          ) : (
            <Text color={t.color.error}>failed</Text>
          )}
        </Text>
      ))}
    </>
  )

  // ── System prompt body ──
  const sysPromptLen = (info.system_prompt ?? '').length

  const systemBody = () => {
    if (sysPromptLen === 0) {
      return <Text color={t.color.muted}>No system prompt loaded.</Text>
    }

    return <Text color={t.color.muted}>{info.system_prompt}</Text>
  }

  // The wide layout is a real two-column grid: a fixed-width hero track and a
  // flexible info track (grid-template-columns: <leftW> 1fr, gap 2) — the
  // terminal equivalent of the desktop pane shell's fixed-vs-flex tracks.
  // Narrow drops to a single flexible track. Track math reproduces the old
  // hand-rolled widths exactly: usable = (leftW + 2 + w) - gap = leftW + w.
  const heroColumn = wide ? (
    <Box flexDirection="column" width="100%">
      <ArtLines lines={heroLines} />
      <Text />

      <Text color={t.color.accent}>
        {info.model.split('/').pop()}
        <Text color={t.color.muted}> · NPCAUTOMATORS</Text>
      </Text>

      <Text color={t.color.muted} wrap="truncate-end">
        {info.cwd || process.cwd()}
      </Text>

      {sid && (
        <Text>
          <Text color={t.color.sessionLabel}>Session: </Text>
          <Text color={t.color.sessionBorder}>{sid}</Text>
        </Text>
      )}
    </Box>
  ) : null

  const infoColumn = (
    <Box flexDirection="column" width="100%">
      {wide ? (
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color={t.color.primary}>
            {t.brand.name}
            {info.version ? ` v${info.version}` : ''}
            {info.release_date ? ` (${info.release_date})` : ''}
          </Text>
        </Box>
      ) : (
        // Narrow layout hides the hero column; surface model/cwd/session
        // here so they aren't lost.
        <Box flexDirection="column" marginBottom={1}>
          <Text color={t.color.accent} wrap="truncate-end">
            {info.model.split('/').pop()}
            <Text color={t.color.muted}> · NPCAUTOMATORS</Text>
          </Text>
          <Text color={t.color.muted} wrap="truncate-end">
            {info.cwd || process.cwd()}
          </Text>
          {sid && (
            <Text wrap="truncate-end">
              <Text color={t.color.sessionLabel}>Session: </Text>
              <Text color={t.color.sessionBorder}>{sid}</Text>
            </Text>
          )}
        </Box>
      )}

      {/* ── Tools (expanded by default) ── */}
      <Box flexDirection="column" marginTop={1}>
        <Accordion onToggle={() => setToolsOpen(v => !v)} open={toolsOpen} t={t} title="Available Tools">
          {toolsBody()}
        </Accordion>
      </Box>

      {/* ── Skills (collapsed by default) ── */}
      <Box flexDirection="column" marginTop={1}>
        <Accordion
          count={skillsTotal}
          onToggle={() => setSkillsOpen(v => !v)}
          open={skillsOpen}
          suffix={skillsCatCount > 0 ? `in ${skillsCatCount} categor${skillsCatCount === 1 ? 'y' : 'ies'}` : undefined}
          t={t}
          title="Available Skills"
        >
          {skillsBody()}
        </Accordion>
      </Box>

      {/* ── System Prompt (collapsed by default) ── */}
      {sysPromptLen > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Accordion
            onToggle={() => setSystemOpen(v => !v)}
            open={systemOpen}
            suffix={`— ${sysPromptLen.toLocaleString()} chars`}
            t={t}
            title="System Prompt"
          >
            {systemBody()}
          </Accordion>
        </Box>
      )}

      {/* ── MCP Servers (collapsed by default) ── */}
      {mcpServers.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Accordion
            count={mcpConnected}
            onToggle={() => setMcpOpen(v => !v)}
            open={mcpOpen}
            suffix="connected"
            t={t}
            title="MCP Servers"
          >
            {mcpBody()}
          </Accordion>
        </Box>
      )}

      <Text />

      <Text color={t.color.text}>
        {/* Lazy boot: never print "0 tools · 0 skills" while counts load. */}
        {info.lazy && !toolsTotal ? '… ' : `${toolsTotal} `}tools{' · '}
        {info.lazy && !skillsTotal ? '… ' : `${skillsTotal} `}skills
        {mcpConnected ? ` · ${mcpConnected} MCP` : ''}
        {' · '}
        <Text color={t.color.muted}>/help for commands</Text>
      </Text>

      {typeof info.update_behind === 'number' && info.update_behind > 0 && (
        <Text bold color={t.color.warn}>
          ! {info.update_behind} {info.update_behind === 1 ? 'commit' : 'commits'} behind
          <Text bold={false} color={t.color.warn} dimColor>
            {' '}
            - run{' '}
          </Text>
          <Text bold color={t.color.warn}>
            {info.update_command || 'zorin update'}
          </Text>
          <Text bold={false} color={t.color.warn} dimColor>
            {' '}
            to update
          </Text>
        </Text>
      )}

      {info.install_warning && (
        <Text bold color={t.color.warn} wrap="wrap">
          ! {info.install_warning}
        </Text>
      )}
    </Box>
  )

  return (
    <Box borderColor={t.color.border} borderStyle="round" marginBottom={1} paddingX={2} paddingY={1}>
      <WidgetGrid
        cols={wide ? leftW + 2 + w : w}
        columns={wide ? [leftW, { fr: 1 }] : 1}
        gap={2}
        paddingX={0}
        paddingY={0}
        rowGap={0}
        widgets={
          wide
            ? [
                { children: heroColumn, id: 'session-hero' },
                { children: infoColumn, id: 'session-info' }
              ]
            : [{ children: infoColumn, id: 'session-info' }]
        }
      />
    </Box>
  )
}

export function Panel({ sections, t, title }: PanelProps) {
  return (
    <Box borderColor={t.color.border} borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color={t.color.primary}>
          {title}
        </Text>
      </Box>

      {sections.map((sec, si) => (
        <Box flexDirection="column" key={si} marginTop={si > 0 ? 1 : 0}>
          {sec.title && (
            <Text bold color={t.color.accent}>
              {sec.title}
            </Text>
          )}

          {sec.rows?.map(([k, v], ri) => (
            <Text key={ri} wrap="truncate">
              <Text color={t.color.muted}>{k.padEnd(20)}</Text>
              <Text color={t.color.text}>{v}</Text>
            </Text>
          ))}

          {sec.items?.map((item, ii) => (
            <Text color={t.color.text} key={ii} wrap="truncate">
              {item}
            </Text>
          ))}

          {sec.text && <Text color={t.color.muted}>{sec.text}</Text>}
        </Box>
      ))}
    </Box>
  )
}

interface PanelProps {
  sections: PanelSection[]
  t: Theme
  title: string
}

interface SessionPanelProps {
  info: SessionInfo
  maxWidth?: number
  sid?: string | null
  t: Theme
}
