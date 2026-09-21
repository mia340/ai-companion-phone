import type { ChatRequest, ChatResponse } from '../../services/ai/provider'
import { isTokenLimitError } from '../../services/ai/provider'
import {
  buildCommunityUiRepairPrompt,
  buildCommunityUiStateRepairPrompt,
  communityUiOutputConforms,
  enforceUserMessageOwnershipInRichHtml,
  mergeCommunityUiStateRepair,
  sanitizeCommunityUiText,
  tryCarryForwardCommunityUiState,
  tryRepairCommunityUiLocally,
  type CommunityUiContract
} from '../../services/communityUiRuntime'
import { looksLikeRichHtml, normalizeRichHtml } from '../../services/regexRuntime'
import type { RegexPipelineView } from '../../services/regexPipelineService'
import { buildConversationStatePrompt } from '../../services/stateHistoryService'
import { renderRoleplayText } from '../../services/textMacroService'
import type { Character, ConversationState, Message, UserPersona } from '../../types/domain'
import type { ModelSettings } from '../../types/modelSettings'

export type CommunityUiCompiledCandidate = RegexPipelineView

export interface CommunityUiRepairLorebookEntry {
  content: string
  activationReason: string
}

export interface CommunityUiRepairOptions {
  contract: CommunityUiContract
  initialResponseText: string
  initialCandidate: CommunityUiCompiledCandidate
  compileCandidate(text: string): CommunityUiCompiledCandidate
  presentationHidesCommunityUi: boolean
  persona: Pick<UserPersona, 'name' | 'description' | 'identity'>
  macroCharacterName: string
  character: Character
  previousMessages: Array<Pick<Message, 'senderId' | 'recalledAt' | 'rawContent' | 'content'>>
  activatedLorebook: CommunityUiRepairLorebookEntry[]
  applyWorldRegex(text: string): string
  conversationState?: ConversationState
  latestUserText: string
  modelSettings: Pick<ModelSettings, 'model' | 'temperature'>
  signal: AbortSignal
  providerChat(request: ChatRequest): Promise<ChatResponse>
  createGeneralRepairRequest(): ChatRequest
  collectTokenUsage(response: ChatResponse): void
}

export interface CommunityUiRepairResult {
  canonicalText: string
  candidate: CommunityUiCompiledCandidate
  richReplyHtml: string
  communityUiText: string
  warnings: string[]
  noticeMessage?: string
  conforms: boolean
  fallbackToInitial: boolean
}

export interface CommunityUiRepairDependencies {
  outputConforms: typeof communityUiOutputConforms
  carryForward: typeof tryCarryForwardCommunityUiState
  localRepair: typeof tryRepairCommunityUiLocally
  mergeStateRepair: typeof mergeCommunityUiStateRepair
  buildStateRepairPrompt: typeof buildCommunityUiStateRepairPrompt
  buildRepairPrompt: typeof buildCommunityUiRepairPrompt
  normalizeRichHtml: typeof normalizeRichHtml
  sanitizeCommunityUiText: typeof sanitizeCommunityUiText
  looksLikeRichHtml: typeof looksLikeRichHtml
  renderRoleplayText: typeof renderRoleplayText
  enforceUserMessageOwnership: typeof enforceUserMessageOwnershipInRichHtml
  isTokenLimitError: typeof isTokenLimitError
}

const defaultDependencies: CommunityUiRepairDependencies = {
  outputConforms: communityUiOutputConforms,
  carryForward: tryCarryForwardCommunityUiState,
  localRepair: tryRepairCommunityUiLocally,
  mergeStateRepair: mergeCommunityUiStateRepair,
  buildStateRepairPrompt: buildCommunityUiStateRepairPrompt,
  buildRepairPrompt: buildCommunityUiRepairPrompt,
  normalizeRichHtml,
  sanitizeCommunityUiText,
  looksLikeRichHtml,
  renderRoleplayText,
  enforceUserMessageOwnership: enforceUserMessageOwnershipInRichHtml,
  isTokenLimitError
}

function isAbortError(error: unknown) {
  return (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError')
}

export function createCommunityUiRepairRuntime(
  overrides: Partial<CommunityUiRepairDependencies> = {}
) {
  const dependencies: CommunityUiRepairDependencies = {
    ...defaultDependencies,
    ...overrides
  }

  async function repair(options: CommunityUiRepairOptions): Promise<CommunityUiRepairResult> {
    const warnings: string[] = []
    let noticeMessage: string | undefined
    let candidate = options.initialCandidate
    let canonicalText = candidate.canonicalText
    let validationRaw = canonicalText

    const projectCandidate = (value: CommunityUiCompiledCandidate) => {
      const richReplyHtml = !options.presentationHidesCommunityUi
        && (value.rich || dependencies.looksLikeRichHtml(value.displayText))
        ? (dependencies.renderRoleplayText(
            dependencies.normalizeRichHtml(value.displayText),
            options.persona.name,
            options.macroCharacterName
          ) || '')
        : ''
      const communityUiText = !options.presentationHidesCommunityUi
        && options.contract.active
        && !richReplyHtml
        ? (dependencies.renderRoleplayText(
            dependencies.sanitizeCommunityUiText(value.displayText),
            options.persona.name,
            options.macroCharacterName
          ) || '')
        : ''
      return { richReplyHtml, communityUiText }
    }

    let { richReplyHtml, communityUiText } = projectCandidate(candidate)

    const appliedRegex = () => [...candidate.storageApplied, ...candidate.displayApplied]
    const conforms = () => dependencies.outputConforms({
      contract: options.contract,
      rawText: validationRaw,
      renderedText: richReplyHtml || communityUiText || candidate.displayText,
      appliedRegex: appliedRegex()
    })
    const refreshFromCanonical = (text: string) => {
      canonicalText = text
      candidate = options.compileCandidate(text)
      ;({ richReplyHtml, communityUiText } = projectCandidate(candidate))
      validationRaw = text
    }

    if (options.contract.active && !conforms() && !options.signal.aborted) {
      const previousCommunityRawOutputs = [...options.previousMessages]
        .filter(item => item.senderId !== 'user' && !item.recalledAt)
        .reverse()
        .map(item => item.rawContent || item.content)
        .filter((item): item is string => Boolean(item?.trim()))
        .slice(0, 8)

      const carriedState = dependencies.carryForward(
        options.contract,
        canonicalText,
        previousCommunityRawOutputs
      )
      if (carriedState.repaired) {
        const carriedCandidate = options.compileCandidate(carriedState.text)
        const carriedProjection = projectCandidate(carriedCandidate)
        const carriedConforms = dependencies.outputConforms({
          contract: options.contract,
          rawText: carriedState.text,
          renderedText: carriedProjection.richReplyHtml || carriedProjection.communityUiText || carriedCandidate.displayText,
          appliedRegex: [...carriedCandidate.storageApplied, ...carriedCandidate.displayApplied]
        })
        if (carriedConforms) {
          refreshFromCanonical(carriedState.text)
          warnings.push(carriedState.reason)
        }
      }

      if (!conforms()) {
        const localRepair = dependencies.localRepair(options.contract, canonicalText)
        if (localRepair.repaired) {
          validationRaw = localRepair.text
          richReplyHtml = dependencies.renderRoleplayText(
            dependencies.normalizeRichHtml(localRepair.text),
            options.persona.name,
            options.macroCharacterName
          ) || ''
          communityUiText = ''
          warnings.push(localRepair.reason)
        } else if (options.contract.mode === 'regex-html' && options.contract.requiredTagNames.length) {
          const tagNeedles = options.contract.requiredTagNames.map(name => name.toLocaleLowerCase())
          const relevantAuthorRules = options.activatedLorebook
            .map(entry => ({
              content: options.applyWorldRegex(entry.content || ''),
              score: tagNeedles.reduce(
                (count, tag) => count + ((entry.content || '').toLocaleLowerCase().includes(tag) ? 1 : 0),
                0
              ) + (entry.activationReason.includes('作者每轮') ? 8 : 0)
            }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.content)
            .join('\n\n')
            .slice(0, 6000)
          const roleContext = [
            options.character.cardDescription || options.character.persona || options.character.identity || '',
            options.character.cardPersonality || '',
            options.character.relationship ? `与用户关系：${options.character.relationship}` : '',
            options.persona.description || options.persona.identity
              ? `用户 Persona：${options.persona.description || options.persona.identity}`
              : ''
          ].filter(Boolean).join('\n\n').slice(0, 4000)
          const compactRepairPrompt = dependencies.buildStateRepairPrompt({
            contract: options.contract,
            currentOutput: canonicalText,
            authorRules: relevantAuthorRules,
            roleContext,
            conversationState: buildConversationStatePrompt(options.conversationState),
            latestUserText: options.latestUserText
          })
          const request: ChatRequest = {
            model: options.modelSettings.model,
            temperature: Math.min(options.modelSettings.temperature ?? 0.8, 0.25),
            signal: options.signal,
            messages: [{ role: 'system', content: compactRepairPrompt }]
          }
          try {
            const repairResponse = await options.providerChat(request)
            options.collectTokenUsage(repairResponse)
            const mergedRepair = dependencies.mergeStateRepair(options.contract, canonicalText, repairResponse.text)
            if (mergedRepair.repaired) {
              const repairedCandidate = options.compileCandidate(mergedRepair.text)
              const repairedProjection = projectCandidate(repairedCandidate)
              const repairedConforms = dependencies.outputConforms({
                contract: options.contract,
                rawText: mergedRepair.text,
                renderedText: repairedProjection.richReplyHtml || repairedProjection.communityUiText || repairedCandidate.displayText,
                appliedRegex: [...repairedCandidate.storageApplied, ...repairedCandidate.displayApplied]
              })
              if (repairedConforms) {
                refreshFromCanonical(mergedRepair.text)
                warnings.push(`Community UI 紧凑状态补全：第二次 AI 仅补 ${mergedRepair.addedTags.length} 个作者状态字段，第一版正文未重写。`)
              }
            }
          } catch (error) {
            if (isAbortError(error)) throw error
            if (dependencies.isTokenLimitError(error)) {
              warnings.push('社区 UI 状态补全因 Token / 上下文 / 额度限制未完成；第一版真实 AI 回复已保留。')
              noticeMessage = 'AI 已完成第一版回复，但社区 UI 状态补全未完成；正文已保留，未使用本地补写。'
            } else {
              warnings.push(error instanceof Error ? `社区 UI 状态补全失败：${error.message}` : '社区 UI 状态补全失败。')
            }
          }
        } else {
          const request = options.createGeneralRepairRequest()
          request.temperature = Math.min(request.temperature ?? 0.8, 0.35)
          request.messages = [
            ...request.messages,
            { role: 'system', content: dependencies.buildRepairPrompt(options.contract, options.initialResponseText) }
          ]
          try {
            const repairResponse = await options.providerChat(request)
            options.collectTokenUsage(repairResponse)
            const repairedAfterAi = dependencies.localRepair(options.contract, repairResponse.text)
            if (repairedAfterAi.repaired) {
              validationRaw = repairedAfterAi.text
              richReplyHtml = dependencies.renderRoleplayText(
                dependencies.normalizeRichHtml(repairedAfterAi.text),
                options.persona.name,
                options.macroCharacterName
              ) || ''
              communityUiText = ''
              warnings.push(repairedAfterAi.reason.replace(
                '未追加第二次 AI 调用',
                '使用一次 AI 内容纠偏后由本地编译完成'
              ))
            }
          } catch (error) {
            if (isAbortError(error)) throw error
            if (dependencies.isTokenLimitError(error)) {
              warnings.push('社区 UI 自动纠偏因 Token / 上下文 / 额度限制未完成；第一版真实 AI 回复已保留。')
            } else {
              warnings.push(error instanceof Error ? `社区 UI 自动纠偏失败：${error.message}` : '社区 UI 自动纠偏失败。')
            }
          }
        }
      }
    }

    let fallbackToInitial = false
    if (options.contract.active && !conforms()) {
      fallbackToInitial = true
      candidate = options.initialCandidate
      canonicalText = options.initialCandidate.canonicalText
      validationRaw = canonicalText
      ;({ richReplyHtml, communityUiText } = projectCandidate(candidate))
      warnings.push('社区 UI 未完全匹配原卡格式：已保留第一版真实 AI 回复，未因 UI/Regex 失败丢弃正文。')
    }

    if (richReplyHtml) {
      const realUserMessages = options.previousMessages
        .filter(item => item.senderId === 'user' && !item.recalledAt)
        .slice(-24)
        .map(item => item.content)
      richReplyHtml = dependencies.enforceUserMessageOwnership(richReplyHtml, realUserMessages)
    }

    return {
      canonicalText,
      candidate,
      richReplyHtml,
      communityUiText,
      warnings,
      noticeMessage,
      conforms: !options.contract.active || conforms(),
      fallbackToInitial
    }
  }

  return { repair }
}
