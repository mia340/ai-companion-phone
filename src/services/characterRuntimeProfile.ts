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
}): CharacterRuntimeProfile {
  const { character, settings, communityUiContract } = options
  const origin: CharacterRuntimeOrigin = isCommunityCharacter(character) ? 'community' : 'native'
  const requested = settings.compatibilityMode || 'auto'
  // 自动模式始终保持 AI/原卡输出优先。无论角色来自社区还是小手机原生创建，
  // 都只有用户明确选择“phone-enhanced”时，应用才允许额外消息整形/隐藏互动协议。
  const compatibilityMode = requested === 'auto' ? 'card-first' : requested
  const preserveCardOutput = Boolean(communityUiContract?.active) || compatibilityMode === 'card-first'
  const useNativeInteractionProtocol = Boolean(
    settings.actionProtocolEnabled &&
    compatibilityMode === 'phone-enhanced' &&
    !communityUiContract?.active
  )
  const allowNativeMessageReshaping = compatibilityMode === 'phone-enhanced' && !communityUiContract?.active

  const reasons = [
    origin === 'community' ? '角色来自社区角色卡/兼容格式' : '角色由小手机原生创建',
    requested === 'auto'
      ? '自动模式保持 AI / 原卡原样输出，不启用小手机内容整形'
      : `用户指定${compatibilityMode === 'card-first' ? '原卡优先' : '小手机增强'}策略`,
    communityUiContract?.active ? '检测到原卡固定输出协议，强制原卡优先' : ''
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
