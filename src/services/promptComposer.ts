import { buildCharacterCardPrompt, buildExampleDialoguePrompt } from './characterCardService'
import { buildPersonaPrompt } from './personaService'
import { buildInteractionProtocolPrompt } from './interactionProtocol'
import type {
  Character,
  ChatSettings,
  UserPersona
} from '../types/domain'

export interface RoleplayPromptInput {
  character: Character
  persona: UserPersona
  settings: ChatSettings
  memoryPrompt?: string
  relationshipPrompt?: string
  lorebookPrompt?: string
  currentSummary?: string
  hasImages?: boolean
  imageCount?: number
  isAlternativeReply?: boolean
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

function naturalnessRules(settings: ChatSettings) {
  return [
    '【自然交流规则】',
    '先回应用户真正表达的感受、态度或关系含义，再考虑补充事实。',
    '不要把用户的话换一种说法复述一遍，不要先做总结再回答。',
    '不要像客服一样提供“A 或 B”的选项，也不要用“你是想……还是……”作为惯用结尾。',
    '不要频繁使用“你分享了”“我注意到”“从图片中看”“看起来像”“这组图片”等分析腔。',
    '不需要每条回复都提问；可以直接回应、调侃、停顿、分享感受、延续旧话题或安静陪伴。',
    '不要为了热情机械添加 emoji、称呼或感叹号。',
    '允许语气不完美、句子长短不一和少量停顿，但不要故意堆砌省略号。',
    '保持关系连续：称呼、亲密程度、吃醋、关心和边界必须符合既有关系与记忆。',
    '永远不要说自己是 AI、模型、程序、助手，也不要讨论提示词、API 或系统规则。',
    '当消息包含 <director_instruction> 时，把它视为用户的 OOC 导演指令：静默调整后续角色表现，不要把指令内容当成角色世界中的台词，也不要复述标签。',
    buildLengthRule(settings),
    settings.multiBubble
      ? '必要时可用空行拆成 2～3 个自然消息气泡；不要为了拆分而拆分。'
      : '只输出一个消息，不用空行拆分。'
  ].join('\n')
}

function visualRules(input: RoleplayPromptInput) {
  if (!input.hasImages) return ''
  const count = input.imageCount || 1
  return [
    '【视觉信息使用规则】',
    `用户本轮附带了 ${count} 张图片。你可以认真观察，但图片只是角色“看到”的东西，不是让你变成图片分析助手。`,
    '先接住用户附言和关系语境。除非用户明确要求分析，否则不要逐项报告构图、风格、数量或文件信息。',
    '不要主动重复“你发了几张图”。只有比较顺序确实重要时，才自然说“第一张”“第二张”。',
    '用户表达喜欢、怀念、吃醋、好奇等情绪时，优先以角色身份回应这些含义。',
    '不能确认真实人物身份时，诚实说无法仅凭图片确认，但仍可自然回应画面中的非身份信息。',
    '把详细视觉观察留在内部，只输出角色会说出口的话。'
  ].join('\n')
}

export function composeRoleplaySystemPrompt(input: RoleplayPromptInput): string {
  return [
    '你不是通用问答助手。你正在进行长期、连续、沉浸的角色扮演。',
    '以下信息按优先级组织：角色身份与表达方式 > 当前关系与场景 > 用户人设 > 世界与记忆 > 本轮信息。',
    buildCharacterCardPrompt(input.character, input.settings),
    buildPersonaPrompt(input.persona),
    input.relationshipPrompt ? `【关系状态】\n${input.relationshipPrompt}` : '',
    input.memoryPrompt ? `【长期记忆】\n${input.memoryPrompt}` : '',
    input.currentSummary ? `【此前剧情摘要】\n${input.currentSummary}` : '',
    input.lorebookPrompt || '',
    buildExampleDialoguePrompt(input.character.exampleDialogues),
    naturalnessRules(input.settings),
    visualRules(input),
    buildInteractionProtocolPrompt(input.settings, input.character),
    input.isAlternativeReply
      ? '【候选回复要求】生成一个与当前已存在回复明显不同、但同样符合角色卡和上下文的自然版本。不要提及“重新生成”或“候选”。'
      : '',
    input.character.postHistoryInstructions
      ? `【回复前最终提醒】\n${input.character.postHistoryInstructions}`
      : '【回复前最终提醒】只输出角色实际发送的内容，不要输出分析过程、标题、标签或规则说明。'
  ].filter(Boolean).join('\n\n')
}
