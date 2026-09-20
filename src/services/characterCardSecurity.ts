/**
 * Character Card 安全边界：共享角色资源只保留“角色本身”的资料。
 *
 * 社区卡可能混入发送者的 API 凭据、UI 主题、本地偏好或运行时存档。
 * 这些字段既不应该进入当前用户的运行时，也不应该在再次导出时继续传播。
 * 原始文件仍可由 CommunityResourceArchive 单独保留用于取证/兼容；这里负责的是
 * “进入工作模型 / 再分享”前的递归净化。
 */

export interface CharacterCardSanitizeResult<T> {
  value: T
  removedPaths: string[]
}

const BLOCKED_NORMALIZED_KEYS = new Set([
  // 凭据 / API 配置
  'apikey',
  'apiconfig',
  'authorization',
  'bearertoken',
  'accesstoken',
  'refreshtoken',
  'secret',
  'password',
  'privatekey',
  'masterkey',
  'servertoken',
  'emotionconfig',
  'embeddingconfig',
  'proactiveconfig',
  'activemsg2config',

  // 发卡人的 UI / 本地偏好
  'embeddedtheme',
  'bubblestyle',
  'chatfinetune',
  'chromecustomcss',
  'chatsound',
  'chatsoundbound',
  'chatbackground',
  'datebackground',
  'thinkingchainstyle',
  'thinkingchaincustomcolors',
  'thinkingchaincustomprompt',
  'thinkingchaincustomcss',
  'chatcollaborationenabled',
  'groupid',
  'chatvoicelang',
  'datevoicelang',
  'callvoicelang',
  'chatvoiceenabled',
  'chatvoiceautoplay',
  'datevoiceenabled',
  'memorypalacewaterline',

  // 运行时 / 存档残留
  'activebuffs',
  'buffinjection',
  'memorypalaceinjection',
  'videocallperformancepersona',
  'videocallperformancepersonageneratedat',
  'companiontouchsettings',
  'companionavatar',
  'saveddatestate',
  'savedroomstate',
  'lastroomdate',
  'phonestate',
  'dreamlogs',
  'specialmomentrecords',
  'vrstate',
  'chibistudio',

  // 原型污染相关键
  'proto',
  'prototype',
  'constructor'
])

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function isBlockedCharacterCardField(key: string) {
  return BLOCKED_NORMALIZED_KEYS.has(normalizeKey(key))
}

export function sanitizeCharacterCardMetadata<T>(input: T): CharacterCardSanitizeResult<T> {
  const removedPaths: string[] = []
  const seen = new WeakMap<object, unknown>()

  const walk = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) {
      if (seen.has(value)) return seen.get(value)
      const out: unknown[] = []
      seen.set(value, out)
      value.forEach((item, index) => out.push(walk(item, `${path}[${index}]`)))
      return out
    }

    if (!isPlainObject(value)) return value
    if (seen.has(value)) return seen.get(value)

    const out: Record<string, unknown> = Object.create(null)
    seen.set(value, out)
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key
      if (isBlockedCharacterCardField(key)) {
        removedPaths.push(childPath)
        continue
      }
      out[key] = walk(child, childPath)
    }
    return out
  }

  return {
    value: walk(input, '') as T,
    removedPaths
  }
}
