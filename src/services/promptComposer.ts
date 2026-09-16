import { buildCharacterCardPrompt, buildExampleDialoguePrompt } from './characterCardService'
import { buildPersonaPrompt } from './personaService'
import { buildInteractionProtocolPrompt } from './interactionProtocol'
import { resolveCharacterRuntimeProfile } from './characterRuntimeProfile'
import { characterMacroName, detectCharacterCardFamily, isImportedCommunityCharacter, resolveCharacterPostHistoryInstructions, resolveCharacterSystemPrompt } from './characterCardCompatibility'
import { renderCharacterCardPromptText } from './textMacroService'
import type { CommunityUiContract } from './communityUiRuntime'
import type {
  Character,
  ChatSettings,
  ConversationState,
  UserPersona
} from '../types/domain'

export interface RoleplayPromptInput {
  character: Character
  persona: UserPersona
  settings: ChatSettings
  memoryPrompt?: string
  /** Legacy combined lorebook prompt; retained for older callers. */
  lorebookPrompt?: string
  lorebookBeforeCharacterPrompt?: string
  lorebookAfterCharacterPrompt?: string
  lorebookAuthorNoteTopPrompt?: string
  lorebookAuthorNoteBottomPrompt?: string
  lorebookBeforeExamplesPrompt?: string
  lorebookAfterExamplesPrompt?: string
  currentSummary?: string
  statePrompt?: string
  conversationState?: ConversationState
  memoryWriteNotice?: string
  hasImages?: boolean
  imageCount?: number
  isAlternativeReply?: boolean
  deviceTimeContext?: string
  communityUiContract?: CommunityUiContract
  sceneTransitionPrompt?: string
  openingMode?: 'pending' | 'free' | 'greeting'
}

function buildLengthRule(settings: ChatSettings) {
  if (settings.replyLength === 'short') {
    return '回复通常一到三句话；能一句自然说完就不要扩写。'
  }
  if (settings.replyLength === 'long') {
    return '可以回复得更完整，但仍是角色在聊天，不要写成分析报告或说明文。'
  }
  return '长度随情绪与内容自然变化，避免每次都保持相同篇幅。'
}

export function resolvePromptUserMacroName(persona: Pick<UserPersona, 'name' | 'isDefault'>) {
  const name = persona.name?.trim() || ''
  // “我 / 用户 / User”等默认展示名是 UI 标签，不是角色世界里的专名。
  // 把这类名称直接替换进社区卡会生成“与我年龄差 / 我固定对应某人”之类的混乱语句。
  // 保留 {{user}} 占位符，让模型明确把它理解为当前用户，而不是把“我”误当成叙述者姓名。
  if (!name || /^(?:我|用户|user|默认(?:用户|人设|persona)?|未填写身份|匿名)$/iu.test(name)) return '{{user}}'
  return name
}

function narrationPersonContinuityRules() {
  return [
    '【叙事人称连续性】',
    '除非角色卡、世界书或 Prompt 预设明确写出“第三人称叙事/用她、他、TA指代{{user}}”等人称规则，否则当前用户在旁白、动作与场景叙事中固定使用第二人称“你”。',
    '人物资料为了介绍用户而写“她/他/TA/女生/女孩/男生/男人/这个人”等，只是资料描述，不构成第三人称叙事指令。<user_profile>、Persona、世界书人物档案中的第三人称同样如此。',
    '不要因为较早的 assistant 回复偶尔误用了第三人称就继续沿用；若原资源没有明确第三人称规则，从本轮恢复第二人称。',
    '角色对白可以按角色设定使用“你”、用户姓名、昵称或其它自然称呼；但同一轮叙事不要无理由在“你”和“她/他/女生/男生”等用户指代之间切换。',
    '这里的 {{user}} 始终表示当前用户，不是模型自己；如果 Persona 的界面名称恰好叫“我”，也不能把“我”当作角色世界中的用户专名。'
  ].join('\n')
}

function naturalnessRules(settings: ChatSettings, options: { structuredOutput: boolean; phoneEnhanced: boolean }) {
  const lines = [
    '【AI 生成边界】',
    '所有角色台词、动作、心理、情绪、关系感受和剧情推进都由你依据角色卡、社区资源与聊天上下文自行生成；应用不会提供可直接照抄的角色回复。',
    '不要把小手机界面本身当成角色世界中的手机、聊天软件或现代设备，除非角色卡/世界观/当前剧情明确存在这些东西。',
    '区分现实用户事实与角色卡里的 {{user}} 剧情设定；缺少依据的现实用户事实视为未知。',
    '默认在叙事中用第二人称“你”指代当前 Persona / {{user}}；具体的人称连续性以“叙事人称连续性”规则为准。',
    '不得替用户生成用户未实际发送过的新台词、消息、选择或动作；社区微信/短信/群聊/论坛/邮件等模板中的 user/{{user}}/自己/我方消息槽只能引用真实历史。',
    '当消息包含 <director_instruction> 时，把它视为用户的 OOC 导演指令并静默执行，不把标签内容当世界内台词。',
    options.structuredOutput
      ? '原卡存在固定输出协议：严格按原资源的结构输出，应用只负责解析和渲染。'
      : '原卡没有固定输出协议：保持角色卡自身的自然文本结构，不添加应用私有 UI、固定状态卡或预设台词。',
    options.phoneEnhanced && settings.replyLength !== 'natural' ? buildLengthRule(settings) : '',
    options.phoneEnhanced && settings.multiBubble
      ? '只有你根据角色与语境明确决定发送多条消息时才使用多个 text；不要由应用式规则按标点机械切分。'
      : ''
  ]
  return lines.filter(Boolean).join('\n')
}

function buildOpeningFormatContinuity(character: Character, structuredOutput: boolean, settings: ChatSettings, openingMode?: 'pending' | 'free' | 'greeting') {
  // 社区角色卡的 first_mes 本身已经作为真实 assistant 历史存在；不再从它额外发明永久格式规则。
  if (isImportedCommunityCharacter(character) || openingMode === 'free' || structuredOutput || settings.conversationPresentationMode !== 'scene-merged' || !character.firstMessage?.trim()) return ''
  const labels = Array.from(new Set(
    [...character.firstMessage.matchAll(/【\s*([^】：:∶﹕︰]{1,20})\s*[：:∶﹕︰]/gu)]
      .map(match => match[1].trim())
      .filter(Boolean)
  )).slice(0, 12)
  if (labels.length < 3) return ''
  return [
    '【原卡开场格式连续性】',
    `原卡开场已经使用一组固定前置信息字段：${labels.join('、')}。`,
    '若角色卡/世界书本轮没有明确切换到其它输出格式，请延续这些作者字段；具体值、措辞和剧情内容全部由你根据当前上下文自行生成，应用不提供或补写任何值。',
    '这是风格连续性提示，不是应用 UI；不要因此新增原卡没有出现的字段。'
  ].join('\n')
}

function buildOpeningModePrompt(input: RoleplayPromptInput) {
  if (input.openingMode !== 'free') return ''
  return [
    '【自由开局 · 当前会话事实】',
    '本会话明确没有采用角色卡 first_mes；不要把 first_mes 中的人物位置、动作、时间、关系进度或已经发生的事件当作当前历史。',
    '角色卡 scenario 仍可作为作者提供的背景/默认可能性，但不是不可覆盖的当前现场。当前场景优先以本会话真实用户消息、持续世界状态和用户本轮明确动作建立。',
    '如果用户第一条或后续消息明确建立了与 scenario 不同的地点/远程状态/时间，以用户本会话事实为准，同时继续忠实保持角色设定与世界观。'
  ].join('\n')
}

function visualRules(input: RoleplayPromptInput) {
  if (!input.hasImages) return ''
  const count = input.imageCount || 1
  return [
    '【用户附图】',
    `本轮用户提供了 ${count} 张图片，图片属于本轮输入的一部分。`,
    '如何观察、理解和回应完全依据角色卡、世界书、当前场景以及用户本轮要求；不要套用应用预设的图片回应话术。',
    '无法从图片确认的信息保持未知，不要把猜测说成事实。'
  ].join('\n')
}

export function composeRoleplaySystemPrompt(input: RoleplayPromptInput): string {
  const runtimeProfile = resolveCharacterRuntimeProfile({
    character: input.character,
    settings: input.settings,
    communityUiContract: input.communityUiContract
  })
  const structuredOutput = Boolean(input.communityUiContract?.active)
  const defaultRoleplaySystemPrompt = [
    '你正在进行长期、连续的角色扮演。优先忠实执行角色卡与已绑定社区资源，不自行补造原卡没有的设备、UI、关系或输出协议。',
    '以下信息按优先级组织：角色卡/原资源明确规则 > 当前关系与场景 > 当前 Persona > 世界与记忆 > 本轮信息。'
  ].join('\n')
  const resolvedSystemPrompt = resolveCharacterSystemPrompt(input.character, defaultRoleplaySystemPrompt)
  const defaultPostHistoryInstructions = structuredOutput
    ? '【回复前最终提醒】只输出角色互动内容，并严格保持原卡资源规定的输出结构。除非原资源明确规定第三人称 {{user}}，否则叙事中用“你”指代当前用户。不要输出分析过程或规则说明。'
    : runtimeProfile.useNativeInteractionProtocol
      ? '【回复前最终提醒】只输出角色互动内容；需要时可在末尾附小手机隐藏协议。除非原资源明确规定第三人称 {{user}}，否则叙事中用“你”指代当前用户。不要输出分析过程、标题或规则说明。'
      : '【回复前最终提醒】只输出符合原角色卡风格的角色互动内容。除非原资源明确规定第三人称 {{user}}，否则叙事中用“你”指代当前用户。不要添加原卡没有要求的 UI、标签、设备动作或小手机私有协议。'
  const resolvedPostHistory = resolveCharacterPostHistoryInstructions(input.character, defaultPostHistoryInstructions)

  const assembled = [
    resolvedSystemPrompt.text,
    input.lorebookBeforeCharacterPrompt || '',
    buildCharacterCardPrompt(input.character, input.settings, { phoneEnhanced: runtimeProfile.compatibilityMode === 'phone-enhanced' }),
    input.lorebookAfterCharacterPrompt || '',
    buildPersonaPrompt(input.persona),
    buildOpeningModePrompt(input),
    runtimeProfile.compatibilityMode === 'phone-enhanced' && input.deviceTimeContext ? `【当前设备时间】\n${input.deviceTimeContext}` : '',
    input.statePrompt ? `【持续世界状态】\n${input.statePrompt}` : '',
    input.sceneTransitionPrompt || '',
    input.memoryPrompt ? `【长期记忆】\n${input.memoryPrompt}` : '',
    input.memoryWriteNotice ? `【本轮记忆写入结果】\n${input.memoryWriteNotice}` : '',
    input.currentSummary ? `【此前剧情摘要】\n${input.currentSummary}` : '',
    // 旧调用方仍可提供 combined prompt；V2 调用方使用精确位置字段时不再重复注入。
    input.lorebookBeforeCharacterPrompt || input.lorebookAfterCharacterPrompt || input.lorebookBeforeExamplesPrompt || input.lorebookAfterExamplesPrompt || input.lorebookAuthorNoteTopPrompt || input.lorebookAuthorNoteBottomPrompt
      ? ''
      : input.lorebookPrompt || '',
    input.character.depthPrompt?.prompt?.trim()
      ? `【角色卡 Depth Prompt · depth ${input.character.depthPrompt.depth ?? 4} · ${input.character.depthPrompt.role || 'system'}】\n${input.character.depthPrompt.prompt.trim()}`
      : '',
    input.lorebookBeforeExamplesPrompt || '',
    buildExampleDialoguePrompt(input.character.exampleDialogues),
    input.lorebookAfterExamplesPrompt || '',
    input.lorebookAuthorNoteTopPrompt || '',
    buildOpeningFormatContinuity(input.character, structuredOutput, input.settings, input.openingMode),
    narrationPersonContinuityRules(),
    naturalnessRules(input.settings, { structuredOutput, phoneEnhanced: runtimeProfile.compatibilityMode === 'phone-enhanced' }),
    input.lorebookAuthorNoteBottomPrompt || '',
    visualRules(input),
    runtimeProfile.useNativeInteractionProtocol
      ? buildInteractionProtocolPrompt(input.settings, input.character, input.conversationState)
      : '',
    input.isAlternativeReply
      ? '【候选回复要求】生成一个与当前已存在回复明显不同、但同样符合角色卡和上下文的自然版本。不要提及“重新生成”或“候选”。'
      : '',
    resolvedPostHistory.text
  ].filter(Boolean).join('\n\n')

  return renderCharacterCardPromptText(
    assembled,
    resolvePromptUserMacroName(input.persona),
    characterMacroName(input.character),
    `${input.character.id}:${input.conversationState?.id || 'prompt'}`,
    { angleCharacterAliases: detectCharacterCardFamily(input.character) === 'v3' }
  ) || assembled
}
