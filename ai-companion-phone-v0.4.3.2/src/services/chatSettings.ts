import { db } from '../db/database'
import type {
  ChatSettings,
  ConversationState,
  MusicState
} from '../types/domain'

export function createDefaultChatSettings(
  conversationId: string
): ChatSettings {
  return {
    id: conversationId,
    conversationId,
    memoryEnabled: true,
    memoryStrength: 'standard',
    recentMessageLimit: 20,
    replyLength: 'natural',
    multiBubble: true,
    streamResponse: true,
    showTyping: true,
    naturalDelay: true,
    innerThoughtVisibility: 'thoughts',
    autoFallback: true,
    proactiveEnabled: true,
    proactiveIntervalHours: 12,
    proactiveFrequency: 'natural',
    proactiveQuietHoursEnabled: true,
    proactiveQuietStart: '23:00',
    proactiveQuietEnd: '08:00',
    proactiveAllowedSources: ['continue-topic', 'promise-reminder', 'daily-share', 'care', 'story-event'],
    autoReadAloud: false,
    voiceName: '',
    voiceRate: 1,
    roleplayMode: 'daily',
    personaId: undefined,
    lorebookEnabled: true,
    swipeRepliesEnabled: true,
    actionProtocolEnabled: true,
    messagePacing: 'natural',
    promptDebugEnabled: true,
    presenceMode: 'auto',
    actionVisibility: 'always',
    updatedAt: new Date().toISOString()
  }
}

export async function getChatSettings(
  conversationId: string
): Promise<ChatSettings> {
  const row = await db.chatSettings.get(conversationId)
  const defaults = createDefaultChatSettings(conversationId)

  return row
    ? {
      ...defaults,
      ...row,
      streamResponse: row.streamResponse ?? true,
      roleplayMode: row.roleplayMode ?? 'daily',
      lorebookEnabled: row.lorebookEnabled ?? true,
      swipeRepliesEnabled: row.swipeRepliesEnabled ?? true,
      actionProtocolEnabled: row.actionProtocolEnabled ?? true,
      messagePacing: row.messagePacing ?? 'natural',
      promptDebugEnabled: row.promptDebugEnabled ?? true,
      presenceMode: row.presenceMode ?? 'auto',
      actionVisibility: row.actionVisibility ?? 'always',
      proactiveFrequency: row.proactiveFrequency ?? 'natural',
      proactiveQuietHoursEnabled: row.proactiveQuietHoursEnabled ?? true,
      proactiveQuietStart: row.proactiveQuietStart ?? '23:00',
      proactiveQuietEnd: row.proactiveQuietEnd ?? '08:00',
      proactiveAllowedSources: row.proactiveAllowedSources?.length ? row.proactiveAllowedSources : ['continue-topic', 'promise-reminder', 'daily-share', 'care', 'story-event']
    }
    : defaults
}

export async function saveChatSettings(
  value: ChatSettings
): Promise<void> {
  await db.chatSettings.put({
    ...value,
    id: value.conversationId,
    proactiveEnabled: value.proactiveEnabled ?? true,
    proactiveIntervalHours: Math.min(168, Math.max(1, Math.round(value.proactiveIntervalHours ?? 12))),
    proactiveFrequency: value.proactiveFrequency ?? 'natural',
    proactiveQuietHoursEnabled: value.proactiveQuietHoursEnabled ?? true,
    proactiveQuietStart: value.proactiveQuietStart || '23:00',
    proactiveQuietEnd: value.proactiveQuietEnd || '08:00',
    proactiveAllowedSources: value.proactiveAllowedSources?.length ? value.proactiveAllowedSources : ['continue-topic', 'promise-reminder', 'daily-share', 'care', 'story-event'],
    presenceMode: value.presenceMode ?? 'auto',
    actionVisibility: value.actionVisibility ?? 'always',
    voiceRate: Math.min(1.4, Math.max(0.7, Number(value.voiceRate ?? 1))),
    recentMessageLimit: Math.min(
      60,
      Math.max(6, Math.round(value.recentMessageLimit))
    ),
    updatedAt: new Date().toISOString()
  })
}

export function createDefaultConversationState(
  conversationId: string
): ConversationState {
  return {
    id: conversationId,
    summary: '',
    summaryMessageCount: 0,
    innerMood: '平静',
    innerActivity: '正在等你的消息',
    innerThought: '好像还有很多话想慢慢告诉你。',
    presence: 'remote',
    timePeriod: '',
    energy: '平稳',
    unresolvedTopics: [],
    pendingEvents: [],
    shortTermGoals: [],
    stateVersion: 2,
    updatedAt: new Date().toISOString()
  }
}

export async function getConversationState(
  conversationId: string
): Promise<ConversationState> {
  const row = await db.conversationStates.get(conversationId)
  const defaults = createDefaultConversationState(conversationId)
  return row
    ? {
      ...defaults,
      ...row,
      presence: row.presence ?? 'remote',
      unresolvedTopics: row.unresolvedTopics ?? [],
      pendingEvents: row.pendingEvents ?? [],
      shortTermGoals: row.shortTermGoals ?? []
    }
    : defaults
}

export async function patchConversationState(
  conversationId: string,
  patch: Partial<ConversationState>
): Promise<ConversationState> {
  const current = await getConversationState(conversationId)
  const next: ConversationState = {
    ...current,
    ...patch,
    id: conversationId,
    updatedAt: new Date().toISOString()
  }

  await db.conversationStates.put(next)
  return next
}

export function createDefaultMusicState(
  conversationId: string
): MusicState {
  return {
    id: conversationId,
    title: '',
    artist: '',
    audioUrl: '',
    sourceType: 'url',
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isPlaying: false,
    updatedAt: new Date().toISOString()
  }
}

export async function getMusicState(
  conversationId: string
): Promise<MusicState> {
  const row = await db.musicStates.get(conversationId)
  return row ?? createDefaultMusicState(conversationId)
}

export async function saveMusicState(
  value: MusicState
): Promise<void> {
  await db.musicStates.put({
    ...value,
    id: value.id,
    currentTime: Number.isFinite(value.currentTime)
      ? Math.max(0, value.currentTime)
      : 0,
    duration: Number.isFinite(value.duration)
      ? Math.max(0, value.duration)
      : 0,
    volume: Math.min(1, Math.max(0, value.volume)),
    updatedAt: new Date().toISOString()
  })
}
