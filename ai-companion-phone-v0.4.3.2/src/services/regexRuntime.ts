import { db } from '../db/database'
import { getCharacterResourceIds } from './resourceBindingService'
import type { RegexScript } from '../types/domain'

export type RegexTarget = 'user-input' | 'assistant-output' | 'world-info' | 'prompt'

function targetPlacement(target: RegexTarget) {
  if (target === 'user-input') return 1
  if (target === 'assistant-output') return 2
  if (target === 'world-info') return 5
  return -1
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

function expandReplacement(template: string, match: string, groups: string[]) {
  let output = template.replace(/\{\{match\}\}/g, match).replace(/\$&/g, match)
  groups.forEach((group, index) => {
    output = output.replace(new RegExp(`\\$${index + 1}(?!\\d)`, 'g'), group ?? '')
  })
  return output
}

export function applyRegexScript(text: string, script: RegexScript, macros?: { user?: string; char?: string }) {
  if (!script.enabled || !script.findRegex) return text
  const pattern = parsePattern(substituteMacros(script.findRegex, script, macros))
  if (!pattern) return text
  const replacement = script.replaceString || ''
  return text.replace(pattern, (...args: unknown[]) => {
    const match = String(args[0] ?? '')
    const offset = typeof args.at(-2) === 'number' ? Number(args.at(-2)) : 0
    void offset
    const groupCount = Math.max(0, args.length - 3)
    const groups = args.slice(1, 1 + groupCount).map(value => String(value ?? ''))
    const trimmed = (script.trimStrings || []).reduce((current, item) => item ? current.split(item).join('') : current, match)
    return expandReplacement(replacement, trimmed, groups)
  })
}

export function applyRegexScripts(text: string, scripts: RegexScript[], macros?: { user?: string; char?: string }) {
  let output = text
  const applied: string[] = []
  for (const script of scripts) {
    const next = applyRegexScript(output, script, macros)
    if (next !== output) applied.push(script.name)
    output = next
  }
  return { text: output, applied, rich: looksLikeRichHtml(output) }
}

export async function listActiveRegexScripts(characterId: string, target: RegexTarget): Promise<RegexScript[]> {
  const activeIds = new Set(await getCharacterResourceIds(characterId, 'regex'))
  const rows = await db.regexScripts.toArray()
  const placement = targetPlacement(target)
  return rows
    .filter(item => item.enabled)
    .filter(item => activeIds.has(item.id))
    .filter(item => {
      if (target === 'prompt') return item.promptOnly
      if (item.promptOnly) return false
      return item.placement.length === 0 ? target === 'assistant-output' : item.placement.includes(placement)
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}


export function normalizeRichHtml(value: string) {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i)
  return (fenced?.[1] || trimmed).trim()
}

export function looksLikeRichHtml(value: string) {
  const source = normalizeRichHtml(value)
  return /<(?:style|div|details|summary|section|article|span|img|table|p|audio|video)\b/i.test(source)
}

export async function applyRegexPipeline(options: {
  text: string
  characterId: string
  target: RegexTarget
  userName?: string
  characterName?: string
}) {
  const scripts = await listActiveRegexScripts(options.characterId, options.target)
  return applyRegexScripts(options.text, scripts, { user: options.userName, char: options.characterName })
}
