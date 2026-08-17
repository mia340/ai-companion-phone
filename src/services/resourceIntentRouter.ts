import type { LorebookEntry } from '../types/domain'

export type ResourceRoutingStatus = 'focused' | 'activated' | 'deferred'

export interface ResourceRoutingDecision {
  id: string
  title: string
  status: ResourceRoutingStatus
  reason: string
  characters: number
}

export interface ResourceIntentResult {
  focusedIds: Set<string>
  focusedAliases: Map<string, string>
}

function declaredTriggerAliases(entry: LorebookEntry) {
  const values = new Set<string>()
  const add = (raw: string) => {
    const value = raw.trim()
    if (value.length < 2 || value.length > 32) return
    values.add(value)
    // 作者常把触发动作写成“打开X / 发X给 / 查看X”。本地只抽出资源名用于路由，不生成内容。
    const stripped = value
      .replace(/^(?:请|帮我|我要|我想|想要)?(?:打开|查看|看看|看一下|看下|进入|切到|切换|刷|逛|使用|启用|调用|发送|发|回复|评论|发布|写|读)/, '')
      .replace(/(?:给|一下|看看|看一下|看下)$/g, '')
      .trim()
    if (stripped.length >= 2 && stripped.length <= 24) values.add(stripped)
  }
  const lines = entry.content.slice(0, 2200).split(/\r?\n/)
  for (const line of lines) {
    if (!/(?:触发|当我输入|相关动作|关键词|类似意思|类似意图)/i.test(line)) continue
    for (const match of line.matchAll(/[“‘"']([^”’"']{2,32})[”’"']/g)) add(match[1])
    for (const match of line.matchAll(/<([^<>]{2,180})>/g)) {
      match[1].split(/[,，、;/；]/).forEach(add)
    }
  }
  return [...values]
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[⭐️💛❤️💙💚💜🧡🤍🖤💬📱📲📰🧾📮📧✉️📨📩🔔🔗]+/gu, '')
}

function titleAliases(title: string) {
  const source = title.trim()
  const values = new Set<string>()
  if (!source) return []
  values.add(source)
  source
    .split(/[\[{（【(<《「『:：|/\\—–-]/u)
    .map(item => item.trim())
    .filter(item => item.length >= 2)
    .forEach(item => values.add(item))
  const withoutDecorators = source
    .replace(/[⭐️💛❤️💙💚💜🧡🤍🖤💬📱📲📰🧾📮📧✉️📨📩🔔🔗]/gu, '')
    .replace(/[{}\[\]（）()【】<>《》「」『』]/g, ' ')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(item => item.length >= 2)
  withoutDecorators.forEach(item => values.add(item))
  return [...values]
}

function aliasesForEntry(entry: LorebookEntry) {
  const values = new Set<string>([...titleAliases(entry.title), ...declaredTriggerAliases(entry)])
  for (const keyword of [...(entry.keywords || []), ...(entry.secondaryKeys || [])]) {
    const trimmed = keyword.trim()
    if (!trimmed || trimmed.length > 32 || /^\/.+\/[a-z]*$/i.test(trimmed)) continue
    if (trimmed.length >= 2) values.add(trimmed)
  }
  return [...values]
}

function userClearlyRequestsResource(text: string, alias: string) {
  const normalizedText = normalize(text)
  const normalizedAlias = normalize(alias)
  if (!normalizedText || normalizedAlias.length < 2 || !normalizedText.includes(normalizedAlias)) return false

  // 只负责“用户在调用哪个现有资源”的路由，不生成资源内容。
  const actionHints = [
    '打开', '看看', '查看', '进入', '切到', '切换', '刷', '逛', '使用', '启用', '调用',
    '发', '发送', '回复', '评论', '发布', '写', '读', '看一下', '看下', '打开一下', '打开看看'
  ]
  const aliasIndex = normalizedText.indexOf(normalizedAlias)
  const before = normalizedText.slice(Math.max(0, aliasIndex - 12), aliasIndex)
  const after = normalizedText.slice(aliasIndex + normalizedAlias.length, aliasIndex + normalizedAlias.length + 12)
  // 动作词必须紧邻资源名，避免“我在论坛看到有人发帖”因为远处出现“发”就误抢占。
  if (actionHints.some(hint => before.endsWith(hint) || after.startsWith(hint))) return true

  // 很短的直接请求，例如“论坛”“朋友圈”，也视为显式调用；较长叙述中的偶然提及不抢占。
  return normalizedText.length <= normalizedAlias.length + 4
}


export function shouldExitResourceSession(text: string, activeEntry?: LorebookEntry) {
  const normalizedText = normalize(text.trim())
  if (!normalizedText) return false

  // 明确的通用退出语义。只处理用户主动“退出/返回”，不根据剧情内容擅自结束资源会话。
  if (/^(?:退出|关闭|离开|结束)(?:当前|这个|该)?(?:页面|界面|功能|模式|资源|会话|聊天|私聊)?$/.test(normalizedText)) return true
  if (/^(?:回到|返回)(?:普通|原来|角色)?(?:聊天|对话|主界面|聊天界面)$/.test(normalizedText)) return true

  if (!activeEntry) return false
  for (const alias of aliasesForEntry(activeEntry)) {
    const normalizedAlias = normalize(alias)
    if (!normalizedAlias || !normalizedText.includes(normalizedAlias)) continue
    const index = normalizedText.indexOf(normalizedAlias)
    const before = normalizedText.slice(Math.max(0, index - 8), index)
    const after = normalizedText.slice(index + normalizedAlias.length, index + normalizedAlias.length + 8)
    if (/(?:退出|关闭|离开|结束)$/.test(before) || /^(?:退出|关闭|结束)/.test(after)) return true
  }
  return false
}

export function routeLorebookIntent(entries: LorebookEntry[], latestText = ''): ResourceIntentResult {
  const focusedIds = new Set<string>()
  const focusedAliases = new Map<string, string>()
  const text = latestText.trim()
  if (!text) return { focusedIds, focusedAliases }

  for (const entry of entries) {
    if (!entry.enabled) continue
    for (const alias of aliasesForEntry(entry)) {
      if (!userClearlyRequestsResource(text, alias)) continue
      focusedIds.add(entry.id)
      focusedAliases.set(entry.id, alias)
      break
    }
  }
  return { focusedIds, focusedAliases }
}

export function looksLikeLargeFeatureModule(entry: LorebookEntry) {
  if (entry.content.length < 1800) return false
  const structuralSample = `${entry.title}\n${entry.content.slice(0, 2600)}`
  const structuralSignals = [
    /(?:输出|回复|生成|显示).{0,16}(?:格式|模板|界面|UI|结构)/i,
    /(?:HTML|CSS|<style\b|<div\b|<details\b|<!DOCTYPE)/i,
    /(?:正则|Regex|findRegex|replaceString)/i,
    /(?:点击|按钮|页面|功能|模块|小程序|app|APP).{0,24}(?:使用|操作|打开|触发|切换)/i,
    /\[(?:折叠标题|主题|正文|评论区|角色状态|场景信息)[：:\]]/i,
    /<(?:msg|rednote|PhoneAnalysis|status|forum|wechat)[>\s]/i
  ]
  return structuralSignals.some(pattern => pattern.test(structuralSample))
}



export function looksLikeOnDemandFeatureModule(entry: LorebookEntry) {
  const sample = `${entry.title}
${entry.content.slice(0, 3600)}`
  return /(?:触发条件|相关动作|类似意图|类似意思|当我输入|当(?:剧情|用户|角色|对话|消息|输入)[\s\S]{0,50}(?:出现|提到|包含|输入|执行)|(?:打开|查看|刷|进入|切换|发(?:送)?)[\s\S]{0,40}(?:时|后)[\s\S]{0,50}(?:生成|显示|展示|调用|输出))/i.test(sample)
}

export function looksLikeMandatoryPerReplyContract(entry: LorebookEntry) {
  const sample = entry.content.slice(0, 4200)
  return /(?:每(?:次|轮).*?(?:回复|输出).*?(?:必须|务必|需要|需|携带|包含)|所有回复.*?(?:必须|务必|需要|需)|每次扮演[\s\S]{0,80}回复[\s\S]{0,80}(?:必须|务必|需要|需))/i.test(sample)
}

export function buildResourceFocusInstruction(entries: Array<LorebookEntry & { activationReason: string }>) {
  if (!entries.length) return ''
  const names = entries.map(item => `「${item.title}」`).join('、')
  const continuing = entries.every(item => item.activationReason.startsWith('资源会话延续：'))
  return [
    '【本轮资源 Focus】',
    continuing
      ? `当前仍在已开启资源会话中：${names}。本轮短句默认继续作用于这个资源，除非用户明确退出或切换。`
      : `用户本轮明确请求使用已绑定资源：${names}。`,
    '优先遵循这些资源自身的原始规则完成本轮请求；不要把资源名仅解释成普通剧情动作、另行询问入口地址或让角色代替用户操作。',
    '具体帖子、消息、评论、人物反应与其它内容仍全部由你依据角色卡、资源原文和当前上下文生成，应用不提供剧情内容。'
  ].join('\n')
}

export function buildResourceSessionContinuationContent(entry: LorebookEntry) {
  if (!looksLikeLargeFeatureModule(entry)) return entry.content
  const source = entry.content.trim()
  const htmlIndex = source.search(/<!doctype\s+html|<html\b|<style\b|<div\b|<details\b|<section\b|<article\b/i)
  const authorLead = (htmlIndex > 0 ? source.slice(0, htmlIndex) : source.slice(0, 1200)).trim().slice(0, 1600)
  return [
    authorLead ? `【作者原始入口规则】\n${authorLead}` : '',
    '【资源会话延续】该资源上一轮已经打开。继续沿用上一轮已经建立的作者界面、字段含义与交互语义；本轮只需要根据当前用户消息更新/继续该资源内容。不要重新解释如何打开资源，也不要把资源操作降级成普通剧情动作。',
    '界面里的帖子、聊天内容、评论、角色反应等仍由你依据原卡与上下文生成；应用不会本地补写剧情。'
  ].filter(Boolean).join('\n\n')
}
