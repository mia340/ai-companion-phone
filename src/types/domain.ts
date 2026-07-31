export type UUID = string

export interface World {
  id: UUID
  name: string
  eventLevel: 'quiet' | 'daily' | 'active' | 'dramatic'
  paused: boolean
  createdAt: string
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

  persona: string
  speakingStyle?: string
  background?: string
  likes?: string[]
  dislikes?: string[]

  relationship: string
  mood: string
  activity: string

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

export interface Message {
  id: UUID
  worldId: UUID
  conversationId: UUID
  senderId: UUID | 'user'
  type: 'text' | 'system' | 'music' | 'image'
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
  visionUsed?: boolean
  visionFallback?: boolean
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
