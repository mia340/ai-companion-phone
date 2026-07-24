<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { DEFAULT_WORLD_ID } from '../db/seed'
import type { Character } from '../types/domain'

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
const relationship = ref('朋友')
const persona = ref('')
const speakingStyle = ref('')
const background = ref('')
const likesText = ref('')
const dislikesText = ref('')

// 整段导入
const importText = ref('')
const parseMessage = ref('')

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

    await db.transaction(
      'rw',
      db.characters,
      db.conversations,
      async () => {
        await db.characters.add({
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
            '等待你逐渐了解的原创角色。',

          speakingStyle:
            speakingStyle.value.trim() || undefined,

          background:
            background.value.trim() || undefined,

          likes: parseList(likesText.value),
          dislikes: parseList(dislikesText.value),

          relationship: relationship.value,
          mood: '期待认识你',
          activity: '刚刚来到这个世界',

          groups: ['group-friends'],
          replySpeed: 'natural',

          createdAt: now,
          updatedAt: now
        })

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
      <section class="creation-card">
        <h3>快速导入人物设定</h3>

        <p class="section-description">
          可以粘贴完整人物卡，也可以粘贴一段人物介绍。
        </p>

        <textarea
          v-model="importText"
          rows="7"
          placeholder="例如：
姓名：苏晚
年龄：23
身份：甜品店店主
性格：温柔慢热，观察力很强
说话方式：语气自然，偶尔使用可爱的表情
背景：经营一家只在傍晚营业的甜品店"
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
          placeholder="例如：苏晚"
        />
      </label>

      <label>
        昵称
        <input
          v-model="nickname"
          maxlength="20"
          placeholder="例如：晚晚"
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
        <select v-model="relationship">
          <option>陌生人</option>
          <option>朋友</option>
          <option>挚友</option>
          <option>恋人</option>
          <option>家人</option>
          <option>同学</option>
          <option>同事</option>
        </select>
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