import { z } from 'zod'
import { db } from '../db/database'
import type { AppCustomization } from '../types/domain'

export type CoupleBoardIntensity = 1 | 2 | 3 | 4
export type CoupleBoardMode = 'chat' | 'reality'
export type CoupleBoardPlayerId = 'user' | 'partner'
export type CoupleBoardPromptType = 'truth' | 'dare'
export type CoupleBoardCellType =
  | 'start'
  | 'truth'
  | 'dare'
  | 'heart'
  | 'surprise'
  | 'boost'
  | 'rewind'
  | 'rest'
  | 'finish'

export interface CoupleBoardCell {
  index: number
  type: CoupleBoardCellType
  label: string
  emoji: string
}

export interface CoupleBoardPrompt {
  id: string
  type: CoupleBoardPromptType
  intensity: CoupleBoardIntensity
  modes: CoupleBoardMode[]
  text: string
  adultOnly?: boolean
}

export interface CoupleBoardSettings {
  characterId: string
  characterName: string
  characterAvatar?: string
  characterAge?: number
  intensity: CoupleBoardIntensity
  mode: CoupleBoardMode
  adultConfirmed: boolean
}

export interface CoupleBoardPlayerState {
  id: CoupleBoardPlayerId
  name: string
  position: number
  hearts: number
  completed: number
  skipped: number
}

export interface CoupleBoardPendingChallenge {
  actor: CoupleBoardPlayerId
  cellIndex: number
  promptId: string
  promptType: CoupleBoardPromptType
  replacementCount: number
}

export interface CoupleBoardTurnLog {
  id: string
  actor: CoupleBoardPlayerId
  dice: number
  from: number
  to: number
  cellType: CoupleBoardCellType
  promptId?: string
  resolution?: 'completed' | 'skipped'
  createdAt: string
}

export interface CoupleBoardGame {
  version: 1
  id: string
  status: 'playing' | 'finished'
  settings: CoupleBoardSettings
  currentPlayer: CoupleBoardPlayerId
  winner?: CoupleBoardPlayerId
  lastDice?: number
  turn: number
  players: Record<CoupleBoardPlayerId, CoupleBoardPlayerState>
  pending?: CoupleBoardPendingChallenge
  history: CoupleBoardTurnLog[]
  createdAt: string
  updatedAt: string
}

const BOARD_PATTERN: Array<Pick<CoupleBoardCell, 'type' | 'label' | 'emoji'>> = [
  { type: 'start', label: '起点', emoji: '💗' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'surprise', label: '盲盒', emoji: '✨' },
  { type: 'boost', label: '贴近', emoji: '🪽' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'rest', label: '抱一会', emoji: '🫶' },
  { type: 'surprise', label: '盲盒', emoji: '✨' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'rewind', label: '害羞', emoji: '🙈' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'surprise', label: '盲盒', emoji: '✨' },
  { type: 'boost', label: '贴近', emoji: '🪽' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'rest', label: '喘口气', emoji: '🌙' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'surprise', label: '盲盒', emoji: '✨' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'rewind', label: '脸红', emoji: '🌹' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'surprise', label: '最后盲盒', emoji: '💫' },
  { type: 'finish', label: '终点', emoji: '💘' }
]

export const COUPLE_BOARD_CELLS: CoupleBoardCell[] = BOARD_PATTERN.map((cell, index) => ({ index, ...cell }))

const BOTH_MODES: CoupleBoardMode[] = ['chat', 'reality']

export const COUPLE_BOARD_PROMPTS: CoupleBoardPrompt[] = [
  // L1 · sweet
  { id: 't1-01', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '第一次觉得 {partner} 很特别，是在什么瞬间？' },
  { id: 't1-02', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '如果今天只能夸 {partner} 一件事，你最想夸什么？' },
  { id: 't1-03', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '你最喜欢和 {partner} 一起度过哪一种普通日常？' },
  { id: 't1-04', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '你希望 {partner} 更经常对你说哪句话？' },
  { id: 't1-05', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '如果给你们的关系起一个电影名，你会叫什么？' },
  { id: 't1-06', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '最近一次因为 {partner} 偷偷开心是什么时候？' },
  { id: 't1-07', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '你觉得自己在 {partner} 面前最可爱的一面是什么？' },
  { id: 't1-08', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '选一个最想和 {partner} 一起实现的小愿望。' },
  { id: 'd1-01', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '认真对 {partner} 说一句今天份的喜欢。' },
  { id: 'd1-02', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '用三个词形容 {partner}，不许想太久。' },
  { id: 'd1-03', type: 'dare', intensity: 1, modes: ['chat'], text: '发一条只由三个 emoji 组成的“我喜欢你”。' },
  { id: 'd1-04', type: 'dare', intensity: 1, modes: ['reality'], text: '和 {partner} 碰一下拳，再把手留住三秒。' },
  { id: 'd1-05', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '给 {partner} 取一个这一局限定的可爱昵称。' },
  { id: 'd1-06', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '说一句“如果今天很累，我会怎么哄你”。' },
  { id: 'd1-07', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '把一句普通的“晚安”说得像偶像剧台词。' },
  { id: 'd1-08', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '让 {partner} 指定一个词，你用它完成一句表白。' },

  // L2 · flirt
  { id: 't2-01', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '你最容易因为 {partner} 的哪个小动作心跳加快？' },
  { id: 't2-02', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '如果可以把一次约会重来，你最想重来哪一种场景？' },
  { id: 't2-03', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '你最想听 {partner} 用什么称呼叫你？' },
  { id: 't2-04', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '有没有一件你会吃醋、但平时不太好意思承认的事？' },
  { id: 't2-05', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '如果今晚只有你和 {partner}，你最想怎么安排两个小时？' },
  { id: 't2-06', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '说一个你希望 {partner} 更主动一点的瞬间。' },
  { id: 't2-07', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '你觉得 {partner} 最有吸引力的气质是什么？' },
  { id: 't2-08', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '如果允许偷看 {partner} 一个想法，你最想知道什么？' },
  { id: 'd2-01', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '用一句暧昧但不过界的话，让 {partner} 猜猜你在想什么。' },
  { id: 'd2-02', type: 'dare', intensity: 2, modes: ['chat'], text: '给 {partner} 发一条“只看前半句像在生气，读完却很甜”的消息。' },
  { id: 'd2-03', type: 'dare', intensity: 2, modes: ['reality'], text: '在双方都舒服的前提下，和 {partner} 对视十秒，谁先笑谁认输。' },
  { id: 'd2-04', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '说出一个你想被 {partner} 偏爱的具体方式。' },
  { id: 'd2-05', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '模仿一次 {partner} 最让你心动的语气或说话方式。' },
  { id: 'd2-06', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '把“我想你”换成一句不能出现“想”字的表达。' },
  { id: 'd2-07', type: 'dare', intensity: 2, modes: ['reality'], text: '如果双方愿意，给 {partner} 一个至少五秒的拥抱。' },
  { id: 'd2-08', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '由 {partner} 选“可爱 / 酷 / 黏人”，你用对应风格说一句情话。' },

  // L3 · intimate
  { id: 't3-01', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '在亲密关系里，你最需要被确认的安全感是什么？' },
  { id: 't3-02', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你最喜欢 {partner} 哪个外貌或身体细节？可以只说让你舒服的程度。' },
  { id: 't3-03', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '有没有一种亲密互动，你希望 {partner} 先询问再主动？' },
  { id: 't3-04', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你觉得“被需要”和“被尊重边界”之间最理想的平衡是什么？' },
  { id: 't3-05', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你最想和 {partner} 建立哪一种只属于两个人的小习惯？' },
  { id: 't3-06', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '说一个会让你立刻变得很黏人的情境。' },
  { id: 't3-07', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '如果 {partner} 想让你更放松，你希望 TA 怎么做？' },
  { id: 't3-08', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你认为一段亲密关系里最不能被忽略的边界是什么？' },
  { id: 'd3-01', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '用一句很近、很私密但仍然尊重边界的话夸 {partner}。' },
  { id: 'd3-02', type: 'dare', intensity: 3, modes: ['reality'], text: '在双方同意的前提下，让 {partner} 选择“牵手 / 拥抱 / 靠肩”中的一个，保持十秒。' },
  { id: 'd3-03', type: 'dare', intensity: 3, modes: ['chat'], text: '写一条“如果你现在就在我身边，我会……”的暧昧消息，保留让双方都舒服的边界。' },
  { id: 'd3-04', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '告诉 {partner} 一个你愿意被 TA 主动靠近的信号，也说清一个停止信号。' },
  { id: 'd3-05', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '说一句只有非常亲近的人才能听到的软话。' },
  { id: 'd3-06', type: 'dare', intensity: 3, modes: ['reality'], text: '如果双方愿意，靠近到能听清彼此呼吸的位置，停留五秒后再决定要不要继续。' },
  { id: 'd3-07', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '让 {partner} 选一个词，你把它变成一句带点挑逗感但不越界的情话。' },
  { id: 'd3-08', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '交换一个“可以更主动”的许可和一个“今晚不想碰”的边界。' },

  // L4 · adult, consent-first, non-explicit
  { id: 't4-01', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '只在你愿意的范围内，说一个你对成年人亲密关系的幻想主题，不需要描述具体过程。' },
  { id: 't4-02', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '哪一种被 {partner} 主动靠近的方式最容易让你心动？先说边界，再说偏好。' },
  { id: 't4-03', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '你最喜欢亲密时对方是温柔、直接、黏人还是带点坏心眼？为什么？' },
  { id: 't4-04', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '说一个你愿意和 {partner} 讨论、但不会默认同意的成人亲密尝试。' },
  { id: 't4-05', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '如果今晚的亲密氛围由你设计，你更在意灯光、距离、语言还是节奏？' },
  { id: 't4-06', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '什么样的确认方式会让你在更亲密的互动里最安心？' },
  { id: 't4-07', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '有没有一种只适合伴侣之间的称呼或语气，会让你明显脸红？' },
  { id: 't4-08', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '在成年人亲密互动里，你最看重的三件事是什么？' },
  { id: 'd4-01', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '用一句只适合成年伴侣之间的暧昧话逗 {partner}；任何一方不舒服就立即换题。' },
  { id: 'd4-02', type: 'dare', intensity: 4, modes: ['reality'], adultOnly: true, text: '在双方明确同意的前提下，选择一个更久一点的拥抱或亲吻；任意一方都可以随时停。' },
  { id: 'd4-03', type: 'dare', intensity: 4, modes: ['chat'], adultOnly: true, text: '写一句成年人之间的私密邀请，但必须同时给对方一个很容易说“不”的出口。' },
  { id: 'd4-04', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '告诉 {partner}：“今晚我愿意更靠近的程度是……”，并让对方也说自己的范围。' },
  { id: 'd4-05', type: 'dare', intensity: 4, modes: ['reality'], adultOnly: true, text: '如果双方愿意，让 {partner} 选择一个舒服的亲密接触，并由你问一次“这样可以吗？”。' },
  { id: 'd4-06', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '说一句带明显心动感的成人情话，但不替对方假设任何同意。' },
  { id: 'd4-07', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '各自说一个“可以主动一点”的信号和一个“必须停下”的信号。' },
  { id: 'd4-08', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '让 {partner} 在“更温柔 / 更直接 / 更黏人”里选一个，你用一句话回应对应氛围。' }
]

const settingsSchema = z.object({
  characterId: z.string().min(1),
  characterName: z.string().min(1).max(80),
  characterAvatar: z.string().optional(),
  characterAge: z.number().finite().positive().optional(),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  mode: z.union([z.literal('chat'), z.literal('reality')]),
  adultConfirmed: z.boolean()
})

const playerSchema = z.object({
  id: z.union([z.literal('user'), z.literal('partner')]),
  name: z.string(),
  position: z.number().int().min(0).max(COUPLE_BOARD_CELLS.length - 1),
  hearts: z.number().int().min(0),
  completed: z.number().int().min(0),
  skipped: z.number().int().min(0)
})

const gameSchema: z.ZodType<CoupleBoardGame> = z.object({
  version: z.literal(1),
  id: z.string(),
  status: z.union([z.literal('playing'), z.literal('finished')]),
  settings: settingsSchema,
  currentPlayer: z.union([z.literal('user'), z.literal('partner')]),
  winner: z.union([z.literal('user'), z.literal('partner')]).optional(),
  lastDice: z.number().int().min(1).max(6).optional(),
  turn: z.number().int().min(1),
  players: z.object({ user: playerSchema, partner: playerSchema }),
  pending: z.object({
    actor: z.union([z.literal('user'), z.literal('partner')]),
    cellIndex: z.number().int().min(0).max(COUPLE_BOARD_CELLS.length - 1),
    promptId: z.string(),
    promptType: z.union([z.literal('truth'), z.literal('dare')]),
    replacementCount: z.number().int().min(0).max(9)
  }).optional(),
  history: z.array(z.object({
    id: z.string(),
    actor: z.union([z.literal('user'), z.literal('partner')]),
    dice: z.number().int().min(1).max(6),
    from: z.number().int().min(0).max(COUPLE_BOARD_CELLS.length - 1),
    to: z.number().int().min(0).max(COUPLE_BOARD_CELLS.length - 1),
    cellType: z.enum(['start', 'truth', 'dare', 'heart', 'surprise', 'boost', 'rewind', 'rest', 'finish']),
    promptId: z.string().optional(),
    resolution: z.union([z.literal('completed'), z.literal('skipped')]).optional(),
    createdAt: z.string()
  })).max(80),
  createdAt: z.string(),
  updatedAt: z.string()
})

const STATE_APP_KEY = '__couple-board-state__'

function nowIso(now = new Date()) {
  return now.toISOString()
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function clampRandom(random: number) {
  if (!Number.isFinite(random)) return 0
  return Math.min(0.999999, Math.max(0, random))
}

function otherPlayer(player: CoupleBoardPlayerId): CoupleBoardPlayerId {
  return player === 'user' ? 'partner' : 'user'
}

function cloneGame(game: CoupleBoardGame): CoupleBoardGame {
  return structuredClone(game)
}

export function validateCoupleBoardAdultMode(settings: CoupleBoardSettings): string | undefined {
  if (settings.intensity !== 4) return undefined
  if (typeof settings.characterAge === 'number' && settings.characterAge < 18) {
    return '成人模式不能用于年龄明确小于 18 岁的角色。'
  }
  if (!settings.adultConfirmed) {
    return '开启 18+ 模式前，需要确认双方均为成年人并同意成人向题目。'
  }
  return undefined
}

export function createCoupleBoardGame(settings: CoupleBoardSettings, now = new Date()): CoupleBoardGame {
  const adultError = validateCoupleBoardAdultMode(settings)
  if (adultError) throw new Error(adultError)
  const timestamp = nowIso(now)
  return {
    version: 1,
    id: randomId('couple-board'),
    status: 'playing',
    settings: { ...settings },
    currentPlayer: 'user',
    turn: 1,
    players: {
      user: { id: 'user', name: '我', position: 0, hearts: 0, completed: 0, skipped: 0 },
      partner: { id: 'partner', name: settings.characterName, position: 0, hearts: 0, completed: 0, skipped: 0 }
    },
    history: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function promptsFor(
  type: CoupleBoardPromptType,
  intensity: CoupleBoardIntensity,
  mode: CoupleBoardMode
) {
  return COUPLE_BOARD_PROMPTS.filter(prompt =>
    prompt.type === type &&
    prompt.intensity <= intensity &&
    prompt.modes.includes(mode) &&
    (!prompt.adultOnly || intensity === 4)
  )
}

export function drawCoupleBoardPrompt(
  type: CoupleBoardPromptType,
  intensity: CoupleBoardIntensity,
  mode: CoupleBoardMode,
  random = Math.random(),
  excludeId?: string
): CoupleBoardPrompt {
  const candidates = promptsFor(type, intensity, mode)
  const withoutExcluded = excludeId ? candidates.filter(prompt => prompt.id !== excludeId) : candidates
  const pool = withoutExcluded.length ? withoutExcluded : candidates
  if (!pool.length) throw new Error('当前模式没有可用题目。')
  return pool[Math.floor(clampRandom(random) * pool.length)]
}

export function getCoupleBoardPrompt(promptId: string) {
  return COUPLE_BOARD_PROMPTS.find(prompt => prompt.id === promptId)
}

export function renderCoupleBoardPrompt(
  prompt: CoupleBoardPrompt,
  actorName: string,
  partnerName: string
) {
  return prompt.text
    .replaceAll('{actor}', actorName)
    .replaceAll('{partner}', partnerName)
}

function challengeTypeForCell(type: CoupleBoardCellType, random: number): CoupleBoardPromptType | undefined {
  if (type === 'truth') return 'truth'
  if (type === 'dare') return 'dare'
  if (type === 'surprise') return clampRandom(random) < 0.5 ? 'truth' : 'dare'
  return undefined
}

export function rollCoupleBoard(
  game: CoupleBoardGame,
  dice: number,
  random = Math.random(),
  now = new Date()
): CoupleBoardGame {
  if (game.status !== 'playing') throw new Error('这一局已经结束。')
  if (game.pending) throw new Error('先完成、换掉或跳过当前题目。')
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new Error('骰子必须是 1 到 6。')

  const next = cloneGame(game)
  const actor = next.currentPlayer
  const player = next.players[actor]
  const from = player.position
  const lastIndex = COUPLE_BOARD_CELLS.length - 1
  let to = Math.min(lastIndex, from + dice)
  let cell = COUPLE_BOARD_CELLS[to]

  if (cell.type === 'boost') {
    to = Math.min(lastIndex, to + 2)
    cell = COUPLE_BOARD_CELLS[to]
  } else if (cell.type === 'rewind') {
    to = Math.max(0, to - 2)
    cell = COUPLE_BOARD_CELLS[to]
  }

  player.position = to
  next.lastDice = dice

  const entry: CoupleBoardTurnLog = {
    id: randomId('turn'),
    actor,
    dice,
    from,
    to,
    cellType: cell.type,
    createdAt: nowIso(now)
  }

  if (to >= lastIndex || cell.type === 'finish') {
    next.status = 'finished'
    next.winner = actor
    player.hearts += 3
    next.history = [...next.history, entry].slice(-80)
    next.updatedAt = nowIso(now)
    return next
  }

  if (cell.type === 'heart') player.hearts += 1

  const promptType = challengeTypeForCell(cell.type, random)
  if (promptType) {
    const prompt = drawCoupleBoardPrompt(promptType, next.settings.intensity, next.settings.mode, random)
    entry.promptId = prompt.id
    next.pending = {
      actor,
      cellIndex: to,
      promptId: prompt.id,
      promptType,
      replacementCount: 0
    }
  } else {
    next.currentPlayer = otherPlayer(actor)
    next.turn += 1
  }

  next.history = [...next.history, entry].slice(-80)
  next.updatedAt = nowIso(now)
  return next
}

export function replaceCoupleBoardPrompt(
  game: CoupleBoardGame,
  random = Math.random(),
  now = new Date()
): CoupleBoardGame {
  if (!game.pending) throw new Error('当前没有可以更换的题目。')
  const next = cloneGame(game)
  const current = next.pending!
  const prompt = drawCoupleBoardPrompt(
    current.promptType,
    next.settings.intensity,
    next.settings.mode,
    random,
    current.promptId
  )
  current.promptId = prompt.id
  current.replacementCount += 1
  const log = [...next.history].reverse().find(entry => entry.actor === current.actor && !entry.resolution)
  if (log) log.promptId = prompt.id
  next.updatedAt = nowIso(now)
  return next
}

export function resolveCoupleBoardChallenge(
  game: CoupleBoardGame,
  resolution: 'completed' | 'skipped',
  now = new Date()
): CoupleBoardGame {
  if (!game.pending) throw new Error('当前没有待处理题目。')
  const next = cloneGame(game)
  const pending = next.pending!
  const player = next.players[pending.actor]

  if (resolution === 'completed') {
    player.hearts += 2
    player.completed += 1
  } else {
    player.hearts = Math.max(0, player.hearts - 1)
    player.skipped += 1
  }

  const log = [...next.history].reverse().find(entry => entry.actor === pending.actor && !entry.resolution)
  if (log) resolution === 'completed' ? (log.resolution = 'completed') : (log.resolution = 'skipped')
  next.pending = undefined
  next.currentPlayer = otherPlayer(pending.actor)
  next.turn += 1
  next.updatedAt = nowIso(now)
  return next
}

export function parseCoupleBoardGame(value: unknown) {
  const parsed = gameSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export async function loadCoupleBoardGame(worldId: string) {
  const row = await db.appCustomizations.get(`${worldId}:${STATE_APP_KEY}`)
  return parseCoupleBoardGame((row as AppCustomization & { coupleBoardState?: unknown } | undefined)?.coupleBoardState)
}

export async function saveCoupleBoardGame(worldId: string, game: CoupleBoardGame) {
  const now = new Date().toISOString()
  const row: AppCustomization & { coupleBoardState: CoupleBoardGame } = {
    id: `${worldId}:${STATE_APP_KEY}`,
    worldId,
    appKey: STATE_APP_KEY,
    coupleBoardState: game,
    updatedAt: now
  }
  await db.appCustomizations.put(row)
  return game
}

export async function clearCoupleBoardGame(worldId: string) {
  await db.appCustomizations.delete(`${worldId}:${STATE_APP_KEY}`)
}

export interface CoupleBoardChatShare {
  conversationId: string
  draft: string
}

export function buildCoupleBoardChatShare(
  game: CoupleBoardGame,
  conversationId: string
): CoupleBoardChatShare | undefined {
  if (!game.pending || !conversationId) return undefined
  const prompt = getCoupleBoardPrompt(game.pending.promptId)
  if (!prompt) return undefined
  const actorName = game.players[game.pending.actor].name
  const counterpartName = game.pending.actor === 'partner' ? '我' : game.settings.characterName
  const text = renderCoupleBoardPrompt(prompt, actorName, counterpartName)
  const intro = game.pending.actor === 'partner'
    ? `我们正在玩「心跳飞行棋」。轮到你了，落在${prompt.type === 'truth' ? '真心话' : '大冒险'}格：`
    : `我们正在玩「心跳飞行棋」。轮到我了，落在${prompt.type === 'truth' ? '真心话' : '大冒险'}格：`
  const instruction = game.pending.actor === 'partner'
    ? '请按你的角色设定回应，但不要替我决定任何现实动作；任何不舒服的内容都可以直接跳过。'
    : '你可以作为伴侣回应我，但不要替我回答，也不要替我决定是否接受现实动作。'
  return {
    conversationId,
    draft: `${intro}\n${text}\n\n${instruction}\n[心跳飞行棋 game:${game.id}; challenge:${prompt.id}]`
  }
}

export function mergeCoupleBoardShareIntoDraft(existing: string, share: CoupleBoardChatShare) {
  const current = existing.trim()
  if (!current) return share.draft
  if (current.includes(`[心跳飞行棋 game:`)) return current
  return `${current}\n\n${share.draft}`
}
