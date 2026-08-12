import type { Character, ConversationState } from '../types/domain'

export interface RoleCardUiState {
  date?: string
  time?: string
  location?: string
  inner?: string
  surroundings?: string
  todos?: string[]
}

const UI_MARKERS = ['{日期:', '{时间:', '{地点:', '{内心:', '{周围:', '{待办:']

function clean(value?: string) {
  return value?.replace(/```/g, '').trim() || undefined
}

function parseTodos(value?: string): string[] | undefined {
  const text = clean(value)
  if (!text) return undefined
  const numbered = text.split(/(?=\d+[\.、])/).map(item => item.replace(/^\d+[\.、]\s*/, '').trim()).filter(Boolean)
  if (numbered.length > 1) return numbered.slice(0, 5)
  return text.split(/[；;\n]/).map(item => item.trim()).filter(Boolean).slice(0, 5)
}

export function characterRequiresRoleCardUi(character: Pick<Character, 'persona'|'systemPrompt'|'postHistoryInstructions'|'creatorNotes'|'firstMessage'>): boolean {
  const source = [character.persona, character.systemPrompt, character.postHistoryInstructions, character.creatorNotes, character.firstMessage].filter(Boolean).join('\n')
  return /每次回复.{0,20}(附带|包含).{0,20}UI/i.test(source) || UI_MARKERS.filter(marker => source.includes(marker)).length >= 3
}

export function parseRoleCardUi(text: string): { content: string; ui?: RoleCardUiState } {
  let working = text.replace(/\r\n/g, '\n')
  const ui: RoleCardUiState = {}
  let found = 0

  // {日期:2017-6-9|时间:晚上}
  working = working.replace(/\{日期\s*:\s*([^|}\n]*)(?:\|\s*时间\s*:\s*([^}\n]*))?\}/g, (_all, date, time) => {
    ui.date = clean(date)
    if (time) ui.time = clean(time)
    found += 1
    return ''
  })
  // standalone {时间:...}
  working = working.replace(/\{时间\s*:\s*([^}\n]*)\}/g, (_all, value) => {
    ui.time = clean(value); found += 1; return ''
  })
  working = working.replace(/\{地点\s*:\s*([^}\n]*)\}/g, (_all, value) => {
    ui.location = clean(value); found += 1; return ''
  })
  working = working.replace(/\{内心\s*:\s*([^}\n]*)\}/g, (_all, value) => {
    ui.inner = clean(value); found += 1; return ''
  })
  working = working.replace(/\{周围\s*:\s*([^}\n]*)\}/g, (_all, value) => {
    ui.surroundings = clean(value); found += 1; return ''
  })
  working = working.replace(/\{待办\s*:\s*([^}]*)\}/g, (_all, value) => {
    ui.todos = parseTodos(value); found += 1; return ''
  })

  if (!found) return { content: text.trim() }

  // UI 常被包在 Markdown 代码围栏中。字段移除后把空围栏也清掉。
  working = working
    .replace(/```(?:json|text)?\s*```/gi, '')
    .replace(/^\s*```(?:json|text)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { content: working, ui }
}


export function extractRoleCardUiHints(text: string): RoleCardUiState | undefined {
  const parsed = parseRoleCardUi(text)
  if (parsed.ui) return parsed.ui

  const ui: RoleCardUiState = {}
  let found = 0
  const linePattern = /^\s*(日期|时间|地点|内心|心声|周围|待办)\s*[|：:]\s*(.+?)\s*$/gm
  for (const match of text.replace(/\r\n/g, '\n').matchAll(linePattern)) {
    const key = match[1]
    const value = clean(match[2])
    if (!value) continue
    found += 1
    if (key === '日期') ui.date = value
    else if (key === '时间') ui.time = value
    else if (key === '地点') ui.location = value
    else if (key === '内心' || key === '心声') ui.inner = value
    else if (key === '周围') ui.surroundings = value
    else if (key === '待办') ui.todos = parseTodos(value)
  }
  return found >= 2 ? ui : undefined
}

export function inferPresenceFromRoleCardScene(text: string, ui?: RoleCardUiState): 'together'|'remote'|undefined {
  const surroundings = ui?.surroundings || ''
  const content = text.replace(/\s+/g, '')
  // 明确发生在用户身上的现实动作优先级最高。部分社区卡会把“周围:独处”
  // 用作“无第三人在场”，即使用户其实就在角色身边，不能因此误判远程。
  if (/(看了你一眼|看着你|望着你|将你|把你|抱住你|抱着你|搂住你|搂着你|牵住你|牵着你|吻你|亲你|摸了摸你|替你|靠近你|贴着你|彼此的呼吸|你身边|你怀里|你的怀里|和你同床|与你同床|躺在你|睡在你)/.test(content)) return 'together'
  if (surroundings && /在场|同处|一起|身边/.test(surroundings)) return 'together'
  if (/独处|独自|只有自己/.test(surroundings)) return 'remote'
  return undefined
}

export function roleCardUiToConversationPatch(text: string, ui?: RoleCardUiState): Partial<ConversationState> {
  if (!ui) return {}
  return {
    location: ui.location || undefined,
    innerThought: ui.inner || undefined,
    timePeriod: [ui.date, ui.time].filter(Boolean).join(' ') || undefined,
    presence: inferPresenceFromRoleCardScene(text, ui),
    shortTermGoals: ui.todos?.length ? ui.todos : undefined
  }
}
