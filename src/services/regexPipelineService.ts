import type { RegexScript } from '../types/domain'
import {
  applyRegexStage,
  looksLikeRichHtml,
  type RegexExecutionTrace,
  type RegexSource
} from './regexRuntime'

export interface RegexPipelineView {
  rawText: string
  canonicalText: string
  displayText: string
  storageApplied: string[]
  displayApplied: string[]
  traces: RegexExecutionTrace[]
  rich: boolean
}

/**
 * Compile a freshly-created chat message through ST-compatible Regex ephemerality.
 * canonicalText is the value that belongs in chat storage; displayText is a transient UI projection.
 */
export function compileIncomingMessageRegex(options: {
  rawText: string
  source: Extract<RegexSource, 'user-input' | 'assistant-output' | 'reasoning'>
  scripts: RegexScript[]
  displayScripts?: RegexScript[]
  depth?: number
  event?: 'generate' | 'edit'
  macros?: { user?: string; char?: string }
}): RegexPipelineView {
  const storage = applyRegexStage(options.rawText, options.scripts, {
    source: options.source,
    phase: 'storage',
    depth: options.depth ?? 0,
    event: options.event,
    macros: options.macros
  })
  const display = applyRegexStage(storage.text, options.displayScripts ?? options.scripts, {
    source: options.source,
    phase: 'display',
    depth: options.depth ?? 0,
    event: options.event,
    macros: options.macros
  })
  return {
    rawText: options.rawText,
    canonicalText: storage.text,
    displayText: display.text,
    storageApplied: storage.applied,
    displayApplied: display.applied,
    traces: [...storage.traces, ...display.traces],
    rich: display.rich || looksLikeRichHtml(display.text)
  }
}

/** Apply only ephemeral outgoing-prompt transforms to already-canonical chat storage. */
export function compileOutgoingMessageRegex(options: {
  text: string
  source: Extract<RegexSource, 'user-input' | 'assistant-output' | 'reasoning'>
  scripts: RegexScript[]
  depth: number
  macros?: { user?: string; char?: string }
}) {
  return applyRegexStage(options.text, options.scripts, {
    source: options.source,
    phase: 'outgoing-prompt',
    depth: options.depth,
    macros: options.macros
  })
}

/** World Info has no chat-message storage row, so persistent and prompt-only Regex both execute during prompt assembly. */
export function compileWorldInfoRegex(options: {
  text: string
  scripts: RegexScript[]
  macros?: { user?: string; char?: string }
}) {
  return applyRegexStage(options.text, options.scripts, {
    source: 'world-info',
    phase: 'outgoing-prompt',
    macros: options.macros
  })
}
