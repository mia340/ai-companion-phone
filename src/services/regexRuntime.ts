import { db } from '../db/database'
import { getCharacterResourceIds } from './resourceBindingService'
import type { RegexScript } from '../types/domain'

/**
 * V0.4.7.0 Regex Pipeline V2
 *
 * SillyTavern-compatible model:
 * - placement decides WHICH source is affected (user / assistant / world-info / reasoning / slash).
 * - markdownOnly / promptOnly decide WHERE the transformed view exists:
 *   - neither: persistent storage mutation; stored text is then naturally used by display + future prompts.
 *   - markdownOnly only: display-only, storage unchanged.
 *   - promptOnly only: outgoing-prompt-only, storage/display unchanged.
 *   - both: display + outgoing prompt, storage unchanged.
 *
 * The app keeps the old exported helpers as compatibility wrappers, but new generation code should use
 * applyRegexStage() with an explicit source + phase. This prevents a promptOnly response regex from being
 * incorrectly applied to the whole system prompt.
 */

export type RegexSource = 'user-input' | 'assistant-output' | 'world-info' | 'slash-command' | 'reasoning'
export type RegexPhase = 'storage' | 'display' | 'outgoing-prompt'
export type RegexEvent = 'generate' | 'edit'

/** @deprecated use RegexSource; kept so older imports compile. */
export type RegexTarget = RegexSource | 'prompt'

export type RegexEphemerality = 'persistent' | 'display-only' | 'prompt-only' | 'display-and-prompt'

export interface RegexExecutionTrace {
  scriptId: string
  name: string
  source: RegexSource
  phase: RegexPhase
  depth?: number
  applied: boolean
  reason?: 'matched' | 'no-match' | 'wrong-phase' | 'wrong-placement' | 'depth' | 'edit-disabled' | 'invalid-depth' | 'unsupported-placement'
}

export interface RegexStageOptions {
  source: RegexSource
  phase: RegexPhase
  depth?: number
  event?: RegexEvent
  macros?: { user?: string; char?: string }
}

export interface RegexStageResult {
  text: string
  applied: string[]
  rich: boolean
  traces: RegexExecutionTrace[]
}

const SOURCE_PLACEMENT: Record<RegexSource, number> = {
  'user-input': 1,
  'assistant-output': 2,
  'slash-command': 3,
  'world-info': 5,
  reasoning: 6
}

const SUPPORTED_NORMAL_PLACEMENTS = new Set(Object.values(SOURCE_PLACEMENT))

export function regexSourcePlacement(source: RegexSource) {
  return SOURCE_PLACEMENT[source]
}

export function regexEphemerality(script: RegexScript): RegexEphemerality {
  if (script.markdownOnly && script.promptOnly) return 'display-and-prompt'
  if (script.markdownOnly) return 'display-only'
  if (script.promptOnly) return 'prompt-only'
  return 'persistent'
}

/** Human-readable semantic label used by the resource editor/debugger. */
export function regexEphemeralityLabel(script: RegexScript) {
  const mode = regexEphemerality(script)
  if (mode === 'persistent') return '永久改写存储'
  if (mode === 'display-only') return '仅改变显示'
  if (mode === 'prompt-only') return '仅改变发给 AI 的内容'
  return '显示 + 发给 AI（不改存储）'
}

export function regexPlacementLabel(script: RegexScript) {
  const labels = script.placement.map(value => {
    if (value === 1) return '用户输入'
    if (value === 2) return 'AI 回复'
    if (value === 3) return 'Slash'
    if (value === 5) return '世界书'
    if (value === 6) return 'Reasoning'
    return `未知 ${value}`
  })
  if (!labels.length && (script.sourceFormat === 'native' || script.sourceFormat === 'legacy')) return 'AI 回复（旧版兼容）'
  return labels.length ? labels.join('、') : '未指定（正常聊天不执行）'
}

function parsePattern(source: string) {
  const match = source.match(/^\/(.*)\/([dgimsuvy]*)$/s)
  try {
    if (match) return new RegExp(match[1], match[2])
    return new RegExp(source)
  } catch {
    return undefined
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function substituteMacros(value: string, script: RegexScript, macros?: { user?: string; char?: string }) {
  if (!script.substituteRegex || !macros) return value
  const transform = script.substituteRegex === 2 ? escapeRegex : (text: string) => text
  return value
    .replace(/\{\{user\}\}/gi, transform(macros.user || '{{user}}'))
    .replace(/\{\{char\}\}/gi, transform(macros.char || '{{char}}'))
}

function substituteReplacementMacros(value: string, macros?: { user?: string; char?: string }) {
  if (!macros) return value
  return value
    .replace(/\{\{user\}\}/gi, macros.user || '{{user}}')
    .replace(/\{\{char\}\}/gi, macros.char || '{{char}}')
}

function expandReplacement(template: string, match: string, groups: string[]) {
  let output = template.replace(/\{\{match\}\}/g, match).replace(/\$&/g, match)
  groups.forEach((group, index) => {
    output = output.replace(new RegExp(`\\$${index + 1}(?!\\d)`, 'g'), group ?? '')
  })
  return output
}

function normalizeStructuralDelimitersForRegex(text: string, script: RegexScript) {
  const source = script.findRegex || ''
  // 作者明确写了方括号结构时，允许模型常见的全角括号偏差；不改作者 Regex 本体。
  if (!/(?:\\\[|\[)/.test(source)) return text
  let normalized = text
    .replace(/[【［]/g, '[')
    .replace(/[】］]/g, ']')

  if (source.includes(':') && !source.includes('：')) {
    normalized = normalized.replace(/(\[[^\]\n]{1,40})：/g, '$1:')
  }
  return normalized
}

export function applyRegexScript(text: string, script: RegexScript, macros?: { user?: string; char?: string }) {
  if (!script.enabled || !script.findRegex) return text
  const patternSource = substituteMacros(script.findRegex, script, macros)
  const replacement = substituteReplacementMacros(script.replaceString || '', macros)

  const replaceWithPattern = (input: string) => {
    const pattern = parsePattern(patternSource)
    if (!pattern) return input
    return input.replace(pattern, (...args: unknown[]) => {
      const match = String(args[0] ?? '')
      const groupCount = Math.max(0, args.length - 3)
      const groups = args.slice(1, 1 + groupCount).map(value => String(value ?? ''))
      const trimmed = (script.trimStrings || []).reduce((current, item) => item ? current.split(item).join('') : current, match)
      return expandReplacement(replacement, trimmed, groups)
    })
  }

  const direct = replaceWithPattern(text)
  if (direct !== text) return direct

  const compatibleInput = normalizeStructuralDelimitersForRegex(text, script)
  if (compatibleInput === text) return text
  const compatible = replaceWithPattern(compatibleInput)
  return compatible !== compatibleInput ? compatible : text
}

export function regexExecutionOrder(script: RegexScript) {
  if (Number.isFinite(script.order)) return Number(script.order)
  const raw = script.raw || {}
  const legacy = Number(raw.order ?? raw.priority)
  return Number.isFinite(legacy) ? legacy : 0
}

function regexPlacementMatches(script: RegexScript, source: RegexSource) {
  // Old native/legacy rows created by this app used an empty placement to mean assistant output.
  // Imported ST/Tavo/community rows keep standard semantics: empty placement = no automatic activation.
  if (!script.placement.length) {
    return source === 'assistant-output' && (script.sourceFormat === 'native' || script.sourceFormat === 'legacy' || !script.sourceFormat)
  }
  return script.placement.includes(regexSourcePlacement(source))
}

function hasUnsupportedOnlyPlacement(script: RegexScript) {
  return Boolean(script.placement.length) && !script.placement.some(value => SUPPORTED_NORMAL_PLACEMENTS.has(value))
}

function normalizedDepthBounds(script: RegexScript) {
  const min = script.minDepth == null || script.minDepth < 0 ? undefined : Math.floor(script.minDepth)
  const max = script.maxDepth == null || script.maxDepth < 0 ? undefined : Math.floor(script.maxDepth)
  return { min, max, invalid: min != null && max != null && max < min }
}

function regexDepthMatches(script: RegexScript, source: RegexSource, depth?: number) {
  if (source === 'world-info' || source === 'slash-command') return { matches: true, invalid: false }
  const bounds = normalizedDepthBounds(script)
  if (bounds.invalid) return { matches: false, invalid: true }
  const currentDepth = Math.max(0, Math.floor(depth ?? 0))
  if (bounds.min != null && currentDepth < bounds.min) return { matches: false, invalid: false }
  if (bounds.max != null && currentDepth > bounds.max) return { matches: false, invalid: false }
  return { matches: true, invalid: false }
}

/**
 * Determines whether a script should run in a specific ephemeral phase.
 * Persistent message scripts run once in storage, not again in display/prompt, because their result is already canonical.
 * World Info has no chat-storage row, so persistent scripts are applied while assembling the outgoing prompt.
 */
export function regexRunsInPhase(script: RegexScript, source: RegexSource, phase: RegexPhase) {
  const mode = regexEphemerality(script)
  if (source === 'world-info') {
    if (phase !== 'outgoing-prompt') return false
    return mode === 'persistent' || mode === 'prompt-only' || mode === 'display-and-prompt'
  }
  if (phase === 'storage') return mode === 'persistent'
  if (phase === 'display') return mode === 'display-only' || mode === 'display-and-prompt'
  return mode === 'prompt-only' || mode === 'display-and-prompt'
}

/**
 * Pre-filter a phase whose message depth is not known yet (for example historical outgoing Prompt rows).
 * Depth is intentionally NOT evaluated here; applyRegexStage() evaluates minDepth/maxDepth per real message later.
 */
export function regexScriptsForDynamicDepthPhase(
  scripts: RegexScript[],
  options: Pick<RegexStageOptions, 'source' | 'phase' | 'event'>
) {
  return scripts.filter(script => {
    if (!script.enabled || !script.findRegex) return false
    if (!regexPlacementMatches(script, options.source)) return false
    if (!regexRunsInPhase(script, options.source, options.phase)) return false
    if (options.event === 'edit' && !script.runOnEdit) return false
    return true
  })
}

export function regexScriptsForStage(scripts: RegexScript[], options: Omit<RegexStageOptions, 'macros'>) {
  return regexScriptsForDynamicDepthPhase(scripts, options).filter(script =>
    regexDepthMatches(script, options.source, options.depth).matches
  )
}

export function applyRegexStage(text: string, scripts: RegexScript[], options: RegexStageOptions): RegexStageResult {
  let output = text
  const applied: string[] = []
  const traces: RegexExecutionTrace[] = []
  const sorted = scripts.slice().sort((a, b) => regexExecutionOrder(a) - regexExecutionOrder(b) || a.createdAt.localeCompare(b.createdAt))

  for (const script of sorted) {
    const baseTrace = { scriptId: script.id, name: script.name, source: options.source, phase: options.phase, depth: options.depth } as const
    if (!script.enabled || !script.findRegex) continue
    if (hasUnsupportedOnlyPlacement(script)) {
      traces.push({ ...baseTrace, applied: false, reason: 'unsupported-placement' })
      continue
    }
    if (!regexPlacementMatches(script, options.source)) {
      traces.push({ ...baseTrace, applied: false, reason: 'wrong-placement' })
      continue
    }
    if (!regexRunsInPhase(script, options.source, options.phase)) {
      traces.push({ ...baseTrace, applied: false, reason: 'wrong-phase' })
      continue
    }
    if (options.event === 'edit' && !script.runOnEdit) {
      traces.push({ ...baseTrace, applied: false, reason: 'edit-disabled' })
      continue
    }
    const depth = regexDepthMatches(script, options.source, options.depth)
    if (!depth.matches) {
      traces.push({ ...baseTrace, applied: false, reason: depth.invalid ? 'invalid-depth' : 'depth' })
      continue
    }
    const next = applyRegexScript(output, script, options.macros)
    if (next !== output) {
      applied.push(script.name)
      traces.push({ ...baseTrace, applied: true, reason: 'matched' })
      output = next
    } else {
      traces.push({ ...baseTrace, applied: false, reason: 'no-match' })
    }
  }

  return { text: output, applied, rich: looksLikeRichHtml(output), traces }
}

/** Compatibility helper: applies the supplied scripts exactly once without phase filtering. */
export function applyRegexScripts(text: string, scripts: RegexScript[], macros?: { user?: string; char?: string }) {
  let output = text
  const applied: string[] = []
  for (const script of scripts.slice().sort((a, b) => regexExecutionOrder(a) - regexExecutionOrder(b) || a.createdAt.localeCompare(b.createdAt))) {
    const next = applyRegexScript(output, script, macros)
    if (next !== output) applied.push(script.name)
    output = next
  }
  return { text: output, applied, rich: looksLikeRichHtml(output) }
}

/** Returns active scripts scoped to a source. Phase filtering is intentionally separate. */
export async function listActiveRegexScripts(characterId: string, target: RegexTarget): Promise<RegexScript[]> {
  const activeIds = new Set(await getCharacterResourceIds(characterId, 'regex'))
  const rows = await db.regexScripts.toArray()
  return rows
    .filter(item => item.enabled && activeIds.has(item.id))
    .filter(item => {
      // Old callers used target='prompt'. Keep it as a safe compatibility view: prompt-affecting scripts only,
      // but never pretend they target the whole system prompt.
      if (target === 'prompt') return item.promptOnly
      return regexPlacementMatches(item, target)
    })
    .sort((a, b) => regexExecutionOrder(a) - regexExecutionOrder(b) || a.createdAt.localeCompare(b.createdAt))
}

export function normalizeRichHtml(value: string) {
  const trimmed = value.trim()
  const fullyFenced = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i)
  let source = (fullyFenced?.[1] || trimmed).trim()

  source = source.replace(/```html\s*([\s\S]*?)\s*```/gi, (_whole, body: string) => String(body).trim())

  const documentToFragment = (documentHtml: string) => {
    const styles = [...documentHtml.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(match => match[0])
    const body = documentHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    if (body != null) return [...styles, body].join('\n')
    return documentHtml
      .replace(/<!doctype[^>]*>/gi, '')
      .replace(/<\/?html\b[^>]*>/gi, '')
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, styles.join('\n'))
      .replace(/<\/?body\b[^>]*>/gi, '')
  }

  source = source.replace(/(?:<!doctype\s+html[^>]*>\s*)?<html\b[^>]*>[\s\S]*?<\/html>/gi, documentToFragment)

  if (/^\s*<!doctype\s+html/i.test(source) && /<body\b/i.test(source)) {
    source = documentToFragment(source)
  }

  // 老社区卡常在 HTML / <details> 开场里混用 Markdown 图片。这里只转成静态图片，
  // 后续仍由 SafeRichHtml 做 URL / DOM 清洗，不执行任何第三方脚本。
  source = source.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi, (_whole, alt: string, url: string) => {
    const safeAlt = String(alt).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const safeUrl = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy">`
  })

  return source.trim()
}

export function looksLikeRichHtml(value: string) {
  const source = normalizeRichHtml(value)
  return /<(?:style|div|details|summary|section|article|span|img|table|p|audio|video|html|body|main|header|footer|ul|ol|li)\b/i.test(source)
}

export function normalizeCommunityPlainText(value: string) {
  if (looksLikeRichHtml(value)) return value.trim()
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function applyRegexPipeline(options: {
  text: string
  characterId: string
  target: RegexTarget
  phase?: RegexPhase
  depth?: number
  event?: RegexEvent
  userName?: string
  characterName?: string
}) {
  if (options.target === 'prompt') {
    // Legacy API safety: promptOnly has no source by itself. Applying it to an arbitrary whole prompt would be wrong.
    // New callers must choose user-input / assistant-output / world-info and phase='outgoing-prompt'.
    return { text: options.text, applied: [], rich: looksLikeRichHtml(options.text), traces: [] as RegexExecutionTrace[] }
  }
  const scripts = await listActiveRegexScripts(options.characterId, options.target)
  return applyRegexStage(options.text, scripts, {
    source: options.target,
    phase: options.phase || (options.target === 'world-info' ? 'outgoing-prompt' : 'display'),
    depth: options.depth,
    event: options.event,
    macros: { user: options.userName, char: options.characterName }
  })
}
