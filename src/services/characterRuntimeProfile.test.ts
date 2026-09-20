import { describe, expect, it } from 'vitest'
import { resolveCharacterRuntimeProfile } from './characterRuntimeProfile'
import { createDefaultChatSettings } from './chatSettings'
import type { Character } from '../types/domain'

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char', worldId: 'world', name: '角色', avatar: '', persona: '', relationship: '', mood: '', activity: '',
    groups: [], replySpeed: 'natural', createdAt: '', ...overrides
  }
}

describe('character runtime compatibility policy', () => {
  it('uses card-first automatically for imported community cards', () => {
    const profile = resolveCharacterRuntimeProfile({
      character: character({ importFormat: 'community-json', sourceSpec: 'custom_card' }),
      settings: createDefaultChatSettings('conv')
    })
    expect(profile.origin).toBe('community')
    expect(profile.compatibilityMode).toBe('card-first')
    expect(profile.useNativeInteractionProtocol).toBe(false)
    expect(profile.allowNativeMessageReshaping).toBe(false)
  })

  it('keeps native characters raw by default too; phone enhancement must be explicit', () => {
    const profile = resolveCharacterRuntimeProfile({
      character: character({ importFormat: 'native' }),
      settings: createDefaultChatSettings('conv')
    })
    expect(profile.origin).toBe('native')
    expect(profile.compatibilityMode).toBe('card-first')
    expect(profile.useNativeInteractionProtocol).toBe(false)
    expect(profile.allowNativeMessageReshaping).toBe(false)
  })


  it('treats a non-default presentation choice in auto mode as an explicit display opt-in', () => {
    const settings = createDefaultChatSettings('conv')
    settings.conversationPresentationMode = 'phone-text'
    const profile = resolveCharacterRuntimeProfile({
      character: character({ importFormat: 'native' }),
      settings
    })
    expect(profile.compatibilityMode).toBe('phone-enhanced')
    expect(profile.useNativeInteractionProtocol).toBe(true)
    expect(profile.allowNativeMessageReshaping).toBe(true)
  })

  it('keeps card-first generation choice but still allows an explicit phone presentation projection', () => {
    const settings = createDefaultChatSettings('conv')
    settings.compatibilityMode = 'card-first'
    settings.conversationPresentationMode = 'phone-split'
    const profile = resolveCharacterRuntimeProfile({
      character: character({ importFormat: 'native' }),
      settings
    })
    expect(profile.compatibilityMode).toBe('card-first')
    expect(profile.useNativeInteractionProtocol).toBe(true)
    expect(profile.allowNativeMessageReshaping).toBe(true)
  })

  it('keeps phone enhancement as an explicit opt-in for community cards', () => {
    const settings = createDefaultChatSettings('conv')
    settings.compatibilityMode = 'phone-enhanced'
    const profile = resolveCharacterRuntimeProfile({
      character: character({ importFormat: 'sillytavern-v3' }),
      settings
    })
    expect(profile.compatibilityMode).toBe('phone-enhanced')
    expect(profile.useNativeInteractionProtocol).toBe(true)
  })


  it('phone presentation does not let an active resource UI insert its shell into the chat flow', () => {
    const settings = createDefaultChatSettings('conv')
    settings.compatibilityMode = 'phone-enhanced'
    settings.conversationPresentationMode = 'phone-text'
    const profile = resolveCharacterRuntimeProfile({
      character: character({ importFormat: 'community-json' }),
      settings,
      resourceUiActive: true
    })
    expect(profile.preserveCardOutput).toBe(false)
    expect(profile.useNativeInteractionProtocol).toBe(true)
    expect(profile.allowNativeMessageReshaping).toBe(true)
  })
  it('phone presentation hides a fixed UI shell while keeping card semantics available to generation', () => {
    const settings = createDefaultChatSettings('conv')
    settings.compatibilityMode = 'phone-enhanced'
    settings.conversationPresentationMode = 'phone-text'
    const profile = resolveCharacterRuntimeProfile({
      character: character({ importFormat: 'community-json' }),
      settings,
      communityUiContract: {
        active: true, mode: 'structured-contract', reasons: [], requiredTagNames: ['state'], requiredHtmlTags: [],
        requiredUiLabels: [], requiredRegexNames: [], requiredLiteralTokens: []
      }
    })
    expect(profile.preserveCardOutput).toBe(false)
    expect(profile.useNativeInteractionProtocol).toBe(true)
    expect(profile.allowNativeMessageReshaping).toBe(true)
  })
})
