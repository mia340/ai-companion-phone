import type {
  Character,
  CharacterExampleDialogue,
  ChatSettings
} from '../types/domain'

function compact(value?: string) {
  return value?.trim() || ''
}

function listLine(label: string, values?: string[]) {
  const list = values?.map(item => item.trim()).filter(Boolean) || []
  return list.length ? `${label}：${list.join('、')}` : ''
}

export function normalizeCharacterCard(character: Character): Character {
  return {
    ...character,
    cardVersion: 2,
    initiative: character.initiative ?? 'natural',
    narrationStyle: character.narrationStyle ?? 'light',
    emojiFrequency: character.emojiFrequency ?? 'low',
    questionFrequency: character.questionFrequency ?? 'natural',
    alternateGreetings: character.alternateGreetings ?? [],
    exampleDialogues: character.exampleDialogues ?? [],
    tags: character.tags ?? []
  }
}

export function buildCharacterCardPrompt(
  source: Character,
  settings: ChatSettings
): string {
  const character = normalizeCharacterCard(source)
  const modeRule = settings.roleplayMode === 'deep'
    ? '深度角色扮演：严格维持角色身份、世界观与场景连续性。允许自然的动作、环境和心理表现，但绝不替用户行动。'
    : settings.roleplayMode === 'immersive'
      ? '沉浸剧情：保持剧情连续，可适度描写角色动作和环境，语言仍像真实交流。'
      : '日常陪伴：以手机聊天为主，少写动作和环境，优先自然接话、情绪回应和关系感。'

  const narrationRule = character.narrationStyle === 'immersive'
    ? '允许使用适量动作与环境描写，动作只描写角色自身。'
    : character.narrationStyle === 'light'
      ? '只有在有助于氛围时才用一句简短动作描写。'
      : '不要使用动作、旁白或舞台说明，只发送角色会说出口的话。'

  const initiativeRule = character.initiative === 'high'
    ? '角色具有较强主动性：会分享自己的想法、推动话题或剧情，但不强迫用户继续。'
    : character.initiative === 'low'
      ? '角色较少主动推进，主要真诚回应用户，不要突然制造新事件。'
      : '角色主动性自然：有时接话，有时分享，有时安静陪伴，不形成固定套路。'

  const emojiRule = character.emojiFrequency === 'none'
    ? '不使用 emoji。'
    : character.emojiFrequency === 'high'
      ? '可以较常使用符合角色习惯的 emoji，但不要每句机械添加。'
      : character.emojiFrequency === 'natural'
        ? '偶尔自然使用 emoji，只在符合角色和情绪时出现。'
        : '极少使用 emoji。'

  const questionRule = character.questionFrequency === 'low'
    ? '很少用问题结尾；多数时候直接回应、表达态度或分享感受。'
    : character.questionFrequency === 'high'
      ? '可以主动追问，但问题必须贴合上下文，不能像问卷或客服选项。'
      : '问题频率自然，不要连续多轮都用问题结尾。'

  return [
    '【角色卡 V2】',
    `角色名：${character.name}`,
    compact(character.nickname) ? `角色昵称：${character.nickname}` : '',
    compact(character.identity) ? `身份：${character.identity}` : '',
    compact(character.age?.toString()) ? `年龄：${character.age}` : '',
    compact(character.appearance) ? `外貌：${character.appearance}` : '',
    `核心人格：${character.persona}`,
    compact(character.speakingStyle) ? `语言风格：${character.speakingStyle}` : '',
    compact(character.background) ? `背景经历：${character.background}` : '',
    compact(character.values) ? `价值观：${character.values}` : '',
    compact(character.habits) ? `习惯与小动作：${character.habits}` : '',
    compact(character.weaknesses) ? `弱点与不擅长：${character.weaknesses}` : '',
    compact(character.secrets) ? `不会轻易说出的秘密：${character.secrets}` : '',
    compact(character.boundaries) ? `角色边界：${character.boundaries}` : '',
    listLine('喜欢', character.likes),
    listLine('不喜欢', character.dislikes),
    `与用户的基础关系：${character.relationship}`,
    `当前心情：${character.mood}`,
    `当前活动：${character.activity}`,
    compact(character.scenario) ? `当前场景：${character.scenario}` : '',
    character.talkativeness != null ? `角色卡 talkativeness：${character.talkativeness}（用于主动程度与远程消息节奏）` : '',
    compact(character.worldBookHint) ? `角色卡关联世界书提示：${character.worldBookHint}` : '',
    modeRule,
    narrationRule,
    initiativeRule,
    emojiRule,
    questionRule,
    compact(character.systemPrompt) ? `角色专属补充规则：${character.systemPrompt}` : '',
    compact(character.creatorNotes) ? `创作者备注：${character.creatorNotes}` : ''
  ].filter(Boolean).join('\n')
}

export function buildExampleDialoguePrompt(
  examples?: CharacterExampleDialogue[]
): string {
  const rows = (examples || [])
    .filter(item => item.user.trim() && item.assistant.trim())
    .slice(0, 8)

  if (!rows.length) return ''

  return [
    '【示例对话：学习语气，不要照抄内容】',
    ...rows.flatMap((item, index) => [
      `示例 ${index + 1} · 用户：${item.user.trim()}`,
      `示例 ${index + 1} · 角色：${item.assistant.trim()}`
    ])
  ].join('\n')
}

export function parseExampleDialogues(value: string): CharacterExampleDialogue[] {
  const normalized = value.trim()
  if (!normalized) return []

  const blocks = normalized
    .split(/\n\s*---+\s*\n|\n{3,}/)
    .map(item => item.trim())
    .filter(Boolean)

  return blocks.map(block => {
    const userMatch = block.match(/(?:用户|user|你)\s*[：:]\s*([\s\S]*?)(?=\n(?:角色|assistant|AI|人物)\s*[：:]|$)/i)
    const assistantMatch = block.match(/(?:角色|assistant|AI|人物)\s*[：:]\s*([\s\S]*)$/i)
    const lines = block.split('\n').map(item => item.trim()).filter(Boolean)
    return {
      id: crypto.randomUUID(),
      user: userMatch?.[1]?.trim() || lines[0] || '',
      assistant: assistantMatch?.[1]?.trim() || lines.slice(1).join('\n') || ''
    }
  }).filter(item => item.user && item.assistant)
}

export function serializeExampleDialogues(examples?: CharacterExampleDialogue[]): string {
  return (examples || [])
    .map(item => `用户：${item.user}\n角色：${item.assistant}`)
    .join('\n\n---\n\n')
}
