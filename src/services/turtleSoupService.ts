import { createProvider } from './ai/providerFactory'
import { NATIVE_APP_TEXT_ONLY_RULE, sanitizeNativeAppText } from './appPresentationPolicy'
import { getModelSettings, MAX_OUTPUT_TOKENS } from './modelSettings'
import type { ChatTurn } from './ai/provider'

/**
 * 🍲 海龟汤 —— 主持人可由“我”的好友角色来当（也可以退回 🐢 普通主持人）。
 *
 * 玩法：
 * 1. 开局选一位主持人（默认好友里的第一个，或 🐢）；
 * 2. AI 按“这位主持人亲历/亲眼撞见的一件怪事”编题，汤底对玩家保密；
 * 3. 玩家随便提问（是不是/为什么/细节…），主持人用 TA 的人设口吻聊着聊着给线索，
 *    但绝不能一次把整段真相说完；
 * 4. 想通了「猜汤底」交卷 → 判对则揭晓完整真相。
 *
 * 纯函数部分（解析/构建/校验/计分/角色描述）单独导出便于单测；联网部分抛
 * TurtleSoupUnconfiguredError（没配好 AI）或 provider 既有错误。
 */

export type SoupDifficulty = '简单' | '标准' | '烧脑'

/** 主持人人设画像：来自世界里某个角色，或退化成普通 🐢。 */
export interface TurtleSoupHost {
  name: string
  kind: 'character' | 'turtle'
  avatar?: string
  persona?: string
  speakingStyle?: string
  relationship?: string
  mood?: string
  activity?: string
  identity?: string
  age?: number
  likes?: string[]
  dislikes?: string[]
}

export interface TurtleSoupScenario {
  title: string
  /** 汤面：主持人第一人称转述的怪事开头，玩家看得见。 */
  situation: string
  /** 汤底：完整真相。局内对玩家保密，藏在主持人 system 消息里。 */
  solution: string
  /** 可选线索素材，主持人给提示时的落点。 */
  hint?: string
}

export interface SoupHistoryTurn {
  role: 'user' | 'assistant'
  text: string
}

export class TurtleSoupUnconfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TurtleSoupUnconfiguredError'
  }
}

export const MAX_HISTORY_TURNS = 60

/**
 * 「备汤」是开放式创作，宽松上限会放任模型放飞写超长、拖慢备汤。
 * 这里单独给一个够用又快的硬上限：3000 token 足够装下整套题（汤面+汤底+线索）。
 * 对局轮次的回答不走这个上限，仍随全局设置。
 */
export const SCENARIO_MAX_TOKENS = 3000

/** 普通主持人的兜底人设：点 🐢 时用。 */
export function makeDefaultTurtleHost(): TurtleSoupHost {
  return {
    name: '主持人',
    kind: 'turtle',
    avatar: '🐢',
    persona: '一只见多识广、喜欢卖关子的老乌龟，什么怪事都见过，愿意陪你慢慢推。',
    speakingStyle: '慢悠悠、带点慈祥，爱用“嗯——”“有意思”开头，把提示藏在话缝里。',
    relationship: '和你很熟，看你卡壳时会心软多给半句。'
  }
}

/** 把世界里的一个角色转成主持人人设。纯函数。 */
export function soupHostFromCharacter(character: {
  name?: string
  avatar?: string
  persona?: string
  speakingStyle?: string
  relationship?: string
  mood?: string
  activity?: string
  identity?: string
  age?: number
  likes?: string[]
  dislikes?: string[]
}): TurtleSoupHost {
  return {
    name: character.name || '无名角色',
    kind: 'character',
    avatar: character.avatar,
    persona: character.persona,
    speakingStyle: character.speakingStyle,
    relationship: character.relationship,
    mood: character.mood,
    activity: character.activity,
    identity: character.identity,
    age: character.age,
    likes: character.likes,
    dislikes: character.dislikes
  }
}

// ---------------------------------------------------------------------------
// 纯函数
// ---------------------------------------------------------------------------

function firstDefined(
  source: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

/**
 * 解析模型返回的“开局题面 JSON”，容忍代码围栏 / 外层引号 / 前后废话。
 * 取不到「汤面」或「汤底」任一即视为解析失败，返回 null。
 */
export function parseScenarioResponse(raw: string): TurtleSoupScenario | null {
  let text = String(raw ?? '')
    .replace(/```json|```/g, ' ')
    .trim()

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const source = parsed as Record<string, unknown>
  const situation = sanitizeSoupText(firstDefined(source, ['situation', '汤面', '谜面', '场景']))
  const solution = sanitizeSoupText(firstDefined(source, ['solution', '汤底', '真相', '答案']))
  if (!situation || !solution) return null

  const scenario: TurtleSoupScenario = {
    title: sanitizeSoupText(firstDefined(source, ['title', '标题', '名字'])) || '一锅无名汤',
    situation,
    solution
  }
  const hint = sanitizeSoupText(firstDefined(source, ['hint', '线索', '提示']))
  if (hint) scenario.hint = hint
  return scenario
}

/** 主持人画像的中文描述，拼进各类提示词。 */
export function describeHost(host: TurtleSoupHost): string {
  const lines: string[] = [`名字：${host.name}`]
  if (host.age !== undefined) lines.push(`年龄：${host.age}`)
  if (host.identity) lines.push(`身份：${host.identity}`)
  if (host.persona) lines.push(`性格：${host.persona}`)
  if (host.speakingStyle) lines.push(`说话风格：${host.speakingStyle}`)
  if (host.relationship) lines.push(`与“我”的关系：${host.relationship}`)
  if (host.mood) lines.push(`此刻心情：${host.mood}`)
  if (host.activity) lines.push(`此刻在做什么：${host.activity}`)
  if (host.likes?.length) lines.push(`喜欢：${host.likes.join('、')}`)
  if (host.dislikes?.length) lines.push(`不喜欢：${host.dislikes.join('、')}`)
  return lines.join('\n')
}

/** 难度决定题面反转的烈度。 */
const DIFFICULTY_GUIDES: Record<SoupDifficulty, string> = {
  简单: '谜底要温和、贴近日常，第一反应想不到但解释后很容易接受，线索直白。',
  标准: '谜底有一定反转，逻辑要自洽，别用超自然或纯巧合当答案。',
  烧脑: '谜底反转要狠、藏得深，要靠多问细节才能拼出真相，别三两句猜中。'
}

/**
 * 构建“开局出题”的消息：让 AI 想一件主持人亲历/撞见的怪事。
 * 纯函数。
 */
export function buildScenarioMessages(
  host: TurtleSoupHost,
  difficulty: SoupDifficulty
): ChatTurn[] {
  const rules = [
    '你在为一个“海龟汤”游戏出题。海龟汤：先给玩家一个看似离谱的短场景（汤面），玩家靠追问拼出藏在背后的完整真相（汤底）。',
    `本次的叙述者是下面这位（TA 会把这件事讲给「我」听，TA 亲历或亲眼撞见）：\n${describeHost(host)}`,
    '请给这位叙述者编一件发生在 TA 生活里、让 TA 觉得“怪/不对劲/难忘”的小事：反常点要醒目（第一眼觉得不合理），但动机与解释要合情合理，不能拿“外星人/疯子/做梦”当答案。',
    '必须输出严格 JSON（不要 markdown 围栏、不要任何额外文字）：',
    '{"title":"一句话标题","situation":"汤面：TA 用第一人称讲给「我」听的开头，2~3 句，只描述看到的怪现象、不含解释","solution":"完整汤底：按时间顺序讲清到底发生了什么、为什么，逻辑自洽、信息完整（这一条玩家看不到）","hint":"一条线索：一句不点破关键反转、但能让玩家往前推一步的提示"}',
    '要求：situation 只写“能直接看到/听到”的部分，真相与动机只进 solution；行为要与叙述者性格相符。',
    '长度控制（为了快，别写长）：title ≤ 12 字；situation 2~3 句即可；solution 控制在 150 字以内、说清真相就行；hint 一句话。',
    'JSON 每个字段值只写自然语言，不得塞入 HTML、CSS、状态栏、按钮或其它界面代码。'
  ].join('\n')

  return [
    { role: 'system', content: rules },
    {
      role: 'user',
      content: `难度：${difficulty}\n${DIFFICULTY_GUIDES[difficulty]}\n请出一道全新的海龟汤。`
    }
  ]
}

export function sanitizeSoupText(raw: string): string {
  return sanitizeNativeAppText(raw)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const QUESTION_MAX = 120

export interface QuestionCheck {
  ok: boolean
  /** 规范化后的提问（用于发送）。 */
  question: string
  reason?: string
}

/**
 * 提问校验：现在对“开放式”也放行（角色主持人会接着话头给线索），
 * 只兜底空/过长。纯函数。
 */
export function inspectQuestion(input: string): QuestionCheck {
  const question = String(input ?? '').trim().replace(/\s+/g, '')
  if (question.length < 2) {
    return { ok: false, question: '', reason: '说具体点，多问两句。' }
  }
  if (question.length > QUESTION_MAX) {
    return { ok: false, question: '', reason: '一次别问太多，拆开问更好套话。' }
  }
  return { ok: true, question }
}

/**
 * 主持人身份 + 本局汤底构成的 system 提示。所有对局轮次共用，
 * 保证“回答是这一个人设、且对得上汤底”。
 */
function buildHostSystem(host: TurtleSoupHost, scenario: TurtleSoupScenario): string {
  return [
    `你是下面这位，正在给「我」讲一件你亲历/亲眼撞见的怪事（海龟汤）。以下是本局完整真相（汤底），它是机密，玩家看不到：`,
    JSON.stringify({ title: scenario.title, solution: scenario.solution }),
    `你的人设：\n${describeHost(host)}`,
    '对话要求：',
    '1. 始终以这个人设、第一人称、口语化地说话，像朋友聊自己遇到的怪事。',
    '2. 玩家能用“是不是/有没有”回答的问题，你自然地先给出 是/不是 的意思，再随口补一两句；开放问题也别硬挡，能聊就聊，聊的过程里可以漏一点点线索。',
    '3. 绝不可一次说出完整真相或总结句（不许出现“其实真相是/原来是因为/汤底是”这类话）；顶多一步步给小提示。',
    '4. 每条回复 1～3 句，别写小作文；可以自然带一处很短的动作、神态或心里反应（例如“（他顿了一下）”），但不要写成长篇旁白。',
    `5. ${NATIVE_APP_TEXT_ONLY_RULE}`
  ].join('\n')
}

/**
 * 构建“玩家问、主持人用人设回”的对话。只带最近一段历史防膨胀。纯函数。
 */
export function buildHostQuestionMessages(
  scenario: TurtleSoupScenario,
  host: TurtleSoupHost,
  history: SoupHistoryTurn[],
  question: string
): ChatTurn[] {
  const historyTurns: ChatTurn[] = history
    .slice(-MAX_HISTORY_TURNS)
    .map(turn => ({ role: turn.role, content: turn.text }))

  return [
    { role: 'system', content: buildHostSystem(host, scenario) },
    ...historyTurns,
    { role: 'user', content: `「我」问你：${question}` }
  ]
}

/** 构建“我卡壳了，要提示”的对话：让人设主持人在角色里给一句不泄底的小提示。纯函数。 */
export function buildClueRequestMessages(
  scenario: TurtleSoupScenario,
  host: TurtleSoupHost
): ChatTurn[] {
  const extra = scenario.hint
    ? `\n（如果你愿意，可以用这句当素材并换成你的口气：${scenario.hint}）`
    : ''
  return [
    { role: 'system', content: buildHostSystem(host, scenario) },
    {
      role: 'user',
      content: `「我」说：我有点卡住了，给点提示吧。${extra}\n请用人设口吻给一条线索，别把关键一步直接说穿。`
    }
  ]
}

/** 构建“交卷猜汤底”的对话。主持只判 对 / 不对。纯函数。 */
export function buildGuessMessages(
  scenario: TurtleSoupScenario,
  guess: string
): ChatTurn[] {
  const rules = [
    '你是一个海龟汤游戏的裁判。下面 JSON 是本局唯一真相（汤底）：',
    JSON.stringify({ title: scenario.title, solution: scenario.solution }),
    '玩家交出了对整件事的推测。判断 TA 是否基本还原了真相。',
    '正确或已点破关键真相 → 只回复两个字：对',
    '不对、遗漏关键或仍有出入 → 只回复两个字：不对',
    '除此之外不要输出任何解释、提示或评语。'
  ].join('\n')

  return [
    { role: 'system', content: rules },
    { role: 'user', content: `我的推测：${guess}` }
  ]
}

// ---------------------------------------------------------------------------
// 反向玩法：“我当主持人”——我自己出汤面/汤底，让好友来猜。
// 关键安全点：好友（猜测方）的 prompt 只给「汤面」，绝不掺入「汤底」。
// ---------------------------------------------------------------------------

function buildGuesserSystem(
  guesser: TurtleSoupHost,
  situation: string
): string {
  return [
    '你在玩一锅海龟汤。主持人（「我」）刚才给你讲了一件 TA 亲历或亲眼撞见的怪事，你只听得到下面这段，其余真相要靠你提问问出来：',
    `汤面：${situation}`,
    `你的人设：\n${describeHost(guesser)}`,
    '游戏规则：',
    '1. 你一次只问一个、能用“是 / 不是 / 无关”回答的封闭问题（关于故事里的人、行为、时间、地点、动机都行）。',
    '2. 别一次问好几个，别自问自答，别急着说出你的推测——真正想交卷时主持人会让你猜。',
    '3. 语气贴你的人设，像跟朋友聊天那样打探，1～2 句收尾；可以有一处很短的动作、神态或心里反应。',
    `4. ${NATIVE_APP_TEXT_ONLY_RULE}`
  ].join('\n')
}

/**
 * 构建“好友（猜测方）问下一个问题”的对话。history 由上层按
 * 好友=assistant / 主持人=user 排好。纯函数。
 */
export function buildFriendQuestionMessages(
  guesser: TurtleSoupHost,
  situation: string,
  history: SoupHistoryTurn[]
): ChatTurn[] {
  const historyTurns: ChatTurn[] = history
    .slice(-MAX_HISTORY_TURNS)
    .map(turn => ({ role: turn.role, content: turn.text }))

  return [
    { role: 'system', content: buildGuesserSystem(guesser, situation) },
    ...historyTurns,
    { role: 'user', content: '（现在轮到你发问。）' }
  ]
}

/** 构建“主持人示意好友交卷猜汤底”的对话。纯函数。 */
export function buildFriendGuessMessages(
  guesser: TurtleSoupHost,
  situation: string,
  history: SoupHistoryTurn[]
): ChatTurn[] {
  const historyTurns: ChatTurn[] = history
    .slice(-MAX_HISTORY_TURNS)
    .map(turn => ({ role: turn.role, content: turn.text }))

  return [
    { role: 'system', content: buildGuesserSystem(guesser, situation) },
    ...historyTurns,
    {
      role: 'user',
      content:
        '（主持人示意你可以交卷了。请把你拼出来的完整推测讲出来——用“我推测：”开头，把线索串成一段 1～3 句的话，即使没把握也尽力猜。）'
    }
  ]
}

export interface SoupRating {
  tag: string
  stars: number
}

/** 根据问了多少个问题、用了多少秒给出结算评语。纯函数。 */
export function rateSoupGame(
  questionCount: number,
  seconds: number
): SoupRating {
  const fast = seconds > 0 && seconds <= 120 ? '（手速还很快 ⚡）' : ''
  if (questionCount <= 8) {
    return { tag: `🧠 一眼看穿汤底${fast}`, stars: 5 }
  }
  if (questionCount <= 14) {
    return { tag: `🕵️ 推理高手${fast}`, stars: 4 }
  }
  if (questionCount <= 22) {
    return { tag: '🌊 稳步逼近', stars: 3 }
  }
  if (questionCount <= 35) {
    return { tag: '🐢 锲而不舍', stars: 3 }
  }
  return { tag: '🔥 硬是把汤喝完了', stars: 2 }
}

// ---------------------------------------------------------------------------
// 联网部分
// ---------------------------------------------------------------------------

async function requireConfigured() {
  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    throw new TurtleSoupUnconfiguredError(
      '还没配好可用的 AI。请先到「设置 → API 与模型」填好 API 地址、Key 和模型，才能开锅。'
    )
  }
  return settings
}

async function chatOnce(
  messages: ChatTurn[],
  temperature: number,
  capTokens?: number
): Promise<string> {
  const settings = await requireConfigured()
  // capTokens 传了就本请求单独设上限（备汤用，收得更紧些，超了也截断保留不报错）。
  const provider = createProvider(
    capTokens && capTokens > 0
      ? { ...settings, maxTokens: Math.min(MAX_OUTPUT_TOKENS, Math.max(64, Math.round(capTokens))) }
      : settings
  )
  const response = await provider.chat({
    model: settings.model,
    temperature,
    messages
  })
  return String(response?.text ?? '').trim()
}

/** 开局：让 AI 为这位主持人按难度编一题。备汤自带硬上限防慢。 */
export async function generateScenario(
  host: TurtleSoupHost,
  difficulty: SoupDifficulty
): Promise<TurtleSoupScenario> {
  const raw = await chatOnce(
    buildScenarioMessages(host, difficulty),
    0.9,
    SCENARIO_MAX_TOKENS
  )
  const scenario = parseScenarioResponse(raw)
  if (!scenario) {
    throw new Error('主持人没把汤备好，请再开一锅试试。')
  }
  return scenario
}

/** 玩家问一句，主持人用人设口吻回（会自然带是/不是意思或小线索）。 */
export async function askHostQuestion(
  scenario: TurtleSoupScenario,
  host: TurtleSoupHost,
  history: SoupHistoryTurn[],
  question: string
): Promise<string> {
  const raw = await chatOnce(
    buildHostQuestionMessages(scenario, host, history, question),
    0.85
  )
  return sanitizeSoupText(raw)
}

/** 玩家要提示：主持人用人设口吻给一句不泄底线索。 */
export async function askHostForClue(
  scenario: TurtleSoupScenario,
  host: TurtleSoupHost
): Promise<string> {
  const raw = await chatOnce(buildClueRequestMessages(scenario, host), 0.85)
  return sanitizeSoupText(raw)
}

/** 交卷猜汤底，裁判只判 对 / 不对。 */
export async function judgeSoupGuess(
  scenario: TurtleSoupScenario,
  guess: string
): Promise<boolean> {
  const raw = await chatOnce(buildGuessMessages(scenario, guess), 0.2)
  const text = sanitizeSoupText(raw).replace(/[。.!！…~]/g, '')
  if (/^不对/.test(text)) return false
  return /^对/.test(text)
}

/** 好友（猜测方）问下一个问题。汤底不会进入这条 prompt，只给汤面 + 过往问答。 */
export async function askGuesserQuestion(
  guesser: TurtleSoupHost,
  situation: string,
  history: SoupHistoryTurn[]
): Promise<string> {
  const raw = await chatOnce(
    buildFriendQuestionMessages(guesser, situation, history),
    0.85
  )
  return sanitizeSoupText(raw)
}

/** 主持人示意好友交卷 → 好友给出自己的完整推测。同样不掺汤底。 */
export async function askGuesserGuess(
  guesser: TurtleSoupHost,
  situation: string,
  history: SoupHistoryTurn[]
): Promise<string> {
  const raw = await chatOnce(
    buildFriendGuessMessages(guesser, situation, history),
    0.8
  )
  return sanitizeSoupText(raw)
}
