import { z } from 'zod'
import { db } from '../db/database'
import { sanitizeNativeAppText } from './appPresentationPolicy'
import type { AppCustomization } from '../types/domain'

export type CoupleBoardIntensity = 1 | 2 | 3 | 4
export type CoupleBoardMode = 'chat' | 'reality'
export type CoupleBoardPlayerId = 'user' | 'partner'
export type CoupleBoardPromptType = 'truth' | 'dare'
export type CoupleBoardPromptSource = 'builtin' | 'custom' | 'memory-ai'
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
  source?: CoupleBoardPromptSource
  memoryEvidenceIds?: string[]
  /** V1.2 unified evidence ids; timeline ids use the timeline: prefix. */
  evidenceIds?: string[]
}

export interface CoupleBoardCustomPromptDraft {
  type: CoupleBoardPromptType
  intensity: CoupleBoardIntensity
  modes: CoupleBoardMode[]
  text: string
}

export interface CoupleBoardPreferences {
  version: 2
  customPrompts: CoupleBoardPrompt[]
  customEventCards: CoupleBoardEventCard[]
  disabledBuiltinPromptIds: string[]
  disabledBuiltinEventCardIds: string[]
  updatedAt: string
}

export interface CoupleBoardCustomEventCardDraft {
  title: string
  text: string
  emoji: string
  heartDeltaActor: number
  heartDeltaOther: number
  swapPositions?: boolean
  extraTurn?: boolean
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

export interface CoupleBoardEventCard {
  id: string
  title: string
  text: string
  emoji: string
  heartDeltaActor: number
  heartDeltaOther: number
  source?: 'builtin' | 'custom'
  swapPositions?: boolean
  extraTurn?: boolean
}

export interface CoupleBoardPendingEvent {
  actor: CoupleBoardPlayerId
  cellIndex: number
  eventCardId: string
}

export interface CoupleBoardTurnLog {
  id: string
  actor: CoupleBoardPlayerId
  dice: number
  from: number
  to: number
  cellType: CoupleBoardCellType
  promptId?: string
  eventCardId?: string
  resolution?: 'completed' | 'skipped'
  createdAt: string
}

export interface CoupleBoardHighlight {
  id: string
  emoji: string
  eyebrow: string
  title: string
  detail: string
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
  pendingEvent?: CoupleBoardPendingEvent
  /** Custom prompts are frozen into the session; AI-memory prompts are stored here only for this game. */
  sessionPrompts?: CoupleBoardPrompt[]
  /** V1.2 freezes the event deck too, so editing the library never mutates an active game. */
  sessionEventCards?: CoupleBoardEventCard[]
  /** V1.2 freezes disabled built-in prompts for the current session. */
  disabledPromptIds?: string[]
  history: CoupleBoardTurnLog[]
  createdAt: string
  updatedAt: string
}

const BOARD_PATTERN: Array<Pick<CoupleBoardCell, 'type' | 'label' | 'emoji'>> = [
  { type: 'start', label: '起点', emoji: '💗' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'surprise', label: '事件', emoji: '💌' },
  { type: 'boost', label: '贴近', emoji: '🪽' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'rest', label: '抱一会', emoji: '🫶' },
  { type: 'surprise', label: '事件', emoji: '💌' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'rewind', label: '害羞', emoji: '🙈' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'surprise', label: '事件', emoji: '💌' },
  { type: 'boost', label: '贴近', emoji: '🪽' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'rest', label: '喘口气', emoji: '🌙' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'surprise', label: '事件', emoji: '💌' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'rewind', label: '脸红', emoji: '🌹' },
  { type: 'heart', label: '心动', emoji: '💞' },
  { type: 'truth', label: '真心话', emoji: '💬' },
  { type: 'dare', label: '大冒险', emoji: '🎀' },
  { type: 'surprise', label: '最后事件', emoji: '💫' },
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
  { id: 't1-09', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '第一次和 {partner} 聊天时，你对 TA 的第一印象是什么？' },
  { id: 't1-10', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '你最喜欢 {partner} 哪一种照顾人的方式？' },
  { id: 't1-11', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '如果给你们安排一个没有任务的周末，你最想一起做什么？' },
  { id: 't1-12', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '最近有什么小事，让你很想认真对 {partner} 说一声谢谢？' },
  { id: 't1-13', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '你最想和 {partner} 保留哪一个每周都能重复的小仪式？' },
  { id: 't1-14', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '说一个 {partner} 的口头禅、表情或习惯，让你一想到就会笑。' },
  { id: 't1-15', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '如果今天要拍一张“我们”的照片，你希望背景在哪里？' },
  { id: 't1-16', type: 'truth', intensity: 1, modes: BOTH_MODES, text: '你觉得你们最适合一起养成什么轻松的新习惯？' },
  { id: 'd1-01', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '认真对 {partner} 说一句今天份的喜欢。' },
  { id: 'd1-02', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '用三个词形容 {partner}，不许想太久。' },
  { id: 'd1-03', type: 'dare', intensity: 1, modes: ['chat'], text: '发一条只由三个 emoji 组成的“我喜欢你”。' },
  { id: 'd1-04', type: 'dare', intensity: 1, modes: ['reality'], text: '和 {partner} 碰一下拳，再把手留住三秒。' },
  { id: 'd1-05', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '给 {partner} 取一个这一局限定的可爱昵称。' },
  { id: 'd1-06', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '说一句“如果今天很累，我会怎么哄你”。' },
  { id: 'd1-07', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '把一句普通的“晚安”说得像偶像剧台词。' },
  { id: 'd1-08', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '让 {partner} 指定一个词，你用它完成一句表白。' },
  { id: 'd1-09', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '连续说出 {partner} 三个优点，中间不许停超过两秒。' },
  { id: 'd1-10', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '把 {partner} 比作一种天气，并说一句为什么。' },
  { id: 'd1-11', type: 'dare', intensity: 1, modes: ['chat'], text: '发一句只有十个字以内的“今天也想和你说话”。' },
  { id: 'd1-12', type: 'dare', intensity: 1, modes: ['reality'], text: '和 {partner} 一起比一个心，停三秒再放下。' },
  { id: 'd1-13', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '让 {partner} 从 1 到 5 选一个数字，你就说出同样数量的喜欢理由。' },
  { id: 'd1-14', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '一起发明一个只属于这一局的暗号，并现场用一次。' },
  { id: 'd1-15', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '用一句话补全：“和你在一起，我最放松的时候是……”' },
  { id: 'd1-16', type: 'dare', intensity: 1, modes: BOTH_MODES, text: '选“谢谢 / 想念 / 抱歉”中的一个，对 {partner} 说一句具体的话。' },

  // L2 · flirt
  { id: 't2-01', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '你最容易因为 {partner} 的哪个小动作心跳加快？' },
  { id: 't2-02', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '如果可以把一次约会重来，你最想重来哪一种场景？' },
  { id: 't2-03', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '你最想听 {partner} 用什么称呼叫你？' },
  { id: 't2-04', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '有没有一件你会吃醋、但平时不太好意思承认的事？' },
  { id: 't2-05', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '如果今晚只有你和 {partner}，你最想怎么安排两个小时？' },
  { id: 't2-06', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '说一个你希望 {partner} 更主动一点的瞬间。' },
  { id: 't2-07', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '你觉得 {partner} 最有吸引力的气质是什么？' },
  { id: 't2-08', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '如果允许偷看 {partner} 一个想法，你最想知道什么？' },
  { id: 't2-09', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '什么时候你会特别想听 {partner} 主动说“我在”？' },
  { id: 't2-10', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '你觉得你们两个人谁更容易先服软？为什么？' },
  { id: 't2-11', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '有没有一种约会安排，你嘴上说普通，心里其实很期待？' },
  { id: 't2-12', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '你最喜欢 {partner} 在什么场合只把注意力放在你身上？' },
  { id: 't2-13', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '如果你突然很想撒娇，你最希望 {partner} 怎么接住你？' },
  { id: 't2-14', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '说一个你明明很在意、却容易装作无所谓的小瞬间。' },
  { id: 't2-15', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '哪一种“偏心”会让你觉得甜，而不是有压力？' },
  { id: 't2-16', type: 'truth', intensity: 2, modes: BOTH_MODES, text: '如果 {partner} 今天只能满足你一个小要求，你会选什么？' },
  { id: 'd2-01', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '用一句暧昧但不过界的话，让 {partner} 猜猜你在想什么。' },
  { id: 'd2-02', type: 'dare', intensity: 2, modes: ['chat'], text: '给 {partner} 发一条“只看前半句像在生气，读完却很甜”的消息。' },
  { id: 'd2-03', type: 'dare', intensity: 2, modes: ['reality'], text: '在双方都舒服的前提下，和 {partner} 对视十秒，谁先笑谁认输。' },
  { id: 'd2-04', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '说出一个你想被 {partner} 偏爱的具体方式。' },
  { id: 'd2-05', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '模仿一次 {partner} 最让你心动的语气或说话方式。' },
  { id: 'd2-06', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '把“我想你”换成一句不能出现“想”字的表达。' },
  { id: 'd2-07', type: 'dare', intensity: 2, modes: ['reality'], text: '如果双方愿意，给 {partner} 一个至少五秒的拥抱。' },
  { id: 'd2-08', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '由 {partner} 选“可爱 / 酷 / 黏人”，你用对应风格说一句情话。' },
  { id: 'd2-09', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '盯着 {partner} 的头像或眼睛，说一句你平时会害羞到不敢说的话。' },
  { id: 'd2-10', type: 'dare', intensity: 2, modes: ['chat'], text: '发一条“今晚给你一个特权：____”的消息，特权必须轻松、可拒绝。' },
  { id: 'd2-11', type: 'dare', intensity: 2, modes: ['reality'], text: '让 {partner} 选“牵手 / 靠肩 / 对视”中的一个；双方愿意才做十秒。' },
  { id: 'd2-12', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '把一句普通的“你在干嘛”改成一条明显更暧昧的问法。' },
  { id: 'd2-13', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '用“我承认，我有点……”开头，坦白一个关于 {partner} 的心动。' },
  { id: 'd2-14', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '让 {partner} 选一个昵称，你接下来一回合只能用这个昵称叫 TA。' },
  { id: 'd2-15', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '说一句带点吃醋但不会控制对方的话，并补上一句你的真实需要。' },
  { id: 'd2-16', type: 'dare', intensity: 2, modes: BOTH_MODES, text: '各自说一个“我希望你更主动一点”的小场景，只描述自己，不替对方承诺。' },

  // L3 · intimate
  { id: 't3-01', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '在亲密关系里，你最需要被确认的安全感是什么？' },
  { id: 't3-02', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你最喜欢 {partner} 哪个外貌或身体细节？可以只说让你舒服的程度。' },
  { id: 't3-03', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '有没有一种亲密互动，你希望 {partner} 先询问再主动？' },
  { id: 't3-04', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你觉得“被需要”和“被尊重边界”之间最理想的平衡是什么？' },
  { id: 't3-05', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你最想和 {partner} 建立哪一种只属于两个人的小习惯？' },
  { id: 't3-06', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '说一个会让你立刻变得很黏人的情境。' },
  { id: 't3-07', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '如果 {partner} 想让你更放松，你希望 TA 怎么做？' },
  { id: 't3-08', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你认为一段亲密关系里最不能被忽略的边界是什么？' },
  { id: 't3-09', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '当你情绪很重时，你更希望 {partner} 陪着、抱抱、给空间，还是先问你？' },
  { id: 't3-10', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '哪一种亲密称呼会让你觉得被珍惜，而不是被冒犯？' },
  { id: 't3-11', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '如果发生争执，你最希望 {partner} 记住你的哪个“修复方式”？' },
  { id: 't3-12', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '有没有一种你很喜欢的靠近方式，但需要在特定心情下才舒服？' },
  { id: 't3-13', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '你最希望 {partner} 怎么确认“现在这样可以吗”？' },
  { id: 't3-14', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '什么情况下你会需要对方先停下来，而不是继续安慰或追问？' },
  { id: 't3-15', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '对你来说，“很亲密”更像身体距离、说真话、被理解，还是一起承担？' },
  { id: 't3-16', type: 'truth', intensity: 3, modes: BOTH_MODES, text: '说一个你愿意让 {partner} 更了解的脆弱面，也说清你希望被怎样对待。' },
  { id: 'd3-01', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '用一句很近、很私密但仍然尊重边界的话夸 {partner}。' },
  { id: 'd3-02', type: 'dare', intensity: 3, modes: ['reality'], text: '在双方同意的前提下，让 {partner} 选择“牵手 / 拥抱 / 靠肩”中的一个，保持十秒。' },
  { id: 'd3-03', type: 'dare', intensity: 3, modes: ['chat'], text: '写一条“如果你现在就在我身边，我会……”的暧昧消息，保留让双方都舒服的边界。' },
  { id: 'd3-04', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '告诉 {partner} 一个你愿意被 TA 主动靠近的信号，也说清一个停止信号。' },
  { id: 'd3-05', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '说一句只有非常亲近的人才能听到的软话。' },
  { id: 'd3-06', type: 'dare', intensity: 3, modes: ['reality'], text: '如果双方愿意，靠近到能听清彼此呼吸的位置，停留五秒后再决定要不要继续。' },
  { id: 'd3-07', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '让 {partner} 选一个词，你把它变成一句带点挑逗感但不越界的情话。' },
  { id: 'd3-08', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '交换一个“可以更主动”的许可和一个“今晚不想碰”的边界。' },
  { id: 'd3-09', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '各自说一句“你这样做我会很安心”，把需要讲具体一点。' },
  { id: 'd3-10', type: 'dare', intensity: 3, modes: ['chat'], text: '发一句“我现在最想靠近你的方式是____，你可以直接说想不想。”' },
  { id: 'd3-11', type: 'dare', intensity: 3, modes: ['reality'], text: '先问一句“我可以靠近一点吗？”，只有得到明确同意才往前挪一点。' },
  { id: 'd3-12', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '用一句话告诉 {partner}：什么样的拒绝方式会让你最容易理解和接受。' },
  { id: 'd3-13', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '说一个你喜欢的亲密信号，再说一个你希望对方看到就停下来的信号。' },
  { id: 'd3-14', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '让 {partner} 选“温柔 / 调皮 / 认真”，你用对应语气说一句很近的喜欢。' },
  { id: 'd3-15', type: 'dare', intensity: 3, modes: ['reality'], text: '如果双方愿意，牵住对方的手十秒；中途任何一方松手都算完成。' },
  { id: 'd3-16', type: 'dare', intensity: 3, modes: BOTH_MODES, text: '各自说一句“今天我可以接受____，但不想____”，不用解释理由。' },

  // L4 · adult, consent-first, non-explicit
  { id: 't4-01', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '只在你愿意的范围内，说一个你对成年人亲密关系的幻想主题，不需要描述具体过程。' },
  { id: 't4-02', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '哪一种被 {partner} 主动靠近的方式最容易让你心动？先说边界，再说偏好。' },
  { id: 't4-03', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '你最喜欢亲密时对方是温柔、直接、黏人还是带点坏心眼？为什么？' },
  { id: 't4-04', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '说一个你愿意和 {partner} 讨论、但不会默认同意的成人亲密尝试。' },
  { id: 't4-05', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '如果今晚的亲密氛围由你设计，你更在意灯光、距离、语言还是节奏？' },
  { id: 't4-06', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '什么样的确认方式会让你在更亲密的互动里最安心？' },
  { id: 't4-07', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '有没有一种只适合伴侣之间的称呼或语气，会让你明显脸红？' },
  { id: 't4-08', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '在成年人亲密互动里，你最看重的三件事是什么？' },
  { id: 't4-09', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '成年人之间更亲密地靠近前，你最希望对方先确认哪一件事？' },
  { id: 't4-10', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '你更喜欢把亲密偏好提前聊清楚，还是在当下边问边确认？为什么？' },
  { id: 't4-11', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '哪一种成人向暧昧表达会让你心动，但仍然觉得很被尊重？' },
  { id: 't4-12', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '在成年人亲密氛围里，什么情况会让你立刻想慢下来或暂停？' },
  { id: 't4-13', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '你更在意对方主动前先问、过程中确认，还是结束后照顾感受？可以多选。' },
  { id: 't4-14', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '如果给“今晚的亲密边界”分成绿灯、黄灯、红灯，你会怎么举一个非具体过程的例子？' },
  { id: 't4-15', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '哪种成人伴侣之间的语言会让你觉得有吸引力，哪种会让你不舒服？' },
  { id: 't4-16', type: 'truth', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '对你来说，成年人之间“更进一步”最重要的前提是什么？' },
  { id: 'd4-01', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '用一句只适合成年伴侣之间的暧昧话逗 {partner}；任何一方不舒服就立即换题。' },
  { id: 'd4-02', type: 'dare', intensity: 4, modes: ['reality'], adultOnly: true, text: '在双方明确同意的前提下，选择一个更久一点的拥抱或亲吻；任意一方都可以随时停。' },
  { id: 'd4-03', type: 'dare', intensity: 4, modes: ['chat'], adultOnly: true, text: '写一句成年人之间的私密邀请，但必须同时给对方一个很容易说“不”的出口。' },
  { id: 'd4-04', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '告诉 {partner}：“今晚我愿意更靠近的程度是……”，并让对方也说自己的范围。' },
  { id: 'd4-05', type: 'dare', intensity: 4, modes: ['reality'], adultOnly: true, text: '如果双方愿意，让 {partner} 选择一个舒服的亲密接触，并由你问一次“这样可以吗？”。' },
  { id: 'd4-06', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '说一句带明显心动感的成人情话，但不替对方假设任何同意。' },
  { id: 'd4-07', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '各自说一个“可以主动一点”的信号和一个“必须停下”的信号。' },
  { id: 'd4-08', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '让 {partner} 在“更温柔 / 更直接 / 更黏人”里选一个，你用一句话回应对应氛围。' },
  { id: 'd4-09', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '各自说一句“如果今晚更亲密，我希望你先问我____”，说完不代表已经同意。' },
  { id: 'd4-10', type: 'dare', intensity: 4, modes: ['chat'], adultOnly: true, text: '写一句成年伴侣间的暧昧邀请，并在结尾明确加上“你不想也完全可以”。' },
  { id: 'd4-11', type: 'dare', intensity: 4, modes: ['reality'], adultOnly: true, text: '如果双方愿意，选择“更久的拥抱 / 亲吻 / 靠近说悄悄话”之一；先问，再做。' },
  { id: 'd4-12', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '交换一个今晚的绿灯信号和一个黄灯信号；黄灯出现时必须放慢并再次确认。' },
  { id: 'd4-13', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '说一句你觉得很有吸引力的成人情话，再问 {partner} 这种风格是否舒服。' },
  { id: 'd4-14', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '各自用三个词描述“理想的成年人亲密氛围”，只聊氛围，不描述具体过程。' },
  { id: 'd4-15', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '练习一次明确确认：“这样可以吗？”——对方可以回答“可以 / 慢一点 / 停”。' },
  { id: 'd4-16', type: 'dare', intensity: 4, modes: BOTH_MODES, adultOnly: true, text: '各自说一句“我现在愿意靠近到____”，范围由本人决定，另一方只负责听。' }
]

export const COUPLE_BOARD_EVENT_CARDS: CoupleBoardEventCard[] = [
  { id: 'event-sync', source: 'builtin', title: '心跳同步', text: '这一刻你们刚好站在同一边。两个人都收下一点心动。', emoji: '💞', heartDeltaActor: 1, heartDeltaOther: 1 },
  { id: 'event-brave', source: 'builtin', title: '勇气加码', text: '刚才那一步比想象中更勇敢。当前玩家额外收下 2 点心动。', emoji: '✨', heartDeltaActor: 2, heartDeltaOther: 0 },
  { id: 'event-caught', source: 'builtin', title: '被接住了', text: '有些靠近不是往前走，而是有人稳稳接住你。对方 +2 心动。', emoji: '🫶', heartDeltaActor: 0, heartDeltaOther: 2 },
  { id: 'event-secret', source: 'builtin', title: '秘密花园', text: '这一回合不用证明什么，留一点只属于你们的安静。双方 +1 心动。', emoji: '🌷', heartDeltaActor: 1, heartDeltaOther: 1 },
  { id: 'event-moon', source: 'builtin', title: '月光偏心', text: '今晚的运气悄悄偏向了你。当前玩家 +1，对方也 +1。', emoji: '🌙', heartDeltaActor: 1, heartDeltaOther: 1 },
  { id: 'event-letter', source: 'builtin', title: '未寄出的信', text: '把一句想说却没急着说出口的话留在心里。当前玩家 +1 心动。', emoji: '💌', heartDeltaActor: 1, heartDeltaOther: 0 }
]

const promptSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.union([z.literal('truth'), z.literal('dare')]),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  modes: z.array(z.union([z.literal('chat'), z.literal('reality')])).min(1).max(2),
  text: z.string().min(1).max(240),
  adultOnly: z.boolean().optional(),
  source: z.union([z.literal('builtin'), z.literal('custom'), z.literal('memory-ai')]).optional(),
  memoryEvidenceIds: z.array(z.string().min(1)).max(12).optional(),
  evidenceIds: z.array(z.string().min(1)).max(16).optional()
})

const eventCardSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(48),
  text: z.string().min(1).max(220),
  emoji: z.string().min(1).max(8),
  heartDeltaActor: z.number().int().min(-5).max(5),
  heartDeltaOther: z.number().int().min(-5).max(5),
  source: z.union([z.literal('builtin'), z.literal('custom')]).optional(),
  swapPositions: z.boolean().optional(),
  extraTurn: z.boolean().optional()
})

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
    replacementCount: z.number().int().min(0).max(30)
  }).optional(),
  pendingEvent: z.object({
    actor: z.union([z.literal('user'), z.literal('partner')]),
    cellIndex: z.number().int().min(0).max(COUPLE_BOARD_CELLS.length - 1),
    eventCardId: z.string()
  }).optional(),
  sessionPrompts: z.array(promptSchema).max(120).optional(),
  sessionEventCards: z.array(eventCardSchema).max(80).optional(),
  disabledPromptIds: z.array(z.string().min(1).max(120)).max(160).optional(),
  history: z.array(z.object({
    id: z.string(),
    actor: z.union([z.literal('user'), z.literal('partner')]),
    dice: z.number().int().min(1).max(6),
    from: z.number().int().min(0).max(COUPLE_BOARD_CELLS.length - 1),
    to: z.number().int().min(0).max(COUPLE_BOARD_CELLS.length - 1),
    cellType: z.enum(['start', 'truth', 'dare', 'heart', 'surprise', 'boost', 'rewind', 'rest', 'finish']),
    promptId: z.string().optional(),
    eventCardId: z.string().optional(),
    resolution: z.union([z.literal('completed'), z.literal('skipped')]).optional(),
    createdAt: z.string()
  })).max(80),
  createdAt: z.string(),
  updatedAt: z.string()
})

const preferencesV1Schema = z.object({
  version: z.literal(1),
  customPrompts: z.array(promptSchema).max(120),
  updatedAt: z.string()
})

const preferencesV2Schema: z.ZodType<CoupleBoardPreferences> = z.object({
  version: z.literal(2),
  customPrompts: z.array(promptSchema).max(120),
  customEventCards: z.array(eventCardSchema).max(80),
  disabledBuiltinPromptIds: z.array(z.string().min(1).max(120)).max(160),
  disabledBuiltinEventCardIds: z.array(z.string().min(1).max(120)).max(80),
  updatedAt: z.string()
})

export interface CoupleBoardArchiveEntry {
  id: string
  gameId: string
  characterId: string
  characterName: string
  mode: CoupleBoardMode
  intensity: CoupleBoardIntensity
  winner?: CoupleBoardPlayerId
  totalHearts: number
  completed: number
  skipped: number
  eventCount: number
  evidencePromptCount: number
  turnCount: number
  createdAt: string
  finishedAt: string
  highlights: CoupleBoardHighlight[]
  game: CoupleBoardGame
}

export interface CoupleBoardArchive {
  version: 1
  entries: CoupleBoardArchiveEntry[]
  updatedAt: string
}

const archiveEntrySchema: z.ZodType<CoupleBoardArchiveEntry> = z.object({
  id: z.string(), gameId: z.string(), characterId: z.string(), characterName: z.string(),
  mode: z.union([z.literal('chat'), z.literal('reality')]),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  winner: z.union([z.literal('user'), z.literal('partner')]).optional(),
  totalHearts: z.number().int().min(0), completed: z.number().int().min(0), skipped: z.number().int().min(0),
  eventCount: z.number().int().min(0), evidencePromptCount: z.number().int().min(0), turnCount: z.number().int().min(0),
  createdAt: z.string(), finishedAt: z.string(), highlights: z.array(z.object({
    id: z.string(), emoji: z.string(), eyebrow: z.string(), title: z.string(), detail: z.string()
  })).max(6), game: gameSchema
})

const archiveSchema: z.ZodType<CoupleBoardArchive> = z.object({
  version: z.literal(1),
  entries: z.array(archiveEntrySchema).max(24),
  updatedAt: z.string()
})

const STATE_APP_KEY = '__couple-board-state__'
const PREFERENCES_APP_KEY = '__couple-board-preferences__'
const ARCHIVE_APP_KEY = '__couple-board-archive__'

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

function clampHeartDelta(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(-5, Math.min(5, Math.trunc(value)))
}

function otherPlayer(player: CoupleBoardPlayerId): CoupleBoardPlayerId {
  return player === 'user' ? 'partner' : 'user'
}

export function cloneCoupleBoardGame(game: CoupleBoardGame): CoupleBoardGame {
  // Vue refs expose object values as reactive proxies. native structured cloning of a Proxy throws
  // DataCloneError in browsers, so normalize through the existing Zod schema instead.
  // Zod returns a plain deep-cloned snapshot and also keeps the persisted shape honest.
  return gameSchema.parse(game)
}

function cloneGame(game: CoupleBoardGame): CoupleBoardGame {
  return cloneCoupleBoardGame(game)
}

function uniqueModes(modes: readonly CoupleBoardMode[]) {
  const next: CoupleBoardMode[] = []
  if (modes.includes('chat')) next.push('chat')
  if (modes.includes('reality')) next.push('reality')
  return next.length ? next : [...BOTH_MODES]
}

function normalizeSessionPrompt(prompt: CoupleBoardPrompt): CoupleBoardPrompt | undefined {
  const parsed = promptSchema.safeParse(prompt)
  if (!parsed.success) return undefined
  const text = sanitizeNativeAppText(parsed.data.text, { singleLine: true }).slice(0, 160).trim()
  if (!text) return undefined
  return {
    ...parsed.data,
    modes: uniqueModes(parsed.data.modes),
    text,
    adultOnly: parsed.data.adultOnly || parsed.data.intensity === 4,
    ...(parsed.data.evidenceIds?.length ? { evidenceIds: [...new Set(parsed.data.evidenceIds)].slice(0, 16) } : {}),
    ...(parsed.data.memoryEvidenceIds?.length ? { memoryEvidenceIds: [...new Set(parsed.data.memoryEvidenceIds)].slice(0, 12) } : {})
  }
}

function normalizeEventCard(card: CoupleBoardEventCard): CoupleBoardEventCard | undefined {
  const parsed = eventCardSchema.safeParse(card)
  if (!parsed.success) return undefined
  const title = sanitizeNativeAppText(parsed.data.title, { singleLine: true }).slice(0, 48).trim()
  const text = sanitizeNativeAppText(parsed.data.text, { singleLine: true }).slice(0, 180).trim()
  const emoji = sanitizeNativeAppText(parsed.data.emoji, { singleLine: true }).slice(0, 4).trim() || '💌'
  if (!title || !text) return undefined
  return { ...parsed.data, title, text, emoji }
}

function uniqueKnownIds(value: readonly string[], known: ReadonlySet<string>, max: number) {
  const result: string[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    const id = String(raw || '').trim()
    if (!id || !known.has(id) || seen.has(id)) continue
    seen.add(id)
    result.push(id)
    if (result.length >= max) break
  }
  return result
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

export function createCoupleBoardCustomPrompt(
  draft: CoupleBoardCustomPromptDraft,
  now = new Date()
): CoupleBoardPrompt {
  const text = sanitizeNativeAppText(draft.text, { singleLine: true }).slice(0, 160).trim()
  if (!text) throw new Error('自定义题目不能为空。')
  return {
    id: `custom-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: draft.type,
    intensity: draft.intensity,
    modes: uniqueModes(draft.modes),
    text,
    adultOnly: draft.intensity === 4,
    source: 'custom'
  }
}

export function updateCoupleBoardCustomPrompt(
  existing: CoupleBoardPrompt,
  draft: CoupleBoardCustomPromptDraft
): CoupleBoardPrompt {
  if (existing.source !== 'custom') throw new Error('只能编辑自定义题目。')
  const text = sanitizeNativeAppText(draft.text, { singleLine: true }).slice(0, 160).trim()
  if (!text) throw new Error('自定义题目不能为空。')
  return {
    ...existing,
    type: draft.type,
    intensity: draft.intensity,
    modes: uniqueModes(draft.modes),
    text,
    adultOnly: draft.intensity === 4,
    source: 'custom'
  }
}

export function createCoupleBoardCustomEventCard(
  draft: CoupleBoardCustomEventCardDraft,
  now = new Date()
): CoupleBoardEventCard {
  const title = sanitizeNativeAppText(draft.title, { singleLine: true }).slice(0, 48).trim()
  const text = sanitizeNativeAppText(draft.text, { singleLine: true }).slice(0, 180).trim()
  const emoji = sanitizeNativeAppText(draft.emoji, { singleLine: true }).slice(0, 4).trim() || '💌'
  if (!title || !text) throw new Error('事件卡标题和内容不能为空。')
  const card: CoupleBoardEventCard = {
    id: `custom-event-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    text,
    emoji,
    heartDeltaActor: clampHeartDelta(draft.heartDeltaActor),
    heartDeltaOther: clampHeartDelta(draft.heartDeltaOther),
    source: 'custom',
    ...(draft.swapPositions ? { swapPositions: true } : {}),
    ...(draft.extraTurn ? { extraTurn: true } : {})
  }
  if (!card.heartDeltaActor && !card.heartDeltaOther && !card.swapPositions && !card.extraTurn) {
    throw new Error('事件卡至少要有一个效果。')
  }
  return card
}

export function updateCoupleBoardCustomEventCard(
  existing: CoupleBoardEventCard,
  draft: CoupleBoardCustomEventCardDraft
): CoupleBoardEventCard {
  if (existing.source !== 'custom') throw new Error('只能编辑自定义事件卡。')
  return { ...createCoupleBoardCustomEventCard(draft), id: existing.id }
}

export function parseCoupleBoardPreferences(value: unknown): CoupleBoardPreferences | undefined {
  const parsedV2 = preferencesV2Schema.safeParse(value)
  const promptIds = new Set(COUPLE_BOARD_PROMPTS.map(row => row.id))
  const eventIds = new Set(COUPLE_BOARD_EVENT_CARDS.map(row => row.id))
  if (parsedV2.success) {
    const customPrompts = parsedV2.data.customPrompts
      .map(normalizeSessionPrompt)
      .filter((row): row is CoupleBoardPrompt => Boolean(row))
      .filter(row => row.source === 'custom')
    const customEventCards = parsedV2.data.customEventCards
      .map(normalizeEventCard)
      .filter((row): row is CoupleBoardEventCard => Boolean(row))
      .filter(row => row.source === 'custom')
    return {
      ...parsedV2.data,
      customPrompts,
      customEventCards,
      disabledBuiltinPromptIds: uniqueKnownIds(parsedV2.data.disabledBuiltinPromptIds, promptIds, 160),
      disabledBuiltinEventCardIds: uniqueKnownIds(parsedV2.data.disabledBuiltinEventCardIds, eventIds, 80)
    }
  }
  const parsedV1 = preferencesV1Schema.safeParse(value)
  if (!parsedV1.success) return undefined
  const customPrompts = parsedV1.data.customPrompts
    .map(normalizeSessionPrompt)
    .filter((row): row is CoupleBoardPrompt => Boolean(row))
    .filter(row => row.source === 'custom')
  return {
    version: 2,
    customPrompts,
    customEventCards: [],
    disabledBuiltinPromptIds: [],
    disabledBuiltinEventCardIds: [],
    updatedAt: parsedV1.data.updatedAt
  }
}

export async function loadCoupleBoardPreferences(worldId: string): Promise<CoupleBoardPreferences> {
  const row = await db.appCustomizations.get(`${worldId}:${PREFERENCES_APP_KEY}`)
  const parsed = parseCoupleBoardPreferences(
    (row as AppCustomization & { coupleBoardPreferences?: unknown } | undefined)?.coupleBoardPreferences
  )
  return parsed || {
    version: 2,
    customPrompts: [],
    customEventCards: [],
    disabledBuiltinPromptIds: [],
    disabledBuiltinEventCardIds: [],
    updatedAt: new Date(0).toISOString()
  }
}

export async function saveCoupleBoardPreferences(
  worldId: string,
  input: Pick<CoupleBoardPreferences, 'customPrompts' | 'customEventCards' | 'disabledBuiltinPromptIds' | 'disabledBuiltinEventCardIds'> | CoupleBoardPrompt[]
) {
  const previous = await loadCoupleBoardPreferences(worldId)
  const source = Array.isArray(input)
    ? { ...previous, customPrompts: input }
    : { ...previous, ...input }
  const now = new Date().toISOString()
  const promptIds = new Set(COUPLE_BOARD_PROMPTS.map(row => row.id))
  const eventIds = new Set(COUPLE_BOARD_EVENT_CARDS.map(row => row.id))
  const preferences: CoupleBoardPreferences = {
    version: 2,
    customPrompts: source.customPrompts
      .map(normalizeSessionPrompt)
      .filter((row): row is CoupleBoardPrompt => Boolean(row))
      .filter(row => row.source === 'custom')
      .slice(0, 120),
    customEventCards: source.customEventCards
      .map(normalizeEventCard)
      .filter((row): row is CoupleBoardEventCard => Boolean(row))
      .filter(row => row.source === 'custom')
      .slice(0, 80),
    disabledBuiltinPromptIds: uniqueKnownIds(source.disabledBuiltinPromptIds, promptIds, 160),
    disabledBuiltinEventCardIds: uniqueKnownIds(source.disabledBuiltinEventCardIds, eventIds, 80),
    updatedAt: now
  }
  const existing = await db.appCustomizations.get(`${worldId}:${PREFERENCES_APP_KEY}`)
  const row: AppCustomization & { coupleBoardPreferences: CoupleBoardPreferences } = {
    ...(existing ?? {}),
    id: `${worldId}:${PREFERENCES_APP_KEY}`,
    worldId,
    appKey: PREFERENCES_APP_KEY,
    coupleBoardPreferences: preferences,
    updatedAt: now
  }
  await db.appCustomizations.put(row)
  return preferences
}

export function exportCoupleBoardLibrary(preferences: CoupleBoardPreferences) {
  return JSON.stringify({
    format: 'ai-companion-phone-couple-board-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      customPrompts: preferences.customPrompts,
      customEventCards: preferences.customEventCards,
      disabledBuiltinPromptIds: preferences.disabledBuiltinPromptIds,
      disabledBuiltinEventCardIds: preferences.disabledBuiltinEventCardIds
    }
  }, null, 2)
}

export function importCoupleBoardLibrary(raw: string): Pick<CoupleBoardPreferences, 'customPrompts' | 'customEventCards' | 'disabledBuiltinPromptIds' | 'disabledBuiltinEventCardIds'> {
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('题库文件不是有效 JSON。') }
  if (!value || typeof value !== 'object') throw new Error('题库文件结构无效。')
  const root = value as Record<string, unknown>
  if (root.format !== 'ai-companion-phone-couple-board-library' || root.version !== 1 || !root.data || typeof root.data !== 'object') {
    throw new Error('这不是心跳飞行棋 V1.2 题库文件。')
  }
  const data = root.data as Record<string, unknown>
  const candidate = parseCoupleBoardPreferences({
    version: 2,
    customPrompts: Array.isArray(data.customPrompts) ? data.customPrompts : [],
    customEventCards: Array.isArray(data.customEventCards) ? data.customEventCards : [],
    disabledBuiltinPromptIds: Array.isArray(data.disabledBuiltinPromptIds) ? data.disabledBuiltinPromptIds : [],
    disabledBuiltinEventCardIds: Array.isArray(data.disabledBuiltinEventCardIds) ? data.disabledBuiltinEventCardIds : [],
    updatedAt: new Date().toISOString()
  })
  if (!candidate) throw new Error('题库文件内容无法通过校验。')
  return {
    customPrompts: candidate.customPrompts,
    customEventCards: candidate.customEventCards,
    disabledBuiltinPromptIds: candidate.disabledBuiltinPromptIds,
    disabledBuiltinEventCardIds: candidate.disabledBuiltinEventCardIds
  }
}

export function createCoupleBoardGame(
  settings: CoupleBoardSettings,
  now = new Date(),
  sessionPrompts: CoupleBoardPrompt[] = [],
  options: {
    customEventCards?: CoupleBoardEventCard[]
    disabledBuiltinPromptIds?: string[]
    disabledBuiltinEventCardIds?: string[]
  } = {}
): CoupleBoardGame {
  const adultError = validateCoupleBoardAdultMode(settings)
  if (adultError) throw new Error(adultError)
  const timestamp = nowIso(now)
  const frozenPrompts = sessionPrompts
    .map(normalizeSessionPrompt)
    .filter((row): row is CoupleBoardPrompt => Boolean(row))
    .filter(row => row.source === 'custom')
    .slice(0, 120)
  const disabledEventIds = new Set(options.disabledBuiltinEventCardIds || [])
  const frozenEvents = [
    ...COUPLE_BOARD_EVENT_CARDS.filter(card => !disabledEventIds.has(card.id)),
    ...(options.customEventCards || [])
      .map(normalizeEventCard)
      .filter((row): row is CoupleBoardEventCard => Boolean(row))
      .filter(row => row.source === 'custom')
  ].slice(0, 80)
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
    sessionPrompts: frozenPrompts,
    sessionEventCards: frozenEvents,
    disabledPromptIds: [...new Set(options.disabledBuiltinPromptIds || [])].slice(0, 160),
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

function sessionPromptPool(game: CoupleBoardGame, type: CoupleBoardPromptType) {
  return (game.sessionPrompts || []).filter(prompt =>
    prompt.source === 'custom' &&
    prompt.type === type &&
    prompt.intensity <= game.settings.intensity &&
    prompt.modes.includes(game.settings.mode) &&
    (!prompt.adultOnly || game.settings.intensity === 4)
  )
}

export function promptsForGame(game: CoupleBoardGame, type: CoupleBoardPromptType) {
  const disabled = new Set(game.disabledPromptIds || [])
  return [
    ...promptsFor(type, game.settings.intensity, game.settings.mode).filter(prompt => !disabled.has(prompt.id)),
    ...sessionPromptPool(game, type)
  ]
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

export function drawCoupleBoardGamePrompt(
  game: CoupleBoardGame,
  type: CoupleBoardPromptType,
  random = Math.random(),
  excludeId?: string
): CoupleBoardPrompt {
  const candidates = promptsForGame(game, type)
  const withoutExcluded = excludeId ? candidates.filter(prompt => prompt.id !== excludeId) : candidates
  const pool = withoutExcluded.length ? withoutExcluded : candidates
  if (!pool.length) throw new Error('当前模式没有可用题目。')
  return pool[Math.floor(clampRandom(random) * pool.length)]
}

export function getCoupleBoardPrompt(promptId: string) {
  return COUPLE_BOARD_PROMPTS.find(prompt => prompt.id === promptId)
}

export function getCoupleBoardGamePrompt(game: CoupleBoardGame, promptId: string) {
  return (game.sessionPrompts || []).find(prompt => prompt.id === promptId) || getCoupleBoardPrompt(promptId)
}

/** Stable guard for async challenge work. Any replace/resolve/new turn changes this value. */
export function coupleBoardChallengeFingerprint(game: CoupleBoardGame) {
  const pending = game.pending
  if (!pending) return ''
  return [
    game.id,
    game.turn,
    pending.actor,
    pending.cellIndex,
    pending.promptType,
    pending.promptId,
    pending.replacementCount
  ].join(':')
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

export function drawCoupleBoardEventCard(random = Math.random(), excludeId?: string) {
  const withoutExcluded = excludeId
    ? COUPLE_BOARD_EVENT_CARDS.filter(card => card.id !== excludeId)
    : COUPLE_BOARD_EVENT_CARDS
  const pool = withoutExcluded.length ? withoutExcluded : COUPLE_BOARD_EVENT_CARDS
  return pool[Math.floor(clampRandom(random) * pool.length)]
}

export function getCoupleBoardEventCard(eventCardId: string) {
  return COUPLE_BOARD_EVENT_CARDS.find(card => card.id === eventCardId)
}

function eventDeckForGame(game: CoupleBoardGame) {
  // Old V1 snapshots have no sessionEventCards and keep the original built-in deck.
  // V1.2 snapshots may intentionally freeze an empty deck when every event is disabled.
  return game.sessionEventCards === undefined ? COUPLE_BOARD_EVENT_CARDS : game.sessionEventCards
}

export function drawCoupleBoardGameEventCard(game: CoupleBoardGame, random = Math.random(), excludeId?: string) {
  const candidates = eventDeckForGame(game)
  const withoutExcluded = excludeId ? candidates.filter(card => card.id !== excludeId) : candidates
  const pool = withoutExcluded.length ? withoutExcluded : candidates
  if (!pool.length) throw new Error('当前事件卡牌组为空。')
  return pool[Math.floor(clampRandom(random) * pool.length)]
}

export function getCoupleBoardGameEventCard(game: CoupleBoardGame, eventCardId: string) {
  return (game.sessionEventCards || []).find(card => card.id === eventCardId) || getCoupleBoardEventCard(eventCardId)
}

function challengeTypeForCell(type: CoupleBoardCellType): CoupleBoardPromptType | undefined {
  if (type === 'truth') return 'truth'
  if (type === 'dare') return 'dare'
  return undefined
}

export function rollCoupleBoard(
  game: CoupleBoardGame,
  dice: number,
  random = Math.random(),
  now = new Date()
): CoupleBoardGame {
  if (game.status !== 'playing') throw new Error('这一局已经结束。')
  if (game.pending || game.pendingEvent) throw new Error('先处理当前题目或事件卡。')
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

  if (cell.type === 'surprise') {
    const eventDeck = eventDeckForGame(next)
    if (eventDeck.length) {
      const eventCard = drawCoupleBoardGameEventCard(next, random)
      entry.eventCardId = eventCard.id
      next.pendingEvent = { actor, cellIndex: to, eventCardId: eventCard.id }
    } else {
      next.currentPlayer = otherPlayer(actor)
      next.turn += 1
    }
  } else {
    const promptType = challengeTypeForCell(cell.type)
    if (promptType) {
      const pool = promptsForGame(next, promptType)
      if (pool.length) {
        const prompt = pool[Math.floor(clampRandom(random) * pool.length)]
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
    } else {
      next.currentPlayer = otherPlayer(actor)
      next.turn += 1
    }
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
  const prompt = drawCoupleBoardGamePrompt(next, current.promptType, random, current.promptId)
  current.promptId = prompt.id
  current.replacementCount += 1
  const log = [...next.history].reverse().find(entry => entry.actor === current.actor && !entry.resolution)
  if (log) log.promptId = prompt.id
  next.updatedAt = nowIso(now)
  return next
}

export function attachCoupleBoardGeneratedPrompt(
  game: CoupleBoardGame,
  prompt: CoupleBoardPrompt,
  now = new Date()
): CoupleBoardGame {
  if (!game.pending) throw new Error('当前没有可以替换的题目。')
  const normalized = normalizeSessionPrompt({ ...prompt, source: 'memory-ai' })
  if (!normalized || normalized.source !== 'memory-ai') throw new Error('AI 回忆题格式无效。')
  if (normalized.type !== game.pending.promptType) throw new Error('AI 回忆题类型与当前格子不一致。')
  const evidenceIds = normalized.evidenceIds?.length ? normalized.evidenceIds : normalized.memoryEvidenceIds
  if (!evidenceIds?.length) throw new Error('AI 回忆题缺少真实证据。')
  if (normalized.intensity > game.settings.intensity || !normalized.modes.includes(game.settings.mode)) {
    throw new Error('AI 回忆题与当前游戏模式不一致。')
  }
  const next = cloneGame(game)
  const others = (next.sessionPrompts || []).filter(row => row.id !== normalized.id)
  next.sessionPrompts = [...others, normalized].slice(-120)
  next.pending!.promptId = normalized.id
  next.pending!.replacementCount += 1
  const log = [...next.history].reverse().find(entry => entry.actor === next.pending!.actor && !entry.resolution)
  if (log) log.promptId = normalized.id
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
  if (log) log.resolution = resolution
  next.pending = undefined
  next.currentPlayer = otherPlayer(pending.actor)
  next.turn += 1
  next.updatedAt = nowIso(now)
  return next
}

export function resolveCoupleBoardEvent(game: CoupleBoardGame, now = new Date()): CoupleBoardGame {
  if (!game.pendingEvent) throw new Error('当前没有待处理事件卡。')
  const next = cloneGame(game)
  const pending = next.pendingEvent!
  const card = getCoupleBoardGameEventCard(next, pending.eventCardId)
  if (!card) throw new Error('事件卡不存在。')
  const actor = next.players[pending.actor]
  const other = next.players[otherPlayer(pending.actor)]
  actor.hearts = Math.max(0, actor.hearts + card.heartDeltaActor)
  other.hearts = Math.max(0, other.hearts + card.heartDeltaOther)
  if (card.swapPositions) {
    const actorPosition = actor.position
    actor.position = other.position
    other.position = actorPosition
  }
  next.pendingEvent = undefined
  next.currentPlayer = card.extraTurn ? pending.actor : otherPlayer(pending.actor)
  next.turn += 1
  next.updatedAt = nowIso(now)
  return next
}

export function buildCoupleBoardHighlights(game: CoupleBoardGame): CoupleBoardHighlight[] {
  const highlights: CoupleBoardHighlight[] = []
  const totalHearts = game.players.user.hearts + game.players.partner.hearts
  const totalCompleted = game.players.user.completed + game.players.partner.completed
  const totalSkipped = game.players.user.skipped + game.players.partner.skipped
  highlights.push({
    id: 'heartbeat-total',
    emoji: '💗',
    eyebrow: 'HEARTBEAT',
    title: `${totalHearts} 点心动被留下`,
    detail: `你们完成了 ${totalCompleted} 个挑战，一共走过 ${game.history.length} 个回合节点。`
  })

  const completedLogs = game.history.filter(row => row.resolution === 'completed' && row.promptId)
  const promptRows = completedLogs
    .map(row => ({ row, prompt: getCoupleBoardGamePrompt(game, row.promptId || '') }))
    .filter((entry): entry is { row: CoupleBoardTurnLog; prompt: CoupleBoardPrompt } => Boolean(entry.prompt))
    .sort((a, b) => b.prompt.intensity - a.prompt.intensity)
  const brave = promptRows[0]
  if (brave) {
    const actor = game.players[brave.row.actor]
    const counterpart = brave.row.actor === 'partner' ? '我' : game.settings.characterName
    highlights.push({
      id: 'brave-challenge',
      emoji: brave.prompt.type === 'truth' ? '💬' : '🎀',
      eyebrow: 'BRAVEST MOMENT',
      title: `${actor.name} 接住了这道${brave.prompt.type === 'truth' ? '真心话' : '大冒险'}`,
      detail: renderCoupleBoardPrompt(brave.prompt, actor.name, counterpart).slice(0, 90)
    })
  }

  const memoryLog = [...completedLogs].reverse().find(row => {
    const prompt = getCoupleBoardGamePrompt(game, row.promptId || '')
    return prompt?.source === 'memory-ai' && Boolean(prompt.evidenceIds?.length || prompt.memoryEvidenceIds?.length)
  })
  if (memoryLog) {
    const prompt = getCoupleBoardGamePrompt(game, memoryLog.promptId || '')!
    highlights.push({
      id: 'memory-challenge',
      emoji: '🕰️',
      eyebrow: 'OUR MEMORY',
      title: '真实回忆变成了一道题',
      detail: `这道高光由 ${prompt.evidenceIds?.length || prompt.memoryEvidenceIds?.length || 0} 条已存证据生成，没有写回或改动原记录。`
    })
  }

  const eventCount = game.history.filter(row => row.eventCardId).length
  if (eventCount) {
    highlights.push({
      id: 'event-cards',
      emoji: '💌',
      eyebrow: 'EVENT CARDS',
      title: `抽到 ${eventCount} 张情侣事件卡`,
      detail: '那些不需要回答的问题，也成了这一局的小小转折。'
    })
  } else if (totalSkipped) {
    highlights.push({
      id: 'safe-boundary',
      emoji: '🫶',
      eyebrow: 'BOUNDARY',
      title: `${totalSkipped} 次舒服地说“跳过”`,
      detail: '跳过不会被当成失败；边界被尊重，本身就是这局的一部分。'
    })
  }

  return highlights.slice(0, 4)
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
    coupleBoardState: cloneCoupleBoardGame(game),
    updatedAt: now
  }
  await db.appCustomizations.put(row)
  return game
}

export async function clearCoupleBoardGame(worldId: string) {
  await db.appCustomizations.delete(`${worldId}:${STATE_APP_KEY}`)
}

export function buildCoupleBoardArchiveEntry(game: CoupleBoardGame): CoupleBoardArchiveEntry {
  if (game.status !== 'finished') throw new Error('只有已经结束的棋局才能进入回忆册。')
  const evidencePromptCount = game.history.filter(row => {
    if (!row.promptId) return false
    const prompt = getCoupleBoardGamePrompt(game, row.promptId)
    return prompt?.source === 'memory-ai' && Boolean(prompt.evidenceIds?.length || prompt.memoryEvidenceIds?.length)
  }).length
  return {
    id: `archive:${game.id}`,
    gameId: game.id,
    characterId: game.settings.characterId,
    characterName: game.settings.characterName,
    mode: game.settings.mode,
    intensity: game.settings.intensity,
    winner: game.winner,
    totalHearts: game.players.user.hearts + game.players.partner.hearts,
    completed: game.players.user.completed + game.players.partner.completed,
    skipped: game.players.user.skipped + game.players.partner.skipped,
    eventCount: game.history.filter(row => row.eventCardId).length,
    evidencePromptCount,
    turnCount: game.history.length,
    createdAt: game.createdAt,
    finishedAt: game.updatedAt,
    highlights: buildCoupleBoardHighlights(game),
    game: cloneCoupleBoardGame(game)
  }
}

export function parseCoupleBoardArchive(value: unknown): CoupleBoardArchive | undefined {
  const parsed = archiveSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export async function loadCoupleBoardArchive(worldId: string): Promise<CoupleBoardArchive> {
  const row = await db.appCustomizations.get(`${worldId}:${ARCHIVE_APP_KEY}`)
  const parsed = parseCoupleBoardArchive(
    (row as AppCustomization & { coupleBoardArchive?: unknown } | undefined)?.coupleBoardArchive
  )
  return parsed || { version: 1, entries: [], updatedAt: new Date(0).toISOString() }
}

export async function archiveCoupleBoardGame(worldId: string, game: CoupleBoardGame) {
  const entry = buildCoupleBoardArchiveEntry(game)
  const previous = await loadCoupleBoardArchive(worldId)
  const now = new Date().toISOString()
  const entries = [entry, ...previous.entries.filter(row => row.gameId !== game.id)]
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
    .slice(0, 24)
  const archive: CoupleBoardArchive = { version: 1, entries, updatedAt: now }
  const existing = await db.appCustomizations.get(`${worldId}:${ARCHIVE_APP_KEY}`)
  const row: AppCustomization & { coupleBoardArchive: CoupleBoardArchive } = {
    ...(existing ?? {}),
    id: `${worldId}:${ARCHIVE_APP_KEY}`,
    worldId,
    appKey: ARCHIVE_APP_KEY,
    coupleBoardArchive: archive,
    updatedAt: now
  }
  await db.appCustomizations.put(row)
  return archive
}

export async function removeCoupleBoardArchiveEntry(worldId: string, gameId: string) {
  const previous = await loadCoupleBoardArchive(worldId)
  const now = new Date().toISOString()
  const archive: CoupleBoardArchive = {
    version: 1,
    entries: previous.entries.filter(row => row.gameId !== gameId),
    updatedAt: now
  }
  const existing = await db.appCustomizations.get(`${worldId}:${ARCHIVE_APP_KEY}`)
  const row: AppCustomization & { coupleBoardArchive: CoupleBoardArchive } = {
    ...(existing ?? {}),
    id: `${worldId}:${ARCHIVE_APP_KEY}`,
    worldId,
    appKey: ARCHIVE_APP_KEY,
    coupleBoardArchive: archive,
    updatedAt: now
  }
  await db.appCustomizations.put(row)
  return archive
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
  const prompt = getCoupleBoardGamePrompt(game, game.pending.promptId)
  if (!prompt) return undefined
  const actorName = game.players[game.pending.actor].name
  const counterpartName = game.pending.actor === 'partner' ? '我' : game.settings.characterName
  const text = renderCoupleBoardPrompt(prompt, actorName, counterpartName)
  const intro = game.pending.actor === 'partner'
    ? `我们正在玩「心跳飞行棋」。轮到你了，落在${prompt.type === 'truth' ? '真心话' : '大冒险'}格：`
    : `我们正在玩「心跳飞行棋」。轮到我了，落在${prompt.type === 'truth' ? '真心话' : '大冒险'}格：`
  const memoryNote = prompt.source === 'memory-ai'
    ? `\n这道题只根据已经存下的真实证据生成，证据数：${prompt.evidenceIds?.length || prompt.memoryEvidenceIds?.length || 0}。`
    : ''
  const instruction = game.pending.actor === 'partner'
    ? '请按你的角色设定回应，但不要替我决定任何现实动作；任何不舒服的内容都可以直接跳过。'
    : '你可以作为伴侣回应我，但不要替我回答，也不要替我决定是否接受现实动作。'
  return {
    conversationId,
    draft: `${intro}\n${text}${memoryNote}\n\n${instruction}\n[心跳飞行棋 game:${game.id}; challenge:${prompt.id}]`
  }
}

export function mergeCoupleBoardShareIntoDraft(existing: string, share: CoupleBoardChatShare) {
  const current = existing.trim()
  if (!current) return share.draft
  if (current.includes(`[心跳飞行棋 game:`)) return current
  return `${current}\n\n${share.draft}`
}


export function buildCoupleBoardResultChatShare(
  game: CoupleBoardGame,
  conversationId: string
): CoupleBoardChatShare | undefined {
  if (game.status !== 'finished' || !conversationId) return undefined
  const totalHearts = game.players.user.hearts + game.players.partner.hearts
  const completed = game.players.user.completed + game.players.partner.completed
  const eventCount = game.history.filter(row => row.eventCardId).length
  const highlights = buildCoupleBoardHighlights(game).slice(0, 3)
  const lines = highlights.map(item => `- ${item.title}：${item.detail}`)
  return {
    conversationId,
    draft: [
      `我们刚玩完一局「心跳飞行棋」。这一局一共留下 ${totalHearts} 点心动，完成 ${completed} 个挑战，抽到 ${eventCount} 张事件卡。`,
      lines.length ? `本局高光：\n${lines.join('\n')}` : '',
      '这是我主动带到聊天里的游戏结算；请把它当作共同聊天素材，不要替我补写没有发生过的经历。',
      `[心跳飞行棋结算 game:${game.id}]`
    ].filter(Boolean).join('\n\n')
  }
}

export function mergeCoupleBoardResultShareIntoDraft(existing: string, share: CoupleBoardChatShare) {
  const current = existing.trim()
  if (!current) return share.draft
  if (current.includes(`[心跳飞行棋结算 game:`)) return current
  return `${current}\n\n${share.draft}`
}
