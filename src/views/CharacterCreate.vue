<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { DEFAULT_WORLD_ID } from '../db/seed'
import { parseExampleDialogues, serializeExampleDialogues } from '../services/characterCardService'
import { parseCharacterCardFile, type ImportedCharacterCard } from '../services/characterCardImportService'
import { toPlainStorageValue } from '../services/storageSanitizer'
import { extractRoleCardUiHints, parseRoleCardUi, roleCardUiToConversationPatch } from '../services/roleCardUiService'
import { applyRegexScript, looksLikeRichHtml, normalizeCommunityPlainText, normalizeRichHtml } from '../services/regexRuntime'
import { createDefaultChatSettings } from '../services/chatSettings'
import { inferCardInitialActivity } from '../services/characterInitialStateService'
import { collectCharacterGreetings } from '../services/characterGreetingService'
import { ensureDefaultPersona } from '../services/personaService'
import type { Character, CommunityResourceArchive, RegexScript, UserPersona } from '../types/domain'

type CharacterGender = NonNullable<Character['gender']>

type ParsedField =
  | 'avatar'
  | 'name'
  | 'nickname'
  | 'gender'
  | 'age'
  | 'identity'
  | 'relationship'
  | 'persona'
  | 'speakingStyle'
  | 'background'
  | 'likes'
  | 'dislikes'

const router = useRouter()

// 基础身份
const avatarEmoji = ref('🍓')
const avatarImage = ref('')
const name = ref('')
const nickname = ref('')
const gender = ref<CharacterGender>('unspecified')
const age = ref('')
const identity = ref('')

// 人物设定
const relationship = ref('')
const persona = ref('')
const speakingStyle = ref('')
const background = ref('')
const likesText = ref('')
const dislikesText = ref('')
const scenario = ref('')
const firstMessage = ref('')
const exampleDialoguesText = ref('')

// 整段导入
const importText = ref('')
const parseMessage = ref('')

// JSON 角色卡导入：在创建前直接读取，不再需要先建立空角色。
const importedCard = shallowRef<ImportedCharacterCard>()
const importedCardFileName = ref('')
const importedCardRawText = ref('')
const cardImportMessage = ref('')
const isImportingCard = ref(false)
const createEmbeddedUserPersona = ref(true)
const embeddedPersonaName = ref('')

// 页面状态
const isSaving = ref(false)
const errorMessage = ref('')

// 可选性格模板
const personalityPresets = [
  {
    label: '温柔治愈',
    value: '温柔、细腻、善于倾听，会认真回应他人的情绪。'
  },
  {
    label: '慢热克制',
    value: '性格慢热、克制，不轻易表达感情，但会用行动关心别人。'
  },
  {
    label: '活泼黏人',
    value: '开朗活泼，分享欲很强，喜欢主动找用户聊天。'
  },
  {
    label: '清冷理性',
    value: '冷静理性，观察力强，情绪不外露，但内心很重感情。'
  },
  {
    label: '毒舌傲娇',
    value: '说话偶尔毒舌，嘴硬心软，不擅长直接表达关心。'
  },
  {
    label: '成熟可靠',
    value: '成熟稳重，有责任感，遇到问题时会先帮助用户分析和解决。'
  }
]

// 可选说话方式
const speakingStylePresets = [
  {
    label: '温柔自然',
    value: '语气温柔自然，句子长度适中，会关注用户的感受。'
  },
  {
    label: '简短克制',
    value: '回复简短克制，很少使用表情，不说没有意义的客套话。'
  },
  {
    label: '可爱活泼',
    value: '语气活泼可爱，喜欢使用颜文字和表情，会主动分享日常。'
  },
  {
    label: '幽默毒舌',
    value: '擅长冷幽默和轻微吐槽，但不会真正伤害用户。'
  },
  {
    label: '成熟稳重',
    value: '表达清晰沉稳，遇到严肃话题时会认真分析，不敷衍。'
  }
]

// 可选背景模板
const backgroundPresets = [
  {
    label: '花店店主',
    value: '经营一家安静的小花店，熟悉各种花的花期和寓意。'
  },
  {
    label: '大学同学',
    value: '和用户在大学里认识，彼此拥有许多共同经历。'
  },
  {
    label: '自由撰稿人',
    value: '是一名自由撰稿人，经常在书店和咖啡馆工作。'
  },
  {
    label: '邻家朋友',
    value: '从小和用户生活在同一个社区，对用户非常熟悉。'
  },
  {
    label: '独立音乐人',
    value: '是一名独立音乐人，经常记录生活中的声音和情绪。'
  },
  {
    label: '异世界旅人',
    value: '来自另一个世界，因为一场意外来到了用户所在的世界。'
  }
]

const fieldAliases: Record<string, ParsedField> = {
  头像: 'avatar',
  表情: 'avatar',

  姓名: 'name',
  名字: 'name',
  角色名: 'name',

  昵称: 'nickname',
  小名: 'nickname',

  性别: 'gender',
  年龄: 'age',

  身份: 'identity',
  职业: 'identity',
  角色身份: 'identity',

  关系: 'relationship',
  初始关系: 'relationship',
  与用户关系: 'relationship',

  性格: 'persona',
  人设: 'persona',
  核心人设: 'persona',
  人物性格: 'persona',
  性格特点: 'persona',

  说话方式: 'speakingStyle',
  说话风格: 'speakingStyle',
  语言风格: 'speakingStyle',
  口吻: 'speakingStyle',
  口癖: 'speakingStyle',

  背景: 'background',
  背景故事: 'background',
  人物背景: 'background',
  经历: 'background',

  喜欢: 'likes',
  喜好: 'likes',
  爱好: 'likes',

  不喜欢: 'dislikes',
  讨厌: 'dislikes',
  雷点: 'dislikes'
}

function normalizeLabel(value: string) {
  return value
    .replace(/\s/g, '')
    .toLowerCase()
}

function appendPreset(
  target: 'persona' | 'speakingStyle' | 'background',
  value: string
) {
  if (target === 'persona') {
    persona.value = appendText(persona.value, value)
  }

  if (target === 'speakingStyle') {
    speakingStyle.value = appendText(speakingStyle.value, value)
  }

  if (target === 'background') {
    background.value = appendText(background.value, value)
  }
}

function appendText(original: string, addition: string) {
  const trimmedOriginal = original.trim()

  if (!trimmedOriginal) {
    return addition
  }

  if (trimmedOriginal.includes(addition)) {
    return trimmedOriginal
  }

  return `${trimmedOriginal}\n${addition}`
}

function applyImportedCardToForm(imported: ImportedCharacterCard) {
  const patch = imported.patch
  if (patch.name?.trim()) name.value = patch.name.trim()
  if (patch.avatar?.trim()) {
    if (/^(?:data:image\/|blob:|https?:\/\/)/i.test(patch.avatar.trim())) {
      avatarImage.value = patch.avatar.trim()
    } else {
      avatarEmoji.value = patch.avatar.trim()
      avatarImage.value = ''
    }
  }
  if (patch.nickname?.trim()) nickname.value = patch.nickname.trim()
  if (patch.identity?.trim()) identity.value = patch.identity.trim()
  if (patch.persona?.trim()) persona.value = patch.persona.trim()
  if (patch.speakingStyle?.trim()) speakingStyle.value = patch.speakingStyle.trim()
  if (patch.background?.trim()) background.value = patch.background.trim()
  if (patch.relationship?.trim()) relationship.value = patch.relationship.trim()
  if (patch.scenario?.trim()) scenario.value = patch.scenario.trim()
  if (patch.firstMessage?.trim()) firstMessage.value = patch.firstMessage.trim()
  if (patch.exampleDialogues?.length) exampleDialoguesText.value = serializeExampleDialogues(patch.exampleDialogues)
  if (patch.likes?.length) likesText.value = patch.likes.join('、')
  if (patch.dislikes?.length) dislikesText.value = patch.dislikes.join('、')
  if (typeof patch.age === 'number') age.value = String(patch.age)
  if (patch.gender) gender.value = patch.gender
}

async function handleCharacterCardImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || isImportingCard.value) return

  errorMessage.value = ''
  parseMessage.value = ''
  cardImportMessage.value = ''
  isImportingCard.value = true

  try {
    const imported = await parseCharacterCardFile(file)
    importedCard.value = imported
    importedCardFileName.value = file.name
    importedCardRawText.value = imported.rawSourceJson || (file.name.toLowerCase().endsWith('.json') ? await file.text() : '')
    applyImportedCardToForm(imported)
    if (!imported.patch.relationship?.trim()) relationship.value = ''
    createEmbeddedUserPersona.value = Boolean(imported.embeddedUser)
    embeddedPersonaName.value = imported.embeddedUser?.patch.name || `${imported.patch.name || '角色'} · 原卡用户`
    cardImportMessage.value = [
      `已识别 ${imported.format}：${imported.patch.name || file.name}。`,
      `备用开场 ${imported.patch.alternateGreetings?.length || 0} 条，示例对话 ${imported.patch.exampleDialogues?.length || 0} 组，内嵌世界书 ${imported.lorebookEntries.length} 条，正则 ${imported.regexScripts.length} 条。`,
      ...imported.notes
    ].join(' ')
  } catch (error) {
    importedCard.value = undefined
    importedCardFileName.value = ''
    importedCardRawText.value = ''
    cardImportMessage.value = error instanceof Error ? error.message : '角色卡导入失败。'
  } finally {
    isImportingCard.value = false
  }
}

function clearImportedCardReference() {
  importedCard.value = undefined
  importedCardFileName.value = ''
  importedCardRawText.value = ''
  cardImportMessage.value = ''
  createEmbeddedUserPersona.value = true
  embeddedPersonaName.value = ''
}

function parseImportedCharacter() {
  errorMessage.value = ''
  parseMessage.value = ''

  const source = importText.value.trim()

  if (!source) {
    parseMessage.value = '请先粘贴人物设定内容。'
    return
  }

  const parsed: Record<ParsedField, string> = {
    avatar: '',
    name: '',
    nickname: '',
    gender: '',
    age: '',
    identity: '',
    relationship: '',
    persona: '',
    speakingStyle: '',
    background: '',
    likes: '',
    dislikes: ''
  }

  const lines = source
    .replace(/\r/g, '')
    .split('\n')

  let currentField: ParsedField | null = null
  let matchedFields = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) continue

    const fieldMatch = line.match(
      /^([^:：]{1,12})[:：]\s*(.*)$/
    )

    if (fieldMatch) {
      const label = normalizeLabel(fieldMatch[1])
      const matchedField = fieldAliases[label]

      if (matchedField) {
        currentField = matchedField
        parsed[matchedField] = fieldMatch[2].trim()
        matchedFields += 1
        continue
      }
    }

    if (currentField) {
      parsed[currentField] = appendText(
        parsed[currentField],
        line
      )
    }
  }

  // 没识别出标签时，将全文作为人物设定
  if (matchedFields === 0) {
    persona.value = source
    parseMessage.value =
      '没有识别到明确字段，已将整段内容放入“核心人设”。连接 AI 后会支持更智能的自由文本拆分。'
    return
  }

  if (parsed.avatar) {
    avatarEmoji.value = parsed.avatar
    avatarImage.value = ''
  }

  if (parsed.name) {
    name.value = parsed.name
  }

  if (parsed.nickname) {
    nickname.value = parsed.nickname
  }

  if (parsed.identity) {
    identity.value = parsed.identity
  }

  if (parsed.relationship) {
    relationship.value = parsed.relationship
  }

  if (parsed.persona) {
    persona.value = parsed.persona
  }

  if (parsed.speakingStyle) {
    speakingStyle.value = parsed.speakingStyle
  }

  if (parsed.background) {
    background.value = parsed.background
  }

  if (parsed.likes) {
    likesText.value = parsed.likes
  }

  if (parsed.dislikes) {
    dislikesText.value = parsed.dislikes
  }

  if (parsed.age) {
    const ageNumber = parsed.age.match(/\d+/)?.[0]

    if (ageNumber) {
      age.value = ageNumber
    }
  }

  if (parsed.gender) {
    const genderText = parsed.gender.trim()

    if (
      genderText.includes('女') &&
      !genderText.includes('非')
    ) {
      gender.value = 'female'
    } else if (
      genderText.includes('男') &&
      !genderText.includes('非')
    ) {
      gender.value = 'male'
    } else if (
      genderText.includes('非二元') ||
      genderText.includes('无性别')
    ) {
      gender.value = 'nonbinary'
    } else {
      gender.value = 'unspecified'
    }
  }

  parseMessage.value =
    `已识别并填入 ${matchedFields} 类人物信息。你可以继续修改后再创建。`
}

function parseList(value: string): string[] {
  return value
    .split(/[，,、；;\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}


async function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 320

        canvas.width = size
        canvas.height = size

        const context = canvas.getContext('2d')

        if (!context) {
          throw new Error('浏览器无法创建图片画布。')
        }

        // 从图片中心裁剪为正方形
        const cropSize = Math.min(
          image.naturalWidth,
          image.naturalHeight
        )

        const cropX =
          (image.naturalWidth - cropSize) / 2
        const cropY =
          (image.naturalHeight - cropSize) / 2

        context.drawImage(
          image,
          cropX,
          cropY,
          cropSize,
          cropSize,
          0,
          0,
          size,
          size
        )

        const result = canvas.toDataURL(
          'image/jpeg',
          0.85
        )

        URL.revokeObjectURL(objectUrl)
        resolve(result)
      } catch (error) {
        URL.revokeObjectURL(objectUrl)
        reject(error)
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片读取失败。'))
    }

    image.src = objectUrl
  })
}

async function handleAvatarUpload(event: Event) {
  errorMessage.value = ''

  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMessage.value = '请选择图片文件。'
    input.value = ''
    return
  }

  if (file.size > 8 * 1024 * 1024) {
    errorMessage.value = '头像图片不能超过 8MB。'
    input.value = ''
    return
  }

  try {
    avatarImage.value = await resizeAvatar(file)
  } catch (error) {
    console.error('头像处理失败：', error)
    errorMessage.value = '头像处理失败，请换一张图片重试。'
  } finally {
    input.value = ''
  }
}

function removePhotoAvatar() {
  avatarImage.value = ''
}

async function save() {
  if (isSaving.value) return

  errorMessage.value = ''
  parseMessage.value = ''

  const trimmedName = name.value.trim()

  if (!trimmedName) {
    errorMessage.value = '请填写角色姓名。'
    return
  }

  let parsedAge: number | undefined

  if (age.value.trim()) {
    const ageNumber = Number(age.value)

    if (
      !Number.isInteger(ageNumber) ||
      ageNumber < 0 ||
      ageNumber > 200
    ) {
      errorMessage.value =
        '年龄需要填写 0～200 之间的整数。'
      return
    }

    parsedAge = ageNumber
  }

  isSaving.value = true

  try {
    const now = new Date().toISOString()
    const characterId = crypto.randomUUID()
    const conversationId = crypto.randomUUID()
    // importedCard 可能来自 Vue 响应式状态。保存前强制转成纯 JSON 数据，
    // 避免 IndexedDB structured clone 遇到 Proxy 数组时抛出 DataCloneError。
    const importedSnapshot = importedCard.value
      ? toPlainStorageValue(importedCard.value)
      : undefined
    const importedPatch = importedSnapshot?.patch || {}
    const importedLorebook = importedSnapshot?.lorebookEntries || []
    const importedRegexScripts = importedSnapshot?.regexScripts || []
    const importedLorebookId = importedLorebook.length ? crypto.randomUUID() : undefined
    const embeddedUser = importedSnapshot?.embeddedUser
    const shouldCreateEmbeddedPersona = Boolean(createEmbeddedUserPersona.value && embeddedUser)
    const embeddedPersonaId = shouldCreateEmbeddedPersona ? crypto.randomUUID() : undefined
    // `{{user}}` 只是社区角色卡占位符。只有用户选择创建原卡专属 Persona 时才用原卡用户名；
    // 否则用当前全局默认 Persona，绝不把占位符或卡内剧情身份猜成真实用户姓名。
    const defaultPersona = shouldCreateEmbeddedPersona ? undefined : await ensureDefaultPersona()
    const openingUserName = shouldCreateEmbeddedPersona
      ? (embeddedUser?.patch.name?.trim() || defaultPersona?.name?.trim() || '你')
      : (defaultPersona?.name?.trim() || '你')
    const parsedExamples = parseExampleDialogues(exampleDialoguesText.value)
    const createdImportedResourceIds: string[] = []
    const importedRawText = importedCardRawText.value
    const openingMessage = firstMessage.value.trim() || importedPatch.firstMessage?.trim() || ''
    const greetingChoices = collectCharacterGreetings(openingMessage, importedPatch.alternateGreetings || [])
    const deferGreetingSelection = greetingChoices.length > 1
    const initialActivity = deferGreetingSelection ? '' : inferCardInitialActivity(openingMessage)

    await db.transaction(
      'rw',
      [
        db.characters,
        db.conversations,
        db.messages,
        db.lorebookEntries,
        db.lorebooks,
        db.regexScripts,
        db.resourceBindings,
        db.personas,
        db.chatSettings,
        db.conversationStates,
        db.communityResourceArchives
      ],
      async () => {
        await db.characters.add(toPlainStorageValue({
          id: characterId,
          worldId: DEFAULT_WORLD_ID,

          name: trimmedName,
          nickname:
            nickname.value.trim() || undefined,

          avatar:
            avatarImage.value ||
            avatarEmoji.value.trim() ||
            '🍓',

          gender: gender.value,
          age: parsedAge,
          identity:
            identity.value.trim() || undefined,

          persona:
            persona.value.trim() ||
            importedPatch.persona?.trim() ||
            '',
          cardDescription: importedPatch.cardDescription,
          cardPersonality: importedPatch.cardPersonality,

          speakingStyle:
            speakingStyle.value.trim() || importedPatch.speakingStyle || undefined,

          background:
            background.value.trim() || importedPatch.background || undefined,

          likes: parseList(likesText.value).length ? parseList(likesText.value) : (importedPatch.likes || []),
          dislikes: parseList(dislikesText.value).length ? parseList(dislikesText.value) : (importedPatch.dislikes || []),

          relationship: relationship.value,
          scenario: scenario.value.trim() || importedPatch.scenario || undefined,
          firstMessage: firstMessage.value.trim() || importedPatch.firstMessage || undefined,
          alternateGreetings: importedPatch.alternateGreetings || [],
          exampleDialogues: parsedExamples.length ? parsedExamples : (importedPatch.exampleDialogues || []),
          appearance: importedPatch.appearance,
          values: importedPatch.values,
          habits: importedPatch.habits,
          weaknesses: importedPatch.weaknesses,
          secrets: importedPatch.secrets,
          boundaries: importedPatch.boundaries,
          creatorNotes: importedPatch.creatorNotes,
          systemPrompt: importedPatch.systemPrompt,
          postHistoryInstructions: importedPatch.postHistoryInstructions,
          initiative: importedPatch.initiative,
          narrationStyle: importedPatch.narrationStyle,
          emojiFrequency: importedPatch.emojiFrequency,
          questionFrequency: importedPatch.questionFrequency,
          tags: importedPatch.tags || [],
          cardVersion: importedPatch.cardVersion,
          sourceSpec: importedPatch.sourceSpec,
          sourceSpecVersion: importedPatch.sourceSpecVersion,
          creator: importedPatch.creator,
          resourceVersion: importedPatch.resourceVersion,
          sourceUrl: importedPatch.sourceUrl,
          license: importedPatch.license,
          allowDerivative: importedPatch.allowDerivative,
          importFormat: importedPatch.importFormat || 'native',
          embeddedUserTemplate: embeddedUser?.rawTemplate || importedPatch.embeddedUserTemplate,
          embeddedUserPersonaId: embeddedPersonaId,
          talkativeness: importedPatch.talkativeness,
          depthPrompt: importedPatch.depthPrompt,
          worldBookHint: importedPatch.worldBookHint,
          rawCardExtensions: importedPatch.rawCardExtensions,
          groupOnlyGreetings: importedPatch.groupOnlyGreetings || [],
          mood: '',
          activity: initialActivity,

          groups: ['group-unassigned'],
          replySpeed: 'natural',

          createdAt: now,
          updatedAt: now
        }))

        await db.conversations.add({
          id: conversationId,
          worldId: DEFAULT_WORLD_ID,
          type: 'single',
          title: trimmedName,
          memberIds: [characterId],
          pinned: false,
          muted: false,
          unread: 0,
          updatedAt: now
        })

        if (shouldCreateEmbeddedPersona && embeddedUser && embeddedPersonaId) {
          const patch = embeddedUser.patch
          const embeddedPersona: UserPersona = {
            id: embeddedPersonaId,
            name: embeddedPersonaName.value.trim() || patch.name || `${trimmedName} · 原卡用户`,
            avatar: patch.avatar || '🧑',
            title: patch.title || `${trimmedName}角色卡自带 {{user}}`,
            description: patch.description,
            identity: patch.identity,
            age: patch.age,
            gender: patch.gender,
            birthday: patch.birthday,
            height: patch.height,
            occupation: patch.occupation,
            appearance: patch.appearance,
            personality: patch.personality,
            publicPersona: patch.publicPersona,
            privatePersona: patch.privatePersona,
            strengths: patch.strengths,
            weaknesses: patch.weaknesses,
            interests: patch.interests,
            habits: patch.habits,
            lifestyle: patch.lifestyle,
            background: patch.background,
            relationshipNote: patch.relationshipNote,
            characterKnowledge: patch.characterKnowledge,
            boundaries: patch.boundaries,
            tags: patch.tags || [],
            creator: patch.creator,
            sourceUrl: patch.sourceUrl,
            sourceFileName: importedCardFileName.value || undefined,
            importFormat: embeddedUser.format,
            extraFields: patch.extraFields,
            personaScope: 'character',
            boundCharacterId: characterId,
            boundCharacterName: trimmedName,
            sourceUserTemplate: embeddedUser.rawTemplate,
            isCardTemplate: true,
            isDefault: false,
            createdAt: now,
            updatedAt: now
          }
          await db.personas.add(toPlainStorageValue(embeddedPersona))
          await db.chatSettings.add(toPlainStorageValue({
            ...createDefaultChatSettings(conversationId),
            personaId: embeddedPersonaId,
            updatedAt: now
          }))
        }

        // 有多个开场时不要先写死 first_mes。首次进入聊天由用户选择分支，
        // 避免默认开场先进入上下文，之后再选择备用开场时两个剧情叠在一起。
        if (openingMessage && !deferGreetingSelection) {
          const openingMacroResolved = openingMessage
            .replace(/\{\{user\}\}/gi, openingUserName)
            .replace(/\{\{char\}\}/gi, trimmedName)
          const openingSource = normalizeCommunityPlainText(openingMacroResolved)
          // 社区角色卡开场保持作者原文；状态字段只作为旁路提示读取，不删除/重写原始结构。
          const parsedOpening = importedSnapshot
            ? { content: openingSource, ui: extractRoleCardUiHints(openingSource) }
            : parseRoleCardUi(openingSource)
          const openingUi = parsedOpening.ui || extractRoleCardUiHints(openingSource)
          const openingStatePatch = roleCardUiToConversationPatch(parsedOpening.content, openingUi)
          let renderedOpening = parsedOpening.content
          let openingRegexApplied = false
          for (const script of importedRegexScripts) {
            if (!script.enabled || script.promptOnly) continue
            if (script.placement.length && !script.placement.includes(2)) continue
            const nextOpening = applyRegexScript(renderedOpening, script as RegexScript, {
              char: trimmedName,
              user: openingUserName
            })
            if (nextOpening !== renderedOpening) openingRegexApplied = true
            renderedOpening = nextOpening
          }
          const openingIsRich = looksLikeRichHtml(renderedOpening)
          const openingHtml = openingIsRich ? normalizeRichHtml(renderedOpening) : undefined
          const openingPreview = openingIsRich
            ? renderedOpening.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280) || '角色卡 UI'
            : renderedOpening
          await db.messages.add(toPlainStorageValue({
            id: crypto.randomUUID(),
            worldId: DEFAULT_WORLD_ID,
            conversationId,
            senderId: characterId,
            type: openingIsRich ? 'rich' : 'text',
            content: openingPreview,
            rawContent: openingMessage,
            richHtml: openingHtml,
            richSource: openingIsRich ? (openingRegexApplied ? 'regex' : 'worldbook-ui') : undefined,
            roleCardUi: !importedSnapshot && openingIsRich ? openingUi : undefined,
            isGreetingSeed: true,
            greetingIndex: 0,
            status: 'delivered',
            createdAt: now
          }))
          if (Object.keys(openingStatePatch).length) {
            await db.conversationStates.put(toPlainStorageValue({
              id: conversationId,
              summary: '',
              summaryMessageCount: 0,
              innerMood: '',
              innerActivity: initialActivity,
              innerThought: openingStatePatch.innerThought || '',
              location: openingStatePatch.location,
              presence: openingStatePatch.presence,
              timePeriod: openingStatePatch.timePeriod || '',
              energy: '',
              unresolvedTopics: [],
              pendingEvents: [],
              shortTermGoals: openingStatePatch.shortTermGoals || [],
              stateVersion: 2,
              updatedAt: now
            }))
          }
        }


        if (importedLorebook.length && importedLorebookId) {
          const sourceLorebook = importedSnapshot?.lorebookResource || {}
          await db.lorebooks.add(toPlainStorageValue({
            ...sourceLorebook,
            id: importedLorebookId,
            worldId: DEFAULT_WORLD_ID,
            characterId,
            name: importedSnapshot?.lorebookName || sourceLorebook.name || `${trimmedName}'s Lorebook`,
            description: sourceLorebook.description || '角色卡内嵌世界书',
            sourceFileName: importedCardFileName.value || sourceLorebook.sourceFileName || undefined,
            sourceFormat: 'character-card',
            recursiveScanning: sourceLorebook.recursiveScanning,
            createdAt: now,
            updatedAt: now
          }))
          await db.resourceBindings.add(toPlainStorageValue({
            id: crypto.randomUUID(),
            worldId: DEFAULT_WORLD_ID,
            characterId,
            scope: 'character',
            scopeId: characterId,
            resourceType: 'lorebook',
            resourceId: importedLorebookId,
            enabled: true,
            order: 10,
            createdAt: now,
            updatedAt: now
          }))
          createdImportedResourceIds.push(importedLorebookId)
          await db.lorebookEntries.bulkAdd(
            toPlainStorageValue(importedLorebook.map((entry, index) => ({
              id: crypto.randomUUID(),
              worldId: DEFAULT_WORLD_ID,
              ...entry,
              characterId,
              lorebookId: importedLorebookId,
              priority: entry.priority ?? 50,
              insertionOrder: entry.insertionOrder ?? (100 - index),
              createdAt: now,
              updatedAt: now
            })))
          )
        }

        if (importedRegexScripts.length) {
          for (const [index, script] of importedRegexScripts.entries()) {
            const regexId = crypto.randomUUID()
            await db.regexScripts.add(toPlainStorageValue({
              ...script,
              id: regexId,
              worldId: DEFAULT_WORLD_ID,
              characterId,
              sourceFileName: importedCardFileName.value || script.sourceFileName,
              sourceFormat: 'character-card',
              createdAt: now,
              updatedAt: now
            }))
            createdImportedResourceIds.push(regexId)
            await db.resourceBindings.add(toPlainStorageValue({
              id: crypto.randomUUID(),
              worldId: DEFAULT_WORLD_ID,
              characterId,
              scope: 'character',
              scopeId: characterId,
              resourceType: 'regex',
              resourceId: regexId,
              enabled: true,
              order: 20 + index,
              createdAt: now,
              updatedAt: now
            }))
          }
        }

        if (importedSnapshot && importedRawText.trim()) {
          let rawJson: unknown
          try {
            rawJson = JSON.parse(importedRawText)
          } catch {
            rawJson = undefined
          }
          const archive: CommunityResourceArchive = {
            id: crypto.randomUUID(),
            worldId: DEFAULT_WORLD_ID,
            kind: 'character-card',
            characterId,
            name: trimmedName,
            fileName: importedCardFileName.value || `${trimmedName}.json`,
            mimeType: 'application/json',
            sourceFormat: importedSnapshot.format,
            rawText: importedRawText,
            rawJson,
            importedResourceIds: createdImportedResourceIds,
            compatibility: {
              format: importedSnapshot.format,
              summary: [
                `已创建角色：${trimmedName}`,
                `备用开场 ${importedPatch.alternateGreetings?.length || 0} 条`,
                `示例对话 ${importedPatch.exampleDialogues?.length || 0} 组`,
                `内嵌世界书 ${importedLorebook.length} 条`,
                `内嵌正则 ${importedRegexScripts.length} 条`
              ],
              supported: [
                '角色卡核心字段',
                '原始 JSON 无损归档',
                '角色卡自带 {{user}} Persona',
                '内嵌 character_book',
                'data/root extensions.regex_scripts',
                'depth_prompt / talkativeness / world 扩展',
                '安全保留第三方扩展（不执行 JavaScript）'
              ],
              warnings: [...(importedSnapshot.notes || [])]
            },
            createdAt: now,
            updatedAt: now
          }
          await db.communityResourceArchives.add(toPlainStorageValue(archive))
        }
      }
    )

    await router.push('/contacts')
  } catch (error) {
    console.error('创建角色失败：', error)

    const message =
      error instanceof Error
        ? error.message
        : '未知错误'

    errorMessage.value =
      `创建失败：${message}`
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <PhoneFrame title="创建角色" show-back>
    <form
      class="form-page character-create-page"
      @submit.prevent="save"
    >
      <section class="creation-card character-card-import">
        <div class="import-title-row">
          <div>
            <h3>直接导入角色卡</h3>
            <p class="section-description">
              支持 SillyTavern / Tavo / 常见社区 JSON 与带 metadata 的 PNG 角色卡。原始字段与绑定资源会尽量保留，不按固定角色模板重写。
            </p>
          </div>
          <span class="format-badge">CARD</span>
        </div>

        <div class="card-import-actions">
          <label class="card-import-button">
            {{ isImportingCard ? '正在读取…' : '选择角色卡文件' }}
            <input
              class="visually-hidden-file"
              type="file"
              accept="application/json,image/png,.json,.png"
              :disabled="isImportingCard"
              @change="handleCharacterCardImport"
            />
          </label>

          <button
            v-if="importedCard"
            class="secondary-button"
            type="button"
            :disabled="isSaving"
            @click="save"
          >
            直接创建这个角色
          </button>
        </div>

        <div v-if="importedCard" class="card-import-preview">
          <div>
            <strong>{{ importedCard.patch.name || '未命名角色' }}</strong>
            <span>{{ importedCard.format }}</span>
          </div>
          <p>{{ importedCardFileName }}</p>
          <p>备用开场 {{ importedCard.patch.alternateGreetings?.length || 0 }} 条 · 示例对话 {{ importedCard.patch.exampleDialogues?.length || 0 }} 组 · 内嵌世界书 {{ importedCard.lorebookEntries.length }} 条 · 正则 {{ importedCard.regexScripts.length }} 条</p>

          <div v-if="importedCard.embeddedUser" class="embedded-user-card">
            <div class="embedded-user-title">
              <div>
                <b>检测到角色卡自带 <span v-pre>{{user}}</span></b>
                <small>可以直接建立为这个角色专属的用户 Persona，并自动绑定新聊天。</small>
              </div>
              <label class="embedded-user-switch">
                <input v-model="createEmbeddedUserPersona" type="checkbox" />
                使用
              </label>
            </div>
            <template v-if="createEmbeddedUserPersona">
              <label class="embedded-persona-name">
                Persona 名称
                <input v-model="embeddedPersonaName" maxlength="60" />
              </label>
              <details>
                <summary>查看角色卡自带的用户人设</summary>
                <pre>{{ importedCard.embeddedUser.rawTemplate }}</pre>
              </details>
              <p>创建后可在“我的资料 → Persona”以及“聊天设置 → 角色扮演 → 我的 Persona”中查看和切换。</p>
            </template>
          </div>

          <button class="text-button" type="button" @click="clearImportedCardReference">取消本次角色卡关联</button>
        </div>

        <p v-if="cardImportMessage" class="message-box">{{ cardImportMessage }}</p>
      </section>

      <section class="creation-card">
        <h3>快速导入人物设定</h3>

        <p class="section-description">
          可以粘贴完整人物卡，也可以粘贴一段人物介绍。
        </p>

        <textarea
          v-model="importText"
          rows="7"
          placeholder="例如：
姓名：示例角色
年龄：23
身份：自由职业者
性格：温柔慢热，观察力很强
说话方式：语气自然，表达简洁
背景：可以粘贴任意角色的人物介绍"
        ></textarea>

        <div class="button-row">
          <button
            class="secondary-button"
            type="button"
            @click="parseImportedCharacter"
          >
            自动识别并填入
          </button>

          <button
            class="text-button"
            type="button"
            @click="importText = ''"
          >
            清空
          </button>
        </div>

        <p
          v-if="parseMessage"
          class="message-box"
        >
          {{ parseMessage }}
        </p>
      </section>

      <details class="creation-card preset-card">
        <summary>
          没有灵感？点击选择角色模板
        </summary>

        <h4>性格</h4>

        <div class="preset-grid">
          <button
            v-for="item in personalityPresets"
            :key="item.label"
            type="button"
            class="preset-chip"
            @click="appendPreset('persona', item.value)"
          >
            {{ item.label }}
          </button>
        </div>

        <h4>说话方式</h4>

        <div class="preset-grid">
          <button
            v-for="item in speakingStylePresets"
            :key="item.label"
            type="button"
            class="preset-chip"
            @click="
              appendPreset(
                'speakingStyle',
                item.value
              )
            "
          >
            {{ item.label }}
          </button>
        </div>

        <h4>人物背景</h4>

        <div class="preset-grid">
          <button
            v-for="item in backgroundPresets"
            :key="item.label"
            type="button"
            class="preset-chip"
            @click="
              appendPreset(
                'background',
                item.value
              )
            "
          >
            {{ item.label }}
          </button>
        </div>
      </details>

      <h3 class="form-section-title">
        基础身份
      </h3>

      <div class="avatar-editor">
        <div class="avatar-preview">
          <img
            v-if="avatarImage"
            :src="avatarImage"
            alt="角色头像预览"
          />

          <span v-else>
            {{ avatarEmoji || '🍓' }}
          </span>
        </div>

        <div class="avatar-controls">
          <label>
            表情头像
            <input
              v-model="avatarEmoji"
              maxlength="8"
              placeholder="例如：🌸"
              @input="avatarImage = ''"
            />
          </label>

          <label class="upload-button">
            选择本地照片
            <input
              class="hidden-file-input"
              type="file"
              accept="image/*"
              @change="handleAvatarUpload"
            />
          </label>

          <button
            v-if="avatarImage"
            class="text-button"
            type="button"
            @click="removePhotoAvatar"
          >
            移除照片
          </button>
        </div>
      </div>

      <label>
        角色姓名
        <input
          v-model="name"
          maxlength="20"
          placeholder="例如：角色姓名"
        />
      </label>

      <label>
        昵称
        <input
          v-model="nickname"
          maxlength="20"
          placeholder="例如：昵称"
        />
      </label>

      <label>
        性别
        <select v-model="gender">
          <option value="female">女</option>
          <option value="male">男</option>
          <option value="nonbinary">
            非二元
          </option>
          <option value="unspecified">
            暂不设置
          </option>
        </select>
      </label>

      <label>
        年龄
        <input
          v-model="age"
          type="number"
          min="0"
          max="200"
          placeholder="可不填写"
        />
      </label>

      <label>
        身份或职业
        <input
          v-model="identity"
          maxlength="50"
          placeholder="例如：花店店主、大学生、医生"
        />
      </label>

      <h3 class="form-section-title">
        关系与人物设定
      </h3>

      <label>
        与用户的初始关系
        <input
          v-model="relationship"
          list="relationship-options"
          maxlength="30"
          placeholder="可由角色卡识别，也可以自己填写，例如：师徒、夫妻、搭档"
        />
        <datalist id="relationship-options">
          <option value="未设定"></option>
          <option value="陌生人"></option>
          <option value="朋友"></option>
          <option value="挚友"></option>
          <option value="师徒"></option>
          <option value="恋人"></option>
          <option value="夫妻"></option>
          <option value="家人"></option>
          <option value="同学"></option>
          <option value="同事"></option>
          <option value="搭档"></option>
        </datalist>
      </label>

      <label>
        核心人设
        <textarea
          v-model="persona"
          rows="4"
          placeholder="角色最核心、最稳定的性格特点。"
        ></textarea>
      </label>

      <label>
        说话方式
        <textarea
          v-model="speakingStyle"
          rows="3"
          placeholder="语气、句子长度、表情使用习惯、口癖等。"
        ></textarea>
      </label>

      <label>
        背景故事
        <textarea
          v-model="background"
          rows="4"
          placeholder="职业、成长经历、生活环境和与用户相识的过程。"
        ></textarea>
      </label>

      <label>
        喜欢的事物
        <input
          v-model="likesText"
          placeholder="使用逗号分隔，例如：花、甜品、雨天"
        />
      </label>

      <label>
        不喜欢的事物
        <input
          v-model="dislikesText"
          placeholder="使用逗号分隔，例如：争吵、失约"
        />
      </label>

      <h3 class="form-section-title">沉浸起点</h3>

      <label>
        当前场景
        <textarea
          v-model="scenario"
          rows="4"
          placeholder="时间、地点、双方处境和故事开始时正在发生的事。"
        ></textarea>
      </label>

      <label>
        第一条消息
        <textarea
          v-model="firstMessage"
          rows="4"
          placeholder="创建后角色真正会发出的开场白。"
        ></textarea>
      </label>

      <label>
        示例对话
        <textarea
          v-model="exampleDialoguesText"
          rows="8"
          placeholder="用户：你怎么还没睡？&#10;角色：刚写完一页。你呢，又在逞强？&#10;&#10;---&#10;&#10;用户：我今天有点想你。&#10;角色：……那你现在见到我了。"
        ></textarea>
      </label>

      <p class="hint">创建后还可以在“角色详情 → 沉浸角色卡”中补充完整设定、备用开场与世界书。</p>

      <p
        v-if="errorMessage"
        class="error-box"
      >
        {{ errorMessage }}
      </p>

      <button
        class="primary"
        type="submit"
        :disabled="isSaving"
      >
        {{
          isSaving
            ? '正在创建角色…'
            : '创建角色'
        }}
      </button>

      <p class="hint">
        创建后会自动加入通讯录，并建立对应的私聊会话。
      </p>
    </form>
  </PhoneFrame>
</template>

<style scoped>
.character-create-page {
  padding-bottom: 36px;
}

.creation-card {
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.42);
}

.character-card-import { display: grid; gap: 10px; }
.import-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.format-badge { flex: 0 0 auto; padding: 5px 9px; border-radius: 999px; background: rgba(217,111,155,.12); color: #b8567f; font-size: 11px; font-weight: 800; }
.card-import-actions { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 9px; }
.card-import-button { display: flex; align-items: center; justify-content: center; min-height: 42px; border-radius: 13px; background: #d96f9b; color: white; font-weight: 800; cursor: pointer; }
.visually-hidden-file { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
.card-import-preview { padding: 11px 12px; border: 1px solid rgba(217,111,155,.18); border-radius: 14px; background: rgba(255,248,251,.82); }
.card-import-preview > div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.card-import-preview span, .card-import-preview p { color: #9b7183; font-size: 12px; }
.card-import-preview p { margin: 5px 0 0; }
.embedded-user-card { margin-top: 10px; padding: 11px; border-radius: 13px; background: rgba(217,111,155,.08); display: grid; gap: 9px; }
.embedded-user-title { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; align-items: flex-start; }
.embedded-user-title > div { display: grid; gap: 3px; }
.embedded-user-title small { color: #9b7183; line-height: 1.45; }
.embedded-user-switch { display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; font-size: 12px; font-weight: 800; color: #b8567f; }
.embedded-persona-name { display: grid; gap: 5px; font-size: 12px; color: #8e6577; }
.embedded-persona-name input { min-height: 38px; border: 1px solid rgba(217,111,155,.18); border-radius: 11px; padding: 0 10px; background: rgba(255,255,255,.86); }
.embedded-user-card details { border-top: 1px solid rgba(217,111,155,.12); padding-top: 8px; }
.embedded-user-card summary { cursor: pointer; color: #b8567f; font-weight: 800; font-size: 12px; }
.embedded-user-card pre { margin: 8px 0 0; white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto; font: inherit; font-size: 12px; line-height: 1.55; color: #634b56; }
@media (max-width: 390px) { .card-import-actions { grid-template-columns: 1fr; } .embedded-user-title { grid-template-columns: 1fr; } .embedded-user-switch { justify-self: start; } }

.creation-card h3 {
  margin: 0 0 6px;
}

.section-description {
  margin: 0 0 10px;
  font-size: 13px;
  opacity: 0.7;
}

.button-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.secondary-button,
.upload-button,
.preset-chip,
.text-button {
  border: none;
  cursor: pointer;
  font: inherit;
}

.secondary-button,
.upload-button {
  padding: 9px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
}

.text-button {
  padding: 7px 10px;
  background: transparent;
  opacity: 0.7;
}

.preset-card summary {
  cursor: pointer;
  font-weight: 700;
}

.preset-card h4 {
  margin: 16px 0 8px;
}

.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-chip {
  padding: 8px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
}

.form-section-title {
  margin: 10px 0 0;
}

.avatar-editor {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-preview {
  flex: 0 0 auto;
  width: 84px;
  height: 84px;
  overflow: hidden;
  border-radius: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42px;
  background: rgba(255, 255, 255, 0.72);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-controls {
  flex: 1;
  display: grid;
  gap: 8px;
}

.upload-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

.hidden-file-input {
  display: none;
}

.message-box,
.error-box {
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
}

.message-box {
  background: rgba(255, 255, 255, 0.55);
}

.error-box {
  background: rgba(255, 225, 225, 0.85);
}
</style>