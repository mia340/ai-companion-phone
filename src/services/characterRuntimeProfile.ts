import type { Character, ChatSettings } from '../types/domain'
import type { CommunityUiContract } from './communityUiRuntime'

export type CharacterRuntimeOrigin = 'native' | 'community'

export interface CharacterRuntimeProfile {
  origin: CharacterRuntimeOrigin
  compatibilityMode: 'card-first' | 'phone-enhanced'
  preserveCardOutput: boolean
  useNativeInteractionProtocol: boolean
  allowNativeMessageReshaping: boolean
  reasons: string[]
}

function isCommunityCharacter(character: Character) {
  if (character.importFormat && character.importFormat !== 'native') return true
  if (character.sourceSpec || character.sourceSpecVersion) return true
  if (character.rawCardExtensions && Object.keys(character.rawCardExtensions).length) return true
  return false
}

export function resolveCharacterRuntimeProfile(options: {
  character: Character
  settings: ChatSettings
  communityUiContract?: CommunityUiContract
  resourceUiActive?: boolean
}): CharacterRuntimeProfile {
  const { character, settings, communityUiContract, resourceUiActive = false } = options
  const origin: CharacterRuntimeOrigin = isCommunityCharacter(character) ? 'community' : 'native'
  const requested = settings.compatibilityMode || 'auto'
  const presentationMode = settings.conversationPresentationMode ?? 'scene-merged'
  // 默认“场景合并”仍等价于原卡原样输出；用户在自动模式下明确改选“纯手机/动作分离”时，
  // 这本身就是一次清晰的呈现偏好，因此可以启用小手机消息整形。显式 card-first 永远更高优先级。
  const presentationOverride = requested === 'auto' && presentationMode !== 'scene-merged'
  const compatibilityMode = requested === 'auto' ? (presentationOverride ? 'phone-enhanced' : 'card-first') : requested
  const uiOwnsOutput = Boolean(communityUiContract?.active || resourceUiActive)
  const preserveCardOutput = uiOwnsOutput || compatibilityMode === 'card-first'
  const useNativeInteractionProtocol = Boolean(
    settings.actionProtocolEnabled &&
    compatibilityMode === 'phone-enhanced' &&
    !uiOwnsOutput
  )
  const allowNativeMessageReshaping = compatibilityMode === 'phone-enhanced' && !uiOwnsOutput

  const reasons = [
    origin === 'community' ? '角色来自社区角色卡/兼容格式' : '角色由小手机原生创建',
    requested === 'auto'
      ? (presentationOverride
          ? '用户选择了非默认聊天呈现方式，自动启用普通消息整形；原卡固定 UI 仍优先'
          : '自动模式使用默认场景合并，保持 AI / 原卡原样输出')
      : `用户指定${compatibilityMode === 'card-first' ? '原卡优先' : '小手机增强'}策略`,
    communityUiContract?.active ? '检测到原卡固定输出协议，强制原卡优先' : '',
    resourceUiActive ? '当前正在使用社区资源界面，会话期间暂停小手机私有消息整形' : ''
  ].filter(Boolean)

  return {
    origin,
    compatibilityMode,
    preserveCardOutput,
    useNativeInteractionProtocol,
    allowNativeMessageReshaping,
    reasons
  }
}
