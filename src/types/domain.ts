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

  // 基础身份
  name: string
  nickname?: string
  avatar: string
  gender?: 'female' | 'male' | 'nonbinary' | 'unspecified'
  age?: number
  identity?: string

  // 角色设定
  persona: string
  speakingStyle?: string
  background?: string
  likes?: string[]
  dislikes?: string[]

  // 当前状态
  relationship: string
  mood: string
  activity: string

  // 系统配置
  groups: UUID[]
  replySpeed: 'instant' | 'natural' | 'slow' | 'custom'
  modelRoute?: UUID

  // 时间记录
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

export interface Message {
  id: UUID
  worldId: UUID
  conversationId: UUID
  senderId: UUID | 'user'
  type: 'text' | 'system'
  content: string
  status: 'delivered' | 'read'
  createdAt: string
}
