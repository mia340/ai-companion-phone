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
export type PresenceMode = 'auto' | 'together' | 'remote'
export type ActionVisibility = 'off' | 'together' | 'always'
export type ActionTextLayout = 'auto' | 'separate' | 'merged'
export type CompanionMessageKind = 'text' | 'emoji' | 'voice' | 'scene_action'
export type CompanionActionKind = CompanionMessageKind | 'typing_pause' | 'recall_message' | 'react_to_message' | 'image_placeholder'
export type ProactiveFrequency = 'low' | 'natural' | 'high'
export type ProactiveSource = 'continue-topic' | 'promise-reminder' | 'daily-share' | 'care' | 'story-event'
export type MemoryLayer = 'fact' | 'subjective' | 'shared' | 'promise' | 'relationship' | 'story'
export type MemoryStatus = 'active' | 'conflict' | 'invalid'

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
  cardVersion?: 2 | 3

  // V0.4.1 资源来源与社区分享信息
  creator?: string
  resourceVersion?: string
  sourceUrl?: string
  license?: string
  allowDerivative?: boolean
  importFormat?: 'native' | 'sillytavern-v2' | 'sillytavern-v3' | 'legacy-json'
  embeddedUserTemplate?: string
  embeddedUserPersonaId?: UUID

  // V0.4.3.4 社区角色卡扩展兼容（安全读取，不执行第三方 JS）
  talkativeness?: number
  depthPrompt?: { prompt: string; depth?: number; role?: string }
  worldBookHint?: string
  rawCardExtensions?: Record<string, unknown>
  groupOnlyGreetings?: string[]

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

export type PersonaImportFormat =
  | 'native-v1'
  | 'native-v2'
  | 'sillytavern-persona'
  | 'sillytavern-character-v2'
  | 'sillytavern-character-v3'
  | 'tavo-json'
  | 'tavo-text'
  | 'generic-json'
  | 'plain-text'

export interface UserPersona {
  id: UUID
  name: string
  avatar: string
  title?: string
  description?: string
  identity?: string
  age?: string
  gender?: string
  birthday?: string
  height?: string
  occupation?: string
  appearance?: string
  personality?: string
  publicPersona?: string
  privatePersona?: string
  strengths?: string
  weaknesses?: string
  interests?: string
  habits?: string
  lifestyle?: string
  background?: string
  relationshipNote?: string
  characterKnowledge?: string
  boundaries?: string
  tags?: string[]
  creator?: string
  sourceUrl?: string
  sourceFileName?: string
  importFormat?: PersonaImportFormat
  extraFields?: Record<string, unknown>
  personaScope?: 'global' | 'character'
  boundCharacterId?: UUID
  boundCharacterName?: string
  sourceUserTemplate?: string
  isCardTemplate?: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type ResourceType = 'lorebook' | 'preset' | 'regex'
export type ResourceSourceFormat = 'native' | 'sillytavern' | 'tavo' | 'character-card' | 'legacy'

export interface LorebookResource {
  id: UUID
  worldId: UUID
  name: string
  description?: string
  characterId?: UUID
  sourceFileName?: string
  sourceFormat?: ResourceSourceFormat
  scanDepth?: number
  tokenBudget?: number
  recursiveScanning?: boolean
  rawExtensions?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface LorebookEntry {
  id: UUID
  worldId: UUID
  lorebookId?: UUID
  characterId?: UUID
  title: string
  keywords: string[]
  secondaryKeys?: string[]
  content: string
  enabled: boolean
  constant: boolean
  caseSensitive: boolean
  matchWholeWords?: boolean
  useRegex?: boolean
  selective?: boolean
  selectiveLogic?: number | string
  priority: number
  insertionOrder?: number
  position?: number | string
  depth?: number
  role?: number | string
  probability?: number
  useProbability?: boolean
  sticky?: number
  cooldown?: number
  delay?: number
  group?: string
  groupOverride?: boolean
  groupWeight?: number
  scanDepth?: number
  excludeRecursion?: boolean
  preventRecursion?: boolean
  delayUntilRecursion?: boolean
  useGroupScoring?: boolean
  matchPersonaDescription?: boolean
  matchCharacterDescription?: boolean
  matchCharacterPersonality?: boolean
  matchCharacterDepthPrompt?: boolean
  matchScenario?: boolean
  matchCreatorNotes?: boolean
  sourceEntryId?: number | string
  rawExtensions?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface PromptPresetPrompt {
  identifier: string
  name: string
  content?: string
  role?: 'system' | 'user' | 'assistant' | string
  enabled: boolean
  marker?: boolean
  systemPrompt?: boolean
  injectionPosition?: number
  injectionDepth?: number
  forbidOverrides?: boolean
  raw?: Record<string, unknown>
}

export interface PromptPreset {
  id: UUID
  worldId: UUID
  name: string
  prompts: PromptPresetPrompt[]
  promptOrder: Array<{ identifier: string; enabled: boolean }>
  promptOrderGroups?: Array<{ characterId?: number | string; order: Array<{ identifier: string; enabled: boolean }> }>
  sourceFileName?: string
  sourceFormat?: ResourceSourceFormat
  rawConfig?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface RegexScript {
  id: UUID
  worldId: UUID
  characterId?: UUID
  name: string
  findRegex: string
  replaceString: string
  trimStrings: string[]
  placement: number[]
  enabled: boolean
  markdownOnly: boolean
  promptOnly: boolean
  runOnEdit: boolean
  substituteRegex: number
  minDepth?: number
  maxDepth?: number
  sourceFileName?: string
  sourceFormat?: ResourceSourceFormat
  raw?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}


export type CommunityArchiveKind = ResourceType | 'character-card' | 'persona' | 'theme' | 'unknown'

export interface CommunityResourceArchive {
  id: UUID
  worldId: UUID
  kind: CommunityArchiveKind
  name: string
  fileName: string
  mimeType?: string
  sourceFormat?: ResourceSourceFormat | string
  rawText?: string
  rawJson?: unknown
  importedResourceIds: UUID[]
  compatibility: {
    format: string
    summary: string[]
    supported: string[]
    warnings: string[]
  }
  createdAt: string
  updatedAt: string
}
export type ResourceBindingScope = 'global' | 'character' | 'conversation' | 'persona'

export interface ResourceBinding {
  id: UUID
  worldId: UUID
  characterId?: UUID
  scope?: ResourceBindingScope
  scopeId?: UUID
  resourceType: ResourceType
  resourceId: UUID
  enabled: boolean
  order: number
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

export interface RoleCardUiState {
  date?: string
  time?: string
  location?: string
  inner?: string
  surroundings?: string
  todos?: string[]
}

export interface Message {
  id: UUID
  worldId: UUID
  conversationId: UUID
  senderId: UUID | 'user'
  type: 'text' | 'system' | 'music' | 'image' | 'emoji' | 'voice' | 'action' | 'rich'
  content: string
  status: MessageStatus
  createdAt: string
  roleCardUi?: RoleCardUiState
  rawContent?: string
  richHtml?: string
  richSource?: 'regex' | 'card-ui' | 'worldbook-ui'

  provider?: string
  model?: string
  fallback?: boolean
  errorText?: string
  replyGroupId?: UUID
  replySequence?: number
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
  protocolVersion?: 1 | 2
  recalledAt?: string
  recalledOriginalContent?: string
  reactionEmoji?: string
  reactionToMessageId?: UUID
  proactiveSource?: ProactiveSource
  placeholderImagePrompt?: string

  // 角色卡开场分支。用于切换开场时识别并替换旧的 seed 消息，避免多个开场叠在同一上下文。
  isGreetingSeed?: boolean
  greetingIndex?: number
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
  proactiveFrequency: ProactiveFrequency
  proactiveQuietHoursEnabled: boolean
  proactiveQuietStart: string
  proactiveQuietEnd: string
  proactiveAllowedSources: ProactiveSource[]
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

  // V0.4.2.1 场景距离与动作视角
  presenceMode: PresenceMode
  actionVisibility: ActionVisibility
  actionTextLayout: ActionTextLayout
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

  // V0.4.2 多层记忆与可靠性字段。旧记录缺少这些字段时会按默认值读取。
  layer?: MemoryLayer
  subject?: string
  topicKey?: string
  confidence?: number
  locked?: boolean
  status?: MemoryStatus
  dueAt?: string
  sourceType?: 'automatic' | 'manual' | 'imported'
  lastHitAt?: string
  hitCount?: number
  mergedFrom?: UUID[]
  conflictWith?: UUID[]
  note?: string

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
  presence?: 'together' | 'remote'
  reportedPresence?: 'together' | 'remote'
  presenceResolutionReason?: string
  presenceResolutionSource?: 'manual' | 'direct-contact' | 'co-presence' | 'ui-surroundings' | 'reported-status' | 'unknown'
  relationshipNote?: string
  timePeriod?: string
  energy?: string
  unresolvedTopics?: string[]
  pendingEvents?: string[]
  shortTermGoals?: string[]
  lastCompletedEvent?: string
  lastActionSummary?: string
  stateVersion?: 2
  statusUpdatedAt?: string
  updatedAt: string
}


export interface ConversationStateHistory {
  id: UUID
  conversationId: UUID
  characterId: UUID
  field: 'location' | 'presence' | 'timePeriod' | 'energy' | 'mood' | 'activity' | 'relationship' | 'topic' | 'event' | 'goal'
  label: string
  previousValue?: string
  nextValue: string
  sourceMessageId?: UUID
  createdAt: string
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
  activatedLorebook: Array<{ id: UUID; title: string; reason?: string }>
  memoryHits: Array<{ id: UUID; content: string; importance: number; layer?: MemoryLayer; score?: number; reason?: string }>
  imageCount: number
  estimatedCharacters: number
  promptSections?: Array<{ key: string; label: string; characters: number; budget?: number; truncated?: boolean }>
  truncations?: string[]
  ruleInfluences?: string[]
  naturalnessScore?: {
    total: number
    roleConsistency: number
    aiToneRisk: number
    repetitionRisk: number
    questionBalance: number
    lengthFit: number
    relationshipResponse: number
    userFocus: number
    imageUse: number
  }
  protocolEnabled: boolean
  rawOutput?: string
  visibleOutput?: string
  actionSummary?: string
  presenceResolution?: {
    reportedPresence?: 'together' | 'remote'
    resolvedPresence?: 'together' | 'remote'
    source: 'manual' | 'direct-contact' | 'co-presence' | 'ui-surroundings' | 'reported-status' | 'unknown'
    reason: string
    conflict?: boolean
    uiSurroundings?: string
  }
  naturalnessWarnings?: string[]
}
