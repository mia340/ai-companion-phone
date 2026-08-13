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

export function applyRegexScript(text: string, script: RegexScript, macros?: { user?: string; char?: string }) {
  if (!script.enabled || !script.findRegex) return text
  const pattern = parsePattern(substituteMacros(script.findRegex, script, macros))
  if (!pattern) return text
  const replacement = substituteReplacementMacros(script.replaceString || '', macros)
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
  const fullyFenced = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i)
  let source = (fullyFenced?.[1] || trimmed).trim()

  // HTML fence 可能只是整条回复中的一部分；只解开 html fence，不破坏社区自己需要的普通 code block。
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

  // 社区正则经常返回完整 document。逐块转为 Shadow DOM 可挂载 fragment，
  // 这样正文 + HTML UI 混合输出时也不会把正文一起丢掉。
  source = source.replace(/(?:<!doctype\s+html[^>]*>\s*)?<html\b[^>]*>[\s\S]*?<\/html>/gi, documentToFragment)

  // 容错：少数模板只带 doctype/head/body，没有完整 </html>。
  if (/^\s*<!doctype\s+html/i.test(source) && /<body\b/i.test(source)) {
    source = documentToFragment(source)
  }

  return source.trim()
}

export function looksLikeRichHtml(value: string) {
  const source = normalizeRichHtml(value)
  return /<(?:style|div|details|summary|section|article|span|img|table|p|audio|video|html|body|main|header|footer|ul|ol|li)\b/i.test(source)
}

/**
 * 很多 Tavo / 酒馆开场只用 <br> 做换行，并不是一整块 HTML UI。
 * 这类内容应该作为普通聊天文本显示真实换行，而不是把“<br>”字样漏进气泡。
 */
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
  userName?: string
  characterName?: string
}) {
  const scripts = await listActiveRegexScripts(options.characterId, options.target)
  return applyRegexScripts(options.text, scripts, { user: options.userName, char: options.characterName })
}
