import { describe, expect, it } from 'vitest'
import {
  looksLikeLargeFeatureModule,
  looksLikeMandatoryPerReplyContract,
  looksLikeOnDemandFeatureModule,
  routeLorebookIntent,
  shouldExitResourceSession
} from './resourceIntentRouter'
import type { LorebookEntry } from '../types/domain'

function row(patch: Partial<LorebookEntry>): LorebookEntry {
  return {
    id: patch.id || crypto.randomUUID(),
    worldId: 'world',
    title: patch.title || '资源',
    keywords: patch.keywords || [],
    content: patch.content || '',
    enabled: patch.enabled ?? true,
    constant: patch.constant ?? true,
    caseSensitive: false,
    priority: 50,
    createdAt: '',
    updatedAt: '',
    ...patch
  }
}

describe('resource intent router', () => {
  it('routes a natural explicit request to a matching bound resource title', () => {
    const forum = row({ id: 'forum', title: '论坛{带正则', content: '规则'.repeat(1000) })
    const wechat = row({ id: 'wechat', title: '微信私聊', content: '规则'.repeat(1000) })
    const result = routeLorebookIntent([forum, wechat], '打开论坛看看最近有什么帖子')
    expect(result.focusedIds.has('forum')).toBe(true)
    expect(result.focusedIds.has('wechat')).toBe(false)
  })

  it('does not focus a resource from a casual long mention without a request', () => {
    const forum = row({ id: 'forum', title: '论坛{带正则' })
    const result = routeLorebookIntent([forum], '某角色说学校论坛以前有很多关于他的传闻，不过现在我们先吃饭。')
    expect(result.focusedIds.has('forum')).toBe(false)
  })

  it('learns author-declared trigger phrases without hardcoding a specific app name', () => {
    const messaging = row({
      id: 'messaging',
      title: '私聊模块',
      content: `任何角色执行以下相关动作，<打开微信, 微信聊天, 发微信给>类似意思的句子时，就生成对应界面。\n${'x'.repeat(1900)}`
    })
    const result = routeLorebookIntent([messaging], '给某角色发微信：我回家了')
    expect(result.focusedIds.has('messaging')).toBe(true)
  })


  it('keeps a resource session until the user explicitly exits it', () => {
    const messaging = row({ id: 'messaging', title: '私聊模块', content: '相关动作：<打开私聊, 私聊消息>。当用户打开时生成界面。' })
    expect(shouldExitResourceSession('喝啦', messaging)).toBe(false)
    expect(shouldExitResourceSession('退出私聊模块', messaging)).toBe(true)
    expect(shouldExitResourceSession('回到普通聊天', messaging)).toBe(true)
  })
  it('detects long on-demand UI instruction modules without naming a specific app', () => {
    const module = row({ title: '某功能', content: `触发条件：用户明确打开该功能时，按照以下输出格式生成界面。\n<div>${'x'.repeat(1900)}</div>` })
    expect(looksLikeLargeFeatureModule(module)).toBe(true)
    expect(looksLikeOnDemandFeatureModule(module)).toBe(true)
  })

  it('does not defer an author contract that explicitly requires UI on every reply', () => {
    const status = row({ title: '状态栏', content: `每次扮演{{char}}回复正文开头必须携带状态栏格式UI。\n<div>${'x'.repeat(1900)}</div>` })
    expect(looksLikeMandatoryPerReplyContract(status)).toBe(true)
  })
})
