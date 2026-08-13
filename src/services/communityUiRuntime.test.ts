import { describe, expect, it } from 'vitest'
import { buildCommunityUiPriorityPrompt, detectCommunityUiContract, sanitizeCommunityUiText } from './communityUiRuntime'
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
    expect(buildCommunityUiPriorityPrompt(contract)).toContain('不要套用小手机默认的“动作与对白分开/合并”规则')
  })

  it('detects regex generated HTML UI', () => {
    const contract = detectCommunityUiContract({ character, assistantRegex: [statusRegex] })
    expect(contract.active).toBe(true)
    expect(contract.mode).toBe('regex-html')
  })

  it('keeps community XML while removing only phone private protocol', () => {
    const text = '<日期>10月15日</日期><地点>公寓</地点>\n<scene_action>抬眼看你</scene_action>\n<companion_packet>{"messages":[]}</companion_packet>'
    expect(sanitizeCommunityUiText(text)).toBe('<日期>10月15日</日期><地点>公寓</地点>\n抬眼看你')
  })
})
