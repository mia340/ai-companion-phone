export type UUID = string

export interface World {
  id: UUID
  name: string
  eventLevel: 'quiet' | 'daily' | 'active' | 'dramatic'
  paused: boolean
  createdAt: string
}

export type RoleplayMode = 'daily' | 'immersive' | 'deep'
export type NarrationStyle = 'none' | 'light' | 'immersive'
export type InitiativeLevel = 'low' | 'natural' | 'high'
export type EmojiFrequency = 'none' | 'low' | 'natural' | 'high'
export type QuestionFrequency = 'low' | 'natural' | 'high'
export type MessagePacing = 'off' | 'quick' | 'natural' | 'slow'
export type CompanionMessageKind = 'text' | 'emoji' | 'voice'

export interface CharacterExampleDialogue {
  id: UUID
  user: string
  assistant: string
}

export interface Character {
  id: UUID
  worldId: UUID

  name: string
  nickname?: string
  avatar: string
  gender?: 'female' | 'male' | 'nonbinary' | 'unspecified'
  age?: number
  identity?: string
  appearance?: string

  persona: string
  speakingStyle?: string
  background?: string
  values?: string
  habits?: string
  weaknesses?: string
  secrets?: string
  boundaries?: string
  likes?: string[]
  dislikes?: string[]

  relationship: string
  mood: string
  activity: string

  // V0.4.0 角色卡 V2
  scenario?: string
  firstMessage?: string
  alternateGreetings?: string[]
  exampleDialogues?: CharacterExampleDialogue[]
  creatorNotes?: string
  systemPrompt?: string
  postHistoryInstructions?: string
  initiative?: InitiativeLevel
  narrationStyle?: NarrationStyle
  emojiFrequency?: EmojiFrequency
  questionFrequency?: QuestionFrequency
  tags?: string[]
  cardVersion?: 2

  // V0.4.1 资源来源与社区分享信息
  creator?: string
  resourceVersion?: string
  sourceUrl?: string
  license?: string
  allowDerivative?: boolean
  importFormat?: 'native' | 'sillytavern-v2' | 'sillytavern-v3' | 'legacy-json'

  groups: UUID[]
  replySpeed: 'instant' | 'natural' | 'slow' | 'custom'
  modelRoute?: UUID

  createdAt: string
  updatedAt?: string
}

export interface UserProfile {
  id: UUID
  name: string
  avatar: string
  identity?: string
  bio?: string
  createdAt: string
  updatedAt: string
}

export interface UserPersona {
  id: UUID
  name: string
  avatar: string
  identity?: string
  appearance?: string
  personality?: string
  background?: string
  relationshipNote?: string
  characterKnowledge?: string
  boundaries?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface LorebookEntry {
  id: UUID
  worldId: UUID
  characterId?: UUID
  title: string
  keywords: string[]
  content: string
  enabled: boolean
  constant: boolean
  caseSensitive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface ContactGroup {
  id: UUID
  worldId: UUID
  name: string
  order: number
}

export interface Conversation {
  id: UUID
  worldId: UUID
  type: 'single' | 'group'
  title: string
  memberIds: UUID[]
  pinned: boolean
  muted: boolean
  unread: number
  updatedAt: string
}

export type MessageStatus =
  | 'pending'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled'

export interface MessageReplyReference {
  messageId: UUID
  senderName: string
  preview: string
  type: 'text' | 'music' | 'image'
}

export interface MessageImage {
  dataUrl?: string
  name?: string
  width?: number
  height?: number
  bytes?: number
  originalBytes?: number
  originalType?: string
  outputType?: string
  processingMode?: 'original' | 'jpeg' | 'webp'
}

export interface Message {
  id: UUID
  worldId: UUID
  conversationId: UUID
  senderId: UUID | 'user'
  type: 'text' | 'system' | 'music' | 'image' | 'emoji' | 'voice'
  content: string
  status: MessageStatus
  createdAt: string

  provider?: string
  model?: string
  fallback?: boolean
  errorText?: string
  replyGroupId?: UUID
  replyTo?: MessageReplyReference
  imageDataUrl?: string
  imageName?: string
  imageWidth?: number
  imageHeight?: number
  imageBytes?: number
  images?: MessageImage[]
  visionUsed?: boolean
  visionFallback?: boolean

  // 酒馆式候选回复。content 始终保存当前正在展示的版本。
  alternatives?: string[]
  activeAlternativeIndex?: number
  editedAt?: string
  voiceDurationSeconds?: number
  protocolVersion?: 1
}

export type MemoryStrength = 'light' | 'standard' | 'deep'
export type InnerThoughtVisibility =
  | 'off'
  | 'simple'
  | 'thoughts'
  | 'detailed'
export type ReplyLength = 'short' | 'natural' | 'long'
export type RelationshipStage = '初识' | '熟悉' | '亲近' | '依赖' | '特别关系'

export interface ChatSettings {
  id: UUID
  conversationId: UUID
  memoryEnabled: boolean
  memoryStrength: MemoryStrength
  recentMessageLimit: number
  replyLength: ReplyLength
  multiBubble: boolean
  streamResponse: boolean
  showTyping: boolean
  naturalDelay: boolean
  innerThoughtVisibility: InnerThoughtVisibility
  autoFallback: boolean
  proactiveEnabled: boolean
  proactiveIntervalHours: number
  autoReadAloud: boolean
  voiceName: string
  voiceRate: number

  // V0.4.0 沉浸角色扮演设置
  roleplayMode: RoleplayMode
  personaId?: UUID
  lorebookEnabled: boolean
  swipeRepliesEnabled: boolean

  // V0.4.1 互动协议与调试
  actionProtocolEnabled: boolean
  messagePacing: MessagePacing
  promptDebugEnabled: boolean
  updatedAt: string
}

export interface CharacterMemory {
  id: UUID
  conversationId: UUID
  characterId: UUID
  category:
    | 'profile'
    | 'preference'
    | 'relationship'
    | 'event'
    | 'promise'
    | 'other'
  content: string
  importance: 1 | 2 | 3 | 4 | 5
  sourceMessageId?: UUID
  createdAt: string
  updatedAt: string
}

export interface ConversationState {
  id: UUID
  summary: string
  summaryMessageCount: number
  innerMood: string
  innerActivity: string
  innerThought: string
  thoughtUpdatedAt?: string
  lastTechnicalError?: string
  lastProviderNotice?: string
  location?: string
  relationshipNote?: string
  lastActionSummary?: string
  statusUpdatedAt?: string
  updatedAt: string
}

export interface MusicState {
  id: UUID
  title: string
  artist: string
  audioUrl: string
  sourceType: 'url' | 'local'
  currentTime: number
  duration: number
  volume: number
  isPlaying: boolean
  lastReactionTrackKey?: string
  updatedAt: string
}

export interface CharacterRelationship {
  id: UUID
  characterId: UUID
  intimacy: number
  trust: number
  familiarity: number
  stage: RelationshipStage
  emotion: string
  emotionReason: string
  lastInteractionAt: string
  lastProactiveAt: string
  chatDays: number
  musicCount: number
  updatedAt: string
}

export interface RelationshipEvent {
  id: UUID
  characterId: UUID
  conversationId: UUID
  type: 'first-chat' | 'stage' | 'music' | 'promise' | 'special'
  title: string
  description: string
  createdAt: string
}


export interface PromptDebugMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface PromptDebugTrace {
  id: UUID
  conversationId: UUID
  characterId: UUID
  createdAt: string
  provider: string
  model: string
  roleplayMode: RoleplayMode
  personaName: string
  systemPrompt: string
  recentMessages: PromptDebugMessage[]
  activatedLorebook: Array<{ id: UUID; title: string }>
  memoryHits: Array<{ id: UUID; content: string; importance: number }>
  imageCount: number
  estimatedCharacters: number
  protocolEnabled: boolean
  rawOutput?: string
  visibleOutput?: string
  actionSummary?: string
  naturalnessWarnings?: string[]
}
