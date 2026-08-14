import { describe, expect, it } from 'vitest'
import {
  buildCommunityUiPriorityPrompt,
  communityUiOutputConforms,
  detectCommunityUiContract,
  sanitizeCommunityUiText
} from './communityUiRuntime'
import type { Character, RegexScript } from '../types/domain'

const character = {
  id: 'char', worldId: 'world', name: '测试', avatar: '', persona: '安静', relationship: '朋友', mood: '平静', activity: '', groups: [], replySpeed: 'natural', createdAt: ''
} as Character

const statusRegex = {
  id: 'regex', worldId: 'world', name: '状态栏', findRegex: '/<日期>(.*?)<\\/日期>/s', replaceString: '```html\n<!DOCTYPE html><html><head><style>.card{padding:8px}</style></head><body><div class="card">$1</div></body></html>\n```', trimStrings: [], placement: [2], enabled: true, markdownOnly: false, promptOnly: false, runOnEdit: false, substituteRegex: 0, createdAt: '', updatedAt: ''
} as RegexScript

describe('community UI priority', () => {
  it('detects a lorebook-defined per-reply UI contract', () => {
    const contract = detectCommunityUiContract({
      character,
      lorebookPrompt: '====格式规则（最高优先级）====\n每次回复必须在正文末尾生成状态栏，不得省略。\n<日期>{{当前日期}}</日期><地点>{{当前地点}}</地点>'
    })
    expect(contract.active).toBe(true)
    expect(contract.mode).toBe('structured-contract')
    expect(contract.requiredTagNames).toContain('日期')
    expect(buildCommunityUiPriorityPrompt(contract)).toContain('不要把它改写成小手机私有格式')
  })

  it('detects regex generated HTML UI', () => {
    const contract = detectCommunityUiContract({ character, assistantRegex: [statusRegex], lorebookPrompt: '每次回复必须严格遵守状态栏格式，不得省略。<日期>{{当前日期}}</日期>' })
    expect(contract.active).toBe(true)
    expect(contract.mode).toBe('regex-html')
    expect(contract.regexInputSkeleton).toContain('<日期>')
    expect(communityUiOutputConforms({
      contract,
      rawText: '<日期>10月15日</日期>',
      renderedText: '<style>.card{}</style><div class="card">10月15日</div>',
      appliedRegex: ['状态栏']
    })).toBe(true)
    expect(communityUiOutputConforms({ contract, rawText: '普通回复', renderedText: '普通回复', appliedRegex: [] })).toBe(false)
  })

  it('recognizes a multi-field status regex as a per-reply UI contract even when the lorebook rule is not currently in the prompt', () => {
    const multiStatus = {
      ...statusRegex,
      name: '状态栏 UI',
      findRegex: '/<日期>(.*?)<\\/日期>\\s*<时间>(.*?)<\\/时间>\\s*<地点>(.*?)<\\/地点>/s'
    }
    const contract = detectCommunityUiContract({ character, assistantRegex: [multiStatus] })
    expect(contract.active).toBe(true)
    expect(contract.mode).toBe('regex-html')
    expect(contract.regexInputSkeleton).toContain('<时间>')
  })

  it('does not force every reply into UI just because an occasional rich regex exists', () => {
    const contract = detectCommunityUiContract({ character, assistantRegex: [{ ...statusRegex, name: '开场白', findRegex: '/【主页】/s' }] })
    expect(contract.active).toBe(false)
    expect(contract.mode).toBe('none')
  })

  it('does not let an opening-page regex satisfy a per-reply status UI contract', () => {
    const openingRegex = { ...statusRegex, id: 'opening', name: '开场白', findRegex: '/【八卦主页】/s' }
    const perReplyStatus = {
      ...statusRegex,
      id: 'status',
      name: '状态栏',
      findRegex: '/<日期>(.*?)<\/日期>\s*<时间>(.*?)<\/时间>\s*<地点>(.*?)<\/地点>\s*<环境>(.*?)<\/环境>/s'
    }
    const contract = detectCommunityUiContract({ character, assistantRegex: [openingRegex, perReplyStatus] })
    expect(contract.requiredRegexNames).toEqual(['状态栏'])
    expect(communityUiOutputConforms({
      contract,
      rawText: '【八卦主页】',
      renderedText: '<style>.home{}</style><div class="home">主页</div>',
      appliedRegex: ['开场白']
    })).toBe(false)
    expect(communityUiOutputConforms({
      contract,
      rawText: '<日期>8月14日</日期><时间>10:00</时间><地点>家</地点><环境>安静</环境>',
      renderedText: '<style>.status{}</style><div class="status">状态</div>',
      appliedRegex: ['状态栏']
    })).toBe(true)
  })

  it('requires HTML when the card defines a direct HTML contract', () => {
    const contract = detectCommunityUiContract({
      character,
      lorebookPrompt: '每次回复严格遵守状态栏格式UI，不得省略。状态栏格式UI如下:<div><details><summary>状态</summary></details></div>'
    })
    expect(contract.mode).toBe('html-contract')
    expect(communityUiOutputConforms({ contract, rawText: '只是普通文本' })).toBe(false)
    expect(communityUiOutputConforms({ contract, rawText: '<div><details><summary>状态</summary></details></div>' })).toBe(true)
    expect(contract.exactHtmlTemplate).toContain('<details>')
    expect(buildCommunityUiPriorityPrompt(contract)).toContain('原卡 HTML UI 模板')
  })

  it('keeps all original-card tags untouched in card-first mode', () => {
    const text = '<日期>10月15日</日期><地点>公寓</地点>\n<scene_action>抬眼看你</scene_action>\n<companion_packet>{"messages":[]}</companion_packet>'
    expect(sanitizeCommunityUiText(text)).toBe(text)
  })
})
