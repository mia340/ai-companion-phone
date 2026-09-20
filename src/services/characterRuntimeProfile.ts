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
  // V0.4.4.6：生成兼容策略与“用户怎么看”继续解耦。
  // 场景合并才允许作者 UI 接管可见输出；纯手机 / 动作分离属于用户明确的显示投影，
  // 即使显式选择 card-first，也仍要按用户选择隐藏状态 UI / HTML 外壳。
  const presentationOverride = presentationMode !== 'scene-merged'
  const compatibilityMode = requested === 'auto' ? (presentationOverride ? 'phone-enhanced' : 'card-first') : requested
  const uiOwnsOutput = Boolean(!presentationOverride && (communityUiContract?.active || resourceUiActive))
  const preserveCardOutput = !presentationOverride && (uiOwnsOutput || compatibilityMode === 'card-first')
  const useNativeInteractionProtocol = Boolean(
    settings.actionProtocolEnabled &&
    (compatibilityMode === 'phone-enhanced' || presentationOverride) &&
    !uiOwnsOutput
  )
  const allowNativeMessageReshaping = presentationOverride || (compatibilityMode === 'phone-enhanced' && !uiOwnsOutput)

  const reasons = [
    origin === 'community' ? '角色来自社区角色卡/兼容格式' : '角色由小手机原生创建',
    requested === 'auto'
      ? (presentationOverride
          ? '用户选择了手机式呈现；生成仍遵循原卡语义，但可见输出按用户选择投影'
          : '自动模式使用默认场景合并，保持 AI / 原卡原样输出')
      : `用户指定${compatibilityMode === 'card-first' ? '原卡优先' : '小手机增强'}生成策略`,
    communityUiContract?.active && !presentationOverride ? '检测到原卡固定输出协议，场景合并模式由原卡 UI 接管' : '',
    communityUiContract?.active && presentationOverride ? '检测到原卡固定输出协议，但当前手机式呈现只保留允许的消息内容' : '',
    resourceUiActive && !presentationOverride ? '当前正在使用社区资源界面，场景合并模式由资源 UI 接管' : '',
    resourceUiActive && presentationOverride ? '当前存在社区资源会话，但手机式呈现不会把资源 UI 外壳插进普通聊天流' : ''
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
