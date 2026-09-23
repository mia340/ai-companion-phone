import { z } from 'zod'
import { db } from '../db/database'
import { sanitizeNativeAppText } from './appPresentationPolicy'
import type { AppCustomization } from '../types/domain'

export type CoupleBoardIntensity = 1 | 2 | 3 | 4 | 5
export type CoupleBoardMode = 'chat' | 'reality'
export type CoupleBoardVisualMode = 'romantic' | 'pixel'
export type CoupleBoardPlayerId = 'user' | 'partner'
export type CoupleBoardPromptType = 'truth' | 'dare'
export type CoupleBoardPromptSource = 'builtin' | 'custom' | 'memory-ai'
export type CoupleBoardPromptTheme = 'daily' | 'memory' | 'playful' | 'flirt' | 'jealousy' | 'chemistry' | 'intimacy' | 'adult' | 'private'
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
  theme?: CoupleBoardPromptTheme
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
  /** V2 presentation only; old saves default to romantic in the view. */
  visualMode?: CoupleBoardVisualMode
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

export const COUPLE_BOARD_PROMPT_THEME_LABELS: Record<CoupleBoardPromptTheme, string> = {
  daily: '日常',
  memory: '回忆',
  playful: '小闹',
  flirt: '暧昧',
  jealousy: '吃醋',
  chemistry: '心动',
  intimacy: '亲密',
  adult: '成人',
  private: '私房'
}

export function coupleBoardPromptThemeLabel(prompt: CoupleBoardPrompt) {
  return prompt.theme ? COUPLE_BOARD_PROMPT_THEME_LABELS[prompt.theme] : '自定义'
}

export const COUPLE_BOARD_PROMPTS: CoupleBoardPrompt[] = [
  { id: 't1-01', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'daily', text: '最近最想和 {partner} 一起吃什么？别想高级餐厅，就说现在真想吃的。' },
  { id: 't1-02', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'memory', text: '你们最近哪一个很普通的小瞬间，回想起来还会觉得挺甜？' },
  { id: 't1-03', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'playful', text: '{partner} 哪个小习惯最容易让你想笑，又舍不得吐槽？' },
  { id: 't1-04', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'memory', text: '如果把你们一次散步、吃饭或闲聊重来一遍，你会选哪次？' },
  { id: 't1-05', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'flirt', text: '你最喜欢 {partner} 怎么叫你？本名、昵称，还是某个只有你们懂的称呼？' },
  { id: 't1-06', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'daily', text: '如果明天完全没安排，你最想和 {partner} 怎么懒一天？' },
  { id: 't1-07', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'playful', text: '你觉得 {partner} 什么时候最像小朋友？' },
  { id: 't1-08', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'daily', text: '最近有没有什么没什么用、但很想和 {partner} 一起买的小东西？' },
  { id: 't1-09', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'memory', text: '最近一次发生什么事时，你第一反应是“这个得跟 {partner} 说”？' },
  { id: 't1-10', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'playful', text: '你们两个谁更会撒娇？举个最近的例子。' },
  { id: 't1-11', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'daily', text: '{partner} 哪个表情、语气词或表情包，你一看就知道 TA 在想什么？' },
  { id: 't1-12', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'daily', text: '你最想和 {partner} 固定下来一个什么睡前小习惯？' },
  { id: 't1-13', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'playful', text: '如果现在只能点一份外卖一起吃，你会点什么？' },
  { id: 't1-14', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'flirt', text: '如果现在马上见到 {partner}，你第一件想做的事是什么？' },
  { id: 't1-15', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'daily', text: '你最吃 {partner} 哪一种哄人方式？' },
  { id: 't1-16', type: 'truth', intensity: 1, modes: BOTH_MODES, theme: 'memory', text: '有哪件小事你希望 {partner} 一直记得，因为你会觉得很甜？' },
  { id: 'd1-01', type: 'dare', intensity: 1, modes: BOTH_MODES, theme: 'playful', text: "用三个词形容 {partner}，不许想超过五秒。" },
  { id: 'd1-02', type: 'dare', intensity: 1, modes: BOTH_MODES, theme: 'flirt', text: "给 {partner} 起一个今晚限定的昵称，接下来一回合都这么叫。" },
  { id: 'd1-03', type: 'dare', intensity: 1, modes: ['reality'], theme: 'intimacy', text: "牵住 {partner} 的手十秒，谁都别先松。" },
  { id: 'd1-04', type: 'dare', intensity: 1, modes: ['reality'], theme: 'playful', text: "和 {partner} 击个掌，然后顺势把手留在一起五秒。" },
  { id: 'd1-05', type: 'dare', intensity: 1, modes: BOTH_MODES, theme: 'memory', text: "说一个只有你们俩听得懂的小梗。" },
  { id: 'd1-06', type: 'dare', intensity: 1, modes: ['reality'], theme: 'daily', text: "靠一下 {partner} 的肩，安静待十秒。" },
  { id: 'd1-07', type: 'dare', intensity: 1, modes: ['chat'], theme: 'flirt', text: "发一条十个字以内、明显是在想对方的消息。" },
  { id: 'd1-08', type: 'dare', intensity: 1, modes: ['reality'], theme: 'playful', text: "轻轻摸一下 {partner} 的头或头发，然后说一句“今天挺可爱的”。" },
  { id: 'd1-09', type: 'dare', intensity: 1, modes: BOTH_MODES, theme: 'daily', text: "给 {partner} 安排一个“今天不用动脑”的小福利。" },
  { id: 'd1-10', type: 'dare', intensity: 1, modes: ['reality'], theme: 'flirt', text: "抱 {partner} 八秒，松开前再抱紧一下。" },
  { id: 'd1-11', type: 'dare', intensity: 1, modes: BOTH_MODES, theme: 'memory', text: "各说一件最近让你觉得“还好有你”的小事。" },
  { id: 'd1-12', type: 'dare', intensity: 1, modes: ['reality'], theme: 'playful', text: "和 {partner} 勾小拇指十秒，随便约定一件很小的事。" },
  { id: 'd1-13', type: 'dare', intensity: 1, modes: BOTH_MODES, theme: 'flirt', text: "补一句：“我其实最喜欢你____的时候。”" },
  { id: 'd1-14', type: 'dare', intensity: 1, modes: ['reality'], theme: 'daily', text: "坐近一点，让肩膀轻轻贴着，保持十秒。" },
  { id: 'd1-15', type: 'dare', intensity: 1, modes: BOTH_MODES, theme: 'playful', text: "让 {partner} 从 1 到 3 选数字，你就说同样数量个 TA 的可爱点。" },
  { id: 'd1-16', type: 'dare', intensity: 1, modes: ['reality'], theme: 'chemistry', text: "和 {partner} 手掌贴手掌比一下大小，停五秒再放开。" },
  { id: 't2-01', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'flirt', text: '{partner} 怎么撩你最有效？直接一点、黏一点，还是装没事？' },
  { id: 't2-02', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'chemistry', text: '你觉得 {partner} 哪种穿搭最戳你？' },
  { id: 't2-03', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'jealousy', text: '你最容易在哪种小事上吃 {partner} 的醋？' },
  { id: 't2-04', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'flirt', text: '你更喜欢 {partner} 主动找你，还是故意等你先忍不住？' },
  { id: 't2-05', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'daily', text: '如果今晚能单独待两个小时，你最想怎么过？' },
  { id: 't2-06', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'flirt', text: '你最想听 {partner} 在什么时候突然说一句“想你了”？' },
  { id: 't2-07', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'chemistry', text: '你觉得 {partner} 最好看的地方是哪儿？只能选一个。' },
  { id: 't2-08', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'playful', text: '你有没有故意晚回过 {partner} 消息，想看看 TA 会不会来找你？' },
  { id: 't2-09', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'jealousy', text: '如果有人当着你的面夸 {partner} 很有魅力，你第一反应是什么？' },
  { id: 't2-10', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'flirt', text: '你更喜欢被叫“宝贝”、名字，还是别的？说一个你真的会心动的。' },
  { id: 't2-11', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'chemistry', text: '如果可以偷亲 {partner} 一下，你第一反应会选额头、脸还是嘴？' },
  { id: 't2-12', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'daily', text: '你最喜欢几点收到 {partner} 的消息：早上醒来、下班后，还是睡前？' },
  { id: 't2-13', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'flirt', text: '你什么时候最想让 {partner} 多黏你一会儿？' },
  { id: 't2-14', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'playful', text: '你们俩谁比较会嘴硬？谁先说“没事”但其实最有事？' },
  { id: 't2-15', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'chemistry', text: '{partner} 哪个眼神或表情最容易让你心软？' },
  { id: 't2-16', type: 'truth', intensity: 2, modes: BOTH_MODES, theme: 'flirt', text: '如果 {partner} 现在说“过来”，你希望下一句是什么？' },
  { id: 'd2-01', type: 'dare', intensity: 2, modes: BOTH_MODES, theme: 'flirt', text: "对 {partner} 说一句明显在撩 TA 的话，不许用“喜欢你”三个字。" },
  { id: 'd2-02', type: 'dare', intensity: 2, modes: ['chat'], theme: 'flirt', text: "发一句“你再这样我就____了”，空格自己填。" },
  { id: 'd2-03', type: 'dare', intensity: 2, modes: ['reality'], theme: 'chemistry', text: "和 {partner} 对视十秒，谁先笑谁输。" },
  { id: 'd2-04', type: 'dare', intensity: 2, modes: ['reality'], theme: 'intimacy', text: "和 {partner} 十指扣住十秒，再决定谁先松手。" },
  { id: 'd2-05', type: 'dare', intensity: 2, modes: ['reality'], theme: 'chemistry', text: "靠近一点，认真夸 {partner} 一个外貌细节。" },
  { id: 'd2-06', type: 'dare', intensity: 2, modes: ['chat'], theme: 'flirt', text: "发一条像是随口问、其实很想见 TA 的消息。" },
  { id: 'd2-07', type: 'dare', intensity: 2, modes: ['reality'], theme: 'intimacy', text: "抱 {partner} 十二秒，中间不说话。" },
  { id: 'd2-08', type: 'dare', intensity: 2, modes: BOTH_MODES, theme: 'playful', text: "让 {partner} 选“乖一点 / 坏一点 / 黏一点”，你用那个语气说一句话。" },
  { id: 'd2-09', type: 'dare', intensity: 2, modes: ['reality'], theme: 'flirt', text: "如果都愿意，亲一下 {partner} 的额头或脸颊。" },
  { id: 'd2-10', type: 'dare', intensity: 2, modes: ['chat'], theme: 'flirt', text: "给 {partner} 发一句“今晚给你一个特权：____”。" },
  { id: 'd2-11', type: 'dare', intensity: 2, modes: ['reality'], theme: 'intimacy', text: "让 {partner} 在“牵手 / 靠肩 / 抱一下”里选一个，做十五秒。" },
  { id: 'd2-12', type: 'dare', intensity: 2, modes: ['reality'], theme: 'chemistry', text: "坐到更近的位置，让膝盖或肩轻轻碰着十秒。" },
  { id: 'd2-13', type: 'dare', intensity: 2, modes: BOTH_MODES, theme: 'chemistry', text: "盯着 {partner} 的眼睛或头像，说一句你平时会害羞不敢说的话。" },
  { id: 'd2-14', type: 'dare', intensity: 2, modes: ['reality'], theme: 'flirt', text: "轻轻碰一下 {partner} 的脸颊、头发或手，三选一。" },
  { id: 'd2-15', type: 'dare', intensity: 2, modes: BOTH_MODES, theme: 'jealousy', text: "说一句：“我会吃醋的点其实是____。”" },
  { id: 'd2-16', type: 'dare', intensity: 2, modes: ['reality'], theme: 'flirt', text: "牵住 {partner} 的手，把 TA 往自己这边轻轻拉近一点。" },
  { id: 't3-01', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'intimacy', text: '你最喜欢 {partner} 抱你的哪种方式：正面抱、从背后抱，还是把你搂过去？' },
  { id: 't3-02', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'chemistry', text: '如果要选一个最喜欢被 {partner} 亲的地方，你会选额头、脸、嘴还是颈侧？' },
  { id: 't3-03', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'intimacy', text: '你更喜欢短短亲一下，还是慢一点、久一点的吻？' },
  { id: 't3-04', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'chemistry', text: '{partner} 靠得很近的时候，什么最容易让你心跳加快：眼神、声音、味道还是动作？' },
  { id: 't3-05', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'daily', text: '如果今晚一起睡，你更想抱着睡、牵手睡，还是各睡各的但靠很近？' },
  { id: 't3-06', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'intimacy', text: '你最喜欢 {partner} 怎么碰你：摸头、牵手、搂腰、抱紧，还是别的？' },
  { id: 't3-07', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'memory', text: '有没有哪次亲吻、拥抱或靠得很近的瞬间，你偶尔还会想起来？' },
  { id: 't3-08', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'flirt', text: '如果 {partner} 在你耳边说一句话，你最想听什么？' },
  { id: 't3-09', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'chemistry', text: '你觉得自己身上哪个地方最希望 {partner} 觉得好看？' },
  { id: 't3-10', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'intimacy', text: '你最喜欢什么时候和 {partner} 黏在一起：刚见面、要分别、睡前，还是半夜？' },
  { id: 't3-11', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'flirt', text: '如果 {partner} 把你拉近一点，你更可能装镇定，还是直接顺势靠过去？' },
  { id: 't3-12', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'playful', text: '你觉得你们两个谁亲人的时候更容易害羞？' },
  { id: 't3-13', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'intimacy', text: '你最喜欢被 {partner} 从哪里抱住：肩、腰，还是整个人圈住？' },
  { id: 't3-14', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'chemistry', text: '哪种“很近但还没亲上”的瞬间最撩你？' },
  { id: 't3-15', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'flirt', text: '如果今晚只能选一种亲密感，你要拥抱、接吻、贴着聊天，还是一起睡到自然醒？' },
  { id: 't3-16', type: 'truth', intensity: 3, modes: BOTH_MODES, theme: 'intimacy', text: '你最喜欢 {partner} 在亲密的时候叫你什么？' },
  { id: 'd3-01', type: 'dare', intensity: 3, modes: ['reality'], theme: 'intimacy', text: "和 {partner} 抱十五秒，这次抱紧一点。" },
  { id: 'd3-02', type: 'dare', intensity: 3, modes: ['reality'], theme: 'chemistry', text: "让 {partner} 选额头、脸或嘴，亲一下。" },
  { id: 'd3-03', type: 'dare', intensity: 3, modes: ['chat'], theme: 'flirt', text: "发一句：“你现在要是在我旁边，我大概会先____。”" },
  { id: 'd3-04', type: 'dare', intensity: 3, modes: ['reality'], theme: 'intimacy', text: "坐近一点，让你们的肩或腿贴着，保持十五秒。" },
  { id: 'd3-05', type: 'dare', intensity: 3, modes: ['reality'], theme: 'flirt', text: "贴近 {partner} 耳边说一句只有 TA 听得到的暧昧话。" },
  { id: 'd3-06', type: 'dare', intensity: 3, modes: ['reality'], theme: 'chemistry', text: "如果都愿意，和 {partner} 接一个至少八秒的吻。" },
  { id: 'd3-07', type: 'dare', intensity: 3, modes: BOTH_MODES, theme: 'flirt', text: "让 {partner} 选“温柔 / 直接一点 / 黏人”，你用那个风格说一句想靠近 TA 的话。" },
  { id: 'd3-08', type: 'dare', intensity: 3, modes: ['reality'], theme: 'intimacy', text: "从背后抱住 {partner} 十秒，或者让 TA 从背后抱你。" },
  { id: 'd3-09', type: 'dare', intensity: 3, modes: ['reality'], theme: 'chemistry', text: "把手轻轻放在 {partner} 腰侧五秒，再告诉 TA 刚刚哪里最让你心动。" },
  { id: 'd3-10', type: 'dare', intensity: 3, modes: ['chat'], theme: 'flirt', text: "发一句不带 emoji 的暧昧消息，让 {partner} 一眼就看懂。" },
  { id: 'd3-11', type: 'dare', intensity: 3, modes: ['reality'], theme: 'intimacy', text: "牵住 {partner} 的手，把 TA 拉到离你更近的位置，停十秒。" },
  { id: 'd3-12', type: 'dare', intensity: 3, modes: ['reality'], theme: 'playful', text: "让 {partner} 选“亲一下 / 抱紧一点 / 坐得更近”，完成一个。" },
  { id: 'd3-13', type: 'dare', intensity: 3, modes: BOTH_MODES, theme: 'flirt', text: "说一句：“你别这样看我，不然我会____。”" },
  { id: 'd3-14', type: 'dare', intensity: 3, modes: ['reality'], theme: 'chemistry', text: "轻轻摸一下 {partner} 的头发、脸颊或后颈，三选一。" },
  { id: 'd3-15', type: 'dare', intensity: 3, modes: ['reality'], theme: 'intimacy', text: "抱住 {partner}，在 TA 耳边说一句你最想听到的情话。" },
  { id: 'd3-16', type: 'dare', intensity: 3, modes: ['reality'], theme: 'flirt', text: "如果都愿意，亲 {partner} 一下，再说：“今晚别离我太远。”" },
  { id: 't4-01', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "如果今晚真的想做爱，你更希望谁先开口？你会怎么说？" },
  { id: 't4-02', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "你更喜欢慢慢撩到有感觉，还是直接听见 {partner} 说“我现在想要你”？" },
  { id: 't4-03', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "什么最容易把你的欲望勾起来：接吻、身体贴近、耳边说话，还是对方主动？" },
  { id: 't4-04', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "前戏对你有多重要？你更吃接吻、触碰、说话还是气氛这一套？" },
  { id: 't4-05', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'chemistry', adultOnly: true, text: "你最喜欢 {partner} 亲你哪里？不用绕，直接说。" },
  { id: 't4-06', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "做爱前，你最想听 {partner} 对你说哪一句话？" },
  { id: 't4-07', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'intimacy', adultOnly: true, text: "做完以后你最想要什么：抱着、聊天、洗澡、吃东西，还是直接睡？" },
  { id: 't4-08', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "你更喜欢开灯、留一点光，还是关灯？哪种最容易进入状态？" },
  { id: 't4-09', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "在床上你更喜欢自己主动带节奏，还是让 {partner} 主动一点？" },
  { id: 't4-10', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "你喜欢性爱更温柔慢一点，还是更直接、更有冲劲一点？" },
  { id: 't4-11', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'flirt', adultOnly: true, text: "{partner} 穿什么、做什么，最容易让你一下子觉得“今天很危险”？" },
  { id: 't4-12', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "你更喜欢提前有点预告、慢慢期待，还是临时起意更刺激？" },
  { id: 't4-13', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "如果只能选一个，你更在意接吻合拍、身体贴得舒服，还是床上节奏合拍？" },
  { id: 't4-14', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "你理想的性爱频率更像“看感觉”、固定一点，还是想要就直接说？" },
  { id: 't4-15', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "床上你喜欢对方多说话吗？更想听夸你的、哄你的，还是直接一点的话？" },
  { id: 't4-16', type: 'truth', intensity: 4, modes: BOTH_MODES, theme: 'intimacy', adultOnly: true, text: "性爱里你最不想省掉哪件事：避孕、确认舒服、结束后抱一会，还是别的？" },
  { id: 'd4-01', type: 'dare', intensity: 4, modes: BOTH_MODES, theme: 'flirt', adultOnly: true, text: "看着 {partner}，直接说：“我今天真的有点想要你。”" },
  { id: 'd4-02', type: 'dare', intensity: 4, modes: ['reality'], theme: 'intimacy', adultOnly: true, text: "如果现在方便也都愿意，和 {partner} 接一个十五秒的吻。" },
  { id: 'd4-03', type: 'dare', intensity: 4, modes: ['chat'], theme: 'adult', adultOnly: true, text: "发一句成年人一看就懂的暧昧消息，不准用 emoji 糊弄过去。" },
  { id: 'd4-04', type: 'dare', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "直接告诉 {partner}：今晚你最想被怎么亲、亲哪里。" },
  { id: 'd4-05', type: 'dare', intensity: 4, modes: ['reality'], theme: 'intimacy', adultOnly: true, text: "让 {partner} 选“抱紧 / 搂腰 / 亲久一点”，完成一个。" },
  { id: 'd4-06', type: 'dare', intensity: 4, modes: ['reality'], theme: 'adult', adultOnly: true, text: "如果都愿意，坐到 {partner} 腿上或让 TA 坐到你腿上，停十秒。" },
  { id: 'd4-07', type: 'dare', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "用 1 到 10 给你现在对 {partner} 的欲望值打分，再说一句为什么。" },
  { id: 'd4-08', type: 'dare', intensity: 4, modes: BOTH_MODES, theme: 'flirt', adultOnly: true, text: "让 {partner} 选“温柔一点 / 直接一点 / 坏一点”，你用那个风格撩 TA 一句。" },
  { id: 'd4-09', type: 'dare', intensity: 4, modes: ['reality'], theme: 'adult', adultOnly: true, text: "贴近 {partner} 耳边，直接说今晚你最想和 TA 做什么。" },
  { id: 'd4-10', type: 'dare', intensity: 4, modes: ['chat'], theme: 'adult', adultOnly: true, text: "发一句：“你要是在我旁边，我今晚大概不会只想抱你。”" },
  { id: 'd4-11', type: 'dare', intensity: 4, modes: ['reality'], theme: 'chemistry', adultOnly: true, text: "让 {partner} 从嘴、颈侧、耳边三个位置里选一个，你亲一下。" },
  { id: 'd4-12', type: 'dare', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "各自说一个性爱里希望对方多做一点的事，再说一个不想碰的点。" },
  { id: 'd4-13', type: 'dare', intensity: 4, modes: ['reality'], theme: 'intimacy', adultOnly: true, text: "从背后抱住 {partner}，手放在腰上十秒，再亲一下脸或颈侧。" },
  { id: 'd4-14', type: 'dare', intensity: 4, modes: ['reality'], theme: 'chemistry', adultOnly: true, text: "关掉手机一分钟，贴近一点，只看着对方；想亲就先问一句“可以吗”。" },
  { id: 'd4-15', type: 'dare', intensity: 4, modes: BOTH_MODES, theme: 'adult', adultOnly: true, text: "说一句你真的会在做爱前对成年伴侣说的话，别写成偶像剧台词。" },
  { id: 'd4-16', type: 'dare', intensity: 4, modes: ['reality'], theme: 'adult', adultOnly: true, text: "如果都愿意，抱着 {partner} 接一个慢一点的吻，停下后各说一句“还想继续什么”。" },
  { id: 't5-01', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "说真的，你理想的性爱频率大概是多少？如果你们想要的频率不一样，你更希望怎么协调？" },
  { id: 't5-02', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "前戏你更喜欢慢慢来，还是很快进入正题？大概什么节奏最舒服？" },
  { id: 't5-03', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "床上你更喜欢谁主导？是固定一点，还是看当天谁更有感觉？" },
  { id: 't5-04', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "你更喜欢温柔、慢一点的性爱，还是更直接、更激烈一点？" },
  { id: 't5-05', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "接吻时你最喜欢哪种感觉：轻一点、久一点、主动一点，还是被对方按住节奏？" },
  { id: 't5-06', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "床上你喜欢安静一点，还是喜欢对方说话？你最想听哪类话？" },
  { id: 't5-07', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "你有没有特别吃的一种“被需要感”？比如对方主动抱你、拉你过去，或者直接说想要你。" },
  { id: 't5-08', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "你什么时候最容易有欲望：早上、洗完澡、睡前、久别重逢，还是完全看感觉？" },
  { id: 't5-09', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "有没有一种情趣你愿意和 {partner} 聊聊：角色扮演、蒙眼、情趣穿搭、成人玩具，还是别的？" },
  { id: 't5-10', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "你更喜欢性爱有一点计划和仪式感，还是临时起意更带劲？" },
  { id: 't5-11', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "你最希望 {partner} 在床上更主动问你的是什么：舒服吗、想怎么来、要不要慢一点，还是别的？" },
  { id: 't5-12', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "如果你们床上节奏不太一样，你更希望直接说，还是用动作和反应让对方知道？" },
  { id: 't5-13', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "你更在意自己舒服、对方舒服，还是两个人都很投入的同步感？为什么？" },
  { id: 't5-14', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "有没有一种你喜欢、但平时不太会主动提的亲密偏好？可以只说到你舒服的程度。" },
  { id: 't5-15', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "做完以后你更想黏着一会、聊几句、洗澡，还是各自安静一下？" },
  { id: 't5-16', type: 'truth', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "床上默契这件事，你觉得你们现在最合拍的是哪一点，最想继续磨合的又是哪一点？" },
  { id: 'd5-01', type: 'dare', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "直接告诉 {partner}：床上你最希望 TA 更主动的一件事是什么。" },
  { id: 'd5-02', type: 'dare', intensity: 5, modes: ['reality'], theme: 'private', adultOnly: true, text: "如果都愿意，坐到 {partner} 腿上面对 TA 十秒，只看着对方。" },
  { id: 'd5-03', type: 'dare', intensity: 5, modes: ['reality'], theme: 'private', adultOnly: true, text: "和 {partner} 接一个二十秒的吻，中间谁想停都可以直接停。" },
  { id: 'd5-04', type: 'dare', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "各说一个“我在床上其实很吃这一套”的偏好，越具体越好，但不用现场做。" },
  { id: 'd5-05', type: 'dare', intensity: 5, modes: ['reality'], theme: 'private', adultOnly: true, text: "从背后抱住 {partner}，搂着腰，在耳边说一句“今晚我想你怎么对我”。" },
  { id: 'd5-06', type: 'dare', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "让 {partner} 在“更温柔 / 更主动 / 更慢一点 / 更大胆一点”里选一个，你也选一个。" },
  { id: 'd5-07', type: 'dare', intensity: 5, modes: ['reality'], theme: 'private', adultOnly: true, text: "如果都愿意，让 {partner} 选嘴、颈侧或锁骨附近，你亲一下。" },
  { id: 'd5-08', type: 'dare', intensity: 5, modes: ['chat'], theme: 'private', adultOnly: true, text: "发一句你真的可能在深夜发给 {partner} 的成人暧昧消息，别写得像文案。" },
  { id: 'd5-09', type: 'dare', intensity: 5, modes: ['reality'], theme: 'private', adultOnly: true, text: "把手放在 {partner} 的腰或背上，把 TA 轻轻拉近，保持十秒。" },
  { id: 'd5-10', type: 'dare', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "各自说一个想尝试的情趣，再给它打“现在就能聊 / 以后再聊 / 没兴趣”三选一。" },
  { id: 'd5-11', type: 'dare', intensity: 5, modes: ['reality'], theme: 'private', adultOnly: true, text: "如果都愿意，抱着 {partner} 亲一下颈侧，再停下来问 TA 还想不想继续。" },
  { id: 'd5-12', type: 'dare', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "直接说一句：“我做爱时最喜欢你____。”空格自己填。" },
  { id: 'd5-13', type: 'dare', intensity: 5, modes: ['reality'], theme: 'private', adultOnly: true, text: "贴到 {partner} 耳边，用一句话说清楚你现在最想被怎么亲。" },
  { id: 'd5-14', type: 'dare', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "各自说一个床上“绝对加分”的点和一个“马上没感觉”的点。" },
  { id: 'd5-15', type: 'dare', intensity: 5, modes: ['reality'], theme: 'private', adultOnly: true, text: "如果都愿意，关掉屏幕，抱着接吻十五秒；结束后各用一个词形容刚才的感觉。" },
  { id: 'd5-16', type: 'dare', intensity: 5, modes: BOTH_MODES, theme: 'private', adultOnly: true, text: "用一句最直接的话告诉 {partner}：今晚你的状态是“只想抱 / 想亲 / 想做爱 / 看感觉”，选一个。" },
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
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  modes: z.array(z.union([z.literal('chat'), z.literal('reality')])).min(1).max(2),
  text: z.string().min(1).max(240),
  theme: z.union([z.literal('daily'), z.literal('memory'), z.literal('playful'), z.literal('flirt'), z.literal('jealousy'), z.literal('chemistry'), z.literal('intimacy'), z.literal('adult'), z.literal('private')]).optional(),
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
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  mode: z.union([z.literal('chat'), z.literal('reality')]),
  adultConfirmed: z.boolean(),
  visualMode: z.union([z.literal('romantic'), z.literal('pixel')]).optional()
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
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
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
    adultOnly: parsed.data.adultOnly || parsed.data.intensity >= 4,
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
  if (settings.intensity < 4) return undefined
  if (typeof settings.characterAge === 'number' && settings.characterAge < 18) {
    return '成人/私房模式不能用于年龄明确小于 18 岁的角色。'
  }
  if (!settings.adultConfirmed) {
    return '开启 L4/L5 前，需要确认双方均为成年人并同意成人向题目。'
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
    adultOnly: draft.intensity >= 4,
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
    adultOnly: draft.intensity >= 4,
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
    (!prompt.adultOnly || intensity >= 4)
  )
}

function sessionPromptPool(game: CoupleBoardGame, type: CoupleBoardPromptType) {
  return (game.sessionPrompts || []).filter(prompt =>
    prompt.source === 'custom' &&
    prompt.type === type &&
    prompt.intensity <= game.settings.intensity &&
    prompt.modes.includes(game.settings.mode) &&
    (!prompt.adultOnly || game.settings.intensity >= 4)
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

function recentPromptVariety(game: CoupleBoardGame, type: CoupleBoardPromptType) {
  const ids: string[] = []
  const themes: CoupleBoardPromptTheme[] = []
  for (const entry of [...game.history].reverse()) {
    if (!entry.promptId) continue
    const prompt = getCoupleBoardGamePrompt(game, entry.promptId)
    if (!prompt || prompt.type !== type) continue
    ids.push(prompt.id)
    if (prompt.theme && !themes.includes(prompt.theme)) themes.push(prompt.theme)
    if (ids.length >= 3) break
  }
  return { ids: new Set(ids), themes: new Set(themes.slice(0, 2)) }
}

export function drawCoupleBoardGamePrompt(
  game: CoupleBoardGame,
  type: CoupleBoardPromptType,
  random = Math.random(),
  excludeId?: string
): CoupleBoardPrompt {
  const candidates = promptsForGame(game, type)
  if (!candidates.length) throw new Error('当前模式没有可用题目。')

  const recent = recentPromptVariety(game, type)
  let pool = candidates.filter(prompt =>
    prompt.id !== excludeId &&
    !recent.ids.has(prompt.id) &&
    (!prompt.theme || !recent.themes.has(prompt.theme))
  )
  if (!pool.length) pool = candidates.filter(prompt => prompt.id !== excludeId && !recent.ids.has(prompt.id))
  if (!pool.length) pool = candidates.filter(prompt => prompt.id !== excludeId)
  if (!pool.length) pool = candidates
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
        const prompt = drawCoupleBoardGamePrompt(next, promptType, random)
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
