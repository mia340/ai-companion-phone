function splitEscapedCsv(value: string) {
  const rows: string[] = []
  let current = ''
  let escaped = false
  for (const char of value) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === ',') {
      rows.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  rows.push(current.trim())
  return rows.filter(Boolean)
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function resolveChoice(value: string, stableSeed?: string) {
  const normalized = value.replace(/^\s*:\s*/, '')
  const choices = splitEscapedCsv(normalized)
  if (!choices.length) return ''
  if (!stableSeed) return choices[Math.floor(Math.random() * choices.length)] || choices[0]
  return choices[stableHash(`${stableSeed}\u0000${value}`) % choices.length] || choices[0]
}

/**
 * 角色卡 Prompt 宏。只在一次 Prompt 组装结束时调用，避免 UI 重渲染导致 random/roll 不断变化。
 */
export function renderCharacterCardPromptText(
  value: string | undefined,
  userName?: string,
  characterName?: string,
  stableSeed?: string,
  options: { angleCharacterAliases?: boolean } = {}
): string | undefined {
  if (!value) return value
  const resolvedCharacterName = characterName?.trim() || '角色'
  let output = value
    .replace(/\{\{\s*\/\/\s*[\s\S]*?\}\}/g, '')
    .replace(/\{\{\s*comment\s*:[\s\S]*?\}\}/gi, '')
    .replace(/\{\{\s*hidden_key\s*:[\s\S]*?\}\}/gi, '')
    .replace(/\{\{\s*user\s*\}\}/gi, userName?.trim() || '你')
    .replace(/\{\{\s*char\s*\}\}/gi, resolvedCharacterName)
    .replace(/\{\{\s*pick\s*:\s*([^{}]+)\}\}/gi, (_match, body: string) => resolveChoice(body, stableSeed || 'pick'))
    .replace(/\{\{\s*random\s*:\s*([^{}]+)\}\}/gi, (_match, body: string) => resolveChoice(body))
    .replace(/\{\{\s*roll\s*:\s*d?(\d+)\s*\}\}/gi, (_match, sidesRaw: string) => {
      const sides = Math.max(1, Math.min(1_000_000, Number(sidesRaw) || 1))
      return String(1 + Math.floor(Math.random() * sides))
    })
  if (options.angleCharacterAliases) {
    output = output.replace(/<(?:char|bot)>/gi, resolvedCharacterName)
  }
  return output
}

/** 仅做稳定的 UI 文本宏替换；不执行 random/pick/roll。 */
export function renderRoleplayText(
  value: string | undefined,
  userName?: string,
  characterName?: string
): string | undefined {
  if (!value) return value
  return value
    .replace(/\{\{\s*user\s*\}\}/gi, userName?.trim() || '你')
    .replace(/\{\{\s*char\s*\}\}/gi, characterName?.trim() || '角色')
}
