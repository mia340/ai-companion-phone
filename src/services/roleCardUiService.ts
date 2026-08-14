import type { ConversationState } from '../types/domain'

export interface RoleCardUiState {
  date?: string
  time?: string
  location?: string
  inner?: string
  surroundings?: string
  todos?: string[]
}


function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

function parseTodos(value: unknown): string[] {
  const source = clean(value)
  if (!source) return []

  return source
    .replace(/(?:^|\n)\s*[-*•·]\s*/g, '\n')
    .split(/\n+|[；;]+|(?=\d+\s*[.、）)])/) 
    .map(item => item.replace(/^\s*\d+\s*[.、）)]\s*/, '').trim())
    .filter(Boolean)
}

export interface PresenceResolution {
  reportedPresence?: 'together' | 'remote'
  resolvedPresence?: 'together' | 'remote'
  source: 'manual' | 'direct-contact' | 'co-presence' | 'ui-surroundings' | 'reported-status' | 'unknown'
  reason: string
  conflict?: boolean
  uiSurroundings?: string
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

  const source = text.replace(/\r\n/g, '\n').replace(/<br\s*\/?\s*>/gi, '\n')
  const ui: RoleCardUiState = {}
  let found = 0
  const linePattern = /^\s*(日期|时间|地点|内心|心声|周围|待办)\s*[|：:]\s*(.+?)\s*$/gm
  for (const match of source.matchAll(linePattern)) {
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

  // 常见 Tavo 状态栏：📆日期｜时间｜天气 / 🗺地点 / ♥内心。
  const calendarLine = source.match(/(?:^|\n)\s*📆\s*([^\n]+)/)?.[1]?.trim()
  if (calendarLine) {
    const parts = calendarLine.split(/[｜|]/).map(item => item.trim()).filter(Boolean)
    if (!ui.date && parts[0]) { ui.date = parts[0]; found += 1 }
    if (!ui.time && parts[1]) { ui.time = parts[1]; found += 1 }
  }
  const location = source.match(/(?:^|\n)\s*🗺(?:️)?\s*([^\n]+)/)?.[1]?.trim()
  if (!ui.location && location) { ui.location = location; found += 1 }
  const inner = source.match(/(?:^|\n)\s*[♥❤💗]\s*内心\s*[:：]\s*([^\n]+)/)?.[1]?.trim()
  if (!ui.inner && inner) { ui.inner = inner; found += 1 }
  const present = source.match(/(?:^|\n)\s*😶\s*(?:在场角色|周围)\s*[:：]\s*([^\n]+)/)?.[1]?.trim()
  if (!ui.surroundings && present) { ui.surroundings = present; found += 1 }

  // XML 状态栏只提取世界状态，不在这里删除标签；后续 Regex 仍可用完整 XML 渲染社区 UI。
  const xmlValue = (tag: string) => source.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, 'i'))?.[1]?.trim()
  const xmlDate = xmlValue('日期')
  const xmlTime = xmlValue('时间')
  const xmlLocation = xmlValue('地点')
  if (!ui.date && xmlDate) { ui.date = xmlDate; found += 1 }
  if (!ui.time && xmlTime) { ui.time = xmlTime; found += 1 }
  if (!ui.location && xmlLocation) { ui.location = xmlLocation; found += 1 }

  return found >= 2 ? ui : undefined
}

const DIRECT_CONTACT_PATTERN = /(?:把你(?:抱|搂|揽|环|圈|捞|拉|拽|按|压|扶|牵|握|扣|拥)进|将你(?:抱|搂|揽|环|圈|捞|拉|拽|按|压|扶|牵|握|扣|拥)进|抱住你|抱着你|搂住你|搂着你|揽住你|揽着你|牵住你|牵着你|握住你|握着你的手|扣住你|环住你|圈住你|吻你|亲你|亲上你|吻上你|摸了摸你|抚过你|揉了揉你|拍了拍你|拍了下你|轻拍你|贴着你|贴近你|靠在你|靠着你|埋进你|埋在你|蹭着你|蹭了蹭你|鼻尖蹭着你|额头抵着你|抵住你|压住你|扶住你|拉住你|拽住你|替你掖|给你掖|躺在你身边|睡在你身边|和你同床|与你同床|彼此的呼吸|(?:捏|掐|托|抬|碰|触|擦|抚|按|扣)(?:着|住|了|过)?你(?:的)?(?:下巴|脸|脸颊|手|手腕|肩|腰|后背|额头|发顶|头发|膝|脚踝)|指腹(?:擦过|蹭过|抵着|按着)你(?:的)?(?:下巴|脸|脸颊|手|手腕)|(?:指尖|手指|手掌|掌心)?(?:轻轻)?(?:压在|按在|搭在|落在)你(?:的)?(?:手腕|腕脉|肩|额头|脸|脸颊|手背)|指尖在你(?:掌心|手心|手背|腕间|手腕)(?:不经意)?(?:一触|轻触|碰触))/
const CO_PRESENCE_PATTERN = /(?:走到你身边|坐到你身边|坐在你旁边|坐在你床边|坐在你榻边|站在你面前|来到你面前|俯身看你|低头看你|看向你|望向你|目光落在你(?:的)?(?:脸|脸上|身上|眼睛|双眼|手|指尖|肩|身前)|目光落在你.{0,16}(?:脸|脸上|身上|眼睛|双眼|手|指尖|肩|身前)|看了你一眼|从你身边|递到你手里|放到你手边|与你同处(?:一室|一屋|房间|院中|巷中|车内)|和你同处(?:一室|一屋|房间|院中|巷中|车内))/

export function resolvePresenceFromRoleCardScene(
  text: string,
  ui?: RoleCardUiState,
  reportedPresence?: 'together' | 'remote'
): PresenceResolution {
  const surroundings = ui?.surroundings?.trim() || ''
  const content = text
    .replace(/\{\{\s*user\s*\}\}/gi, '你')
    .replace(/<\s*\/?\s*scene[_-]?action\b[^>]*>/gi, '')
    .replace(/\s+/g, '')
  const hasDirectContact = DIRECT_CONTACT_PATTERN.test(content)
  const hasCoPresence = CO_PRESENCE_PATTERN.test(content)
  const uiTogether = Boolean(surroundings && /(?:(?:用户|\{\{user\}\}|你|对方)在场|(?:和|与)(?:用户|\{\{user\}\}|你|对方)(?:同处|一起)|(?:用户|\{\{user\}\}|你|对方)(?:就在)?身边)/.test(surroundings))
  const uiAlone = /独处|独自|只有自己|无人/.test(surroundings)

  if (hasDirectContact) {
    const conflict = reportedPresence === 'remote' || uiAlone
    return {
      reportedPresence,
      resolvedPresence: 'together',
      source: 'direct-contact',
      conflict,
      uiSurroundings: surroundings || undefined,
      reason: conflict
        ? '检测到角色与用户发生直接身体接触，覆盖“远程/独处”冲突状态。'
        : '检测到角色与用户发生直接身体接触，判定双方处于同一现场。'
    }
  }

  if (uiTogether) {
    return {
      reportedPresence,
      resolvedPresence: 'together',
      source: 'ui-surroundings',
      conflict: reportedPresence === 'remote',
      uiSurroundings: surroundings,
      reason: '角色卡“周围”字段明确表示用户在场，判定双方处于同一现场。'
    }
  }

  if (hasCoPresence) {
    return {
      reportedPresence,
      resolvedPresence: 'together',
      source: 'co-presence',
      conflict: reportedPresence === 'remote' || uiAlone,
      uiSurroundings: surroundings || undefined,
      reason: '回复包含只能在同一空间自然发生的近距离互动，判定双方处于同一现场。'
    }
  }

  if (reportedPresence) {
    return {
      reportedPresence,
      resolvedPresence: reportedPresence,
      source: 'reported-status',
      uiSurroundings: surroundings || undefined,
      reason: `采用模型结构化状态：${reportedPresence === 'together' ? '同场景' : '远程'}。`
    }
  }

  if (uiAlone) {
    return {
      resolvedPresence: 'remote',
      source: 'ui-surroundings',
      uiSurroundings: surroundings,
      reason: '没有发现用户在场或直接接触证据，角色卡“周围”字段为独处，判定远程。'
    }
  }

  return { source: 'unknown', reason: '本轮没有足够场景证据，保持上一轮相处状态。', uiSurroundings: surroundings || undefined }
}

export function inferPresenceFromRoleCardScene(text: string, ui?: RoleCardUiState): 'together'|'remote'|undefined {
  return resolvePresenceFromRoleCardScene(text, ui).resolvedPresence
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
