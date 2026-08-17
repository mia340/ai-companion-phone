import { describe, expect, it } from 'vitest'
import {
  buildCommunityUiPriorityPrompt,
  communityUiOutputConforms,
  detectCommunityUiContract,
  sanitizeCommunityUiText,
  tryRepairCommunityUiLocally
} from './communityUiRuntime'
import type { Character, RegexScript } from '../types/domain'

const character = {
  id: 'char', worldId: 'world', name: '测试', avatar: '', persona: '安静', relationship: '朋友', mood: '平静', activity: '', groups: [], replySpeed: 'natural', createdAt: ''
} as Character

const statusRegex = {
  id: 'regex', worldId: 'world', name: '状态栏',
  findRegex: '/<日期>(.*?)<\\/日期>\\s*<时间>(.*?)<\\/时间>\\s*<地点>(.*?)<\\/地点>/s',
  replaceString: '```html\n<!DOCTYPE html><html><head><style>.card{padding:8px}</style></head><body><div class="card">$1 $2 $3</div></body></html>\n```',
  trimStrings: [], placement: [2], enabled: true, markdownOnly: false, promptOnly: false, runOnEdit: false, substituteRegex: 0, createdAt: '', updatedAt: ''
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

  it('uses Regex as postprocessing only when an explicit card/worldbook contract asks for matching tags', () => {
    const contract = detectCommunityUiContract({
      character,
      assistantRegex: [statusRegex],
      lorebookPrompt: '每次回复必须严格遵守状态栏格式，不得省略。<日期>{{当前日期}}</日期><时间>{{当前时间}}</时间><地点>{{当前地点}}</地点>'
    })
    expect(contract.active).toBe(true)
    expect(contract.mode).toBe('regex-html')
    expect(contract.regexInputSkeleton).toContain('<日期>')
    expect(contract.regexInputSkeleton).toContain('<时间>')
    expect(communityUiOutputConforms({
      contract,
      rawText: '<日期>10月15日</日期><时间>21:00</时间><地点>家</地点>',
      renderedText: 'Regex 即使没运行也不影响原始结构合规',
      appliedRegex: []
    })).toBe(true)
    expect(communityUiOutputConforms({ contract, rawText: '普通回复', renderedText: '普通回复', appliedRegex: [] })).toBe(false)
  })

  it('treats a rich multi-field Regex alone as a postprocessor, not a model output contract', () => {
    const contract = detectCommunityUiContract({ character, assistantRegex: [statusRegex] })
    expect(contract.active).toBe(false)
    expect(contract.mode).toBe('none')
    expect(contract.requiredRegexNames).toEqual([])
  })

  it('does not resurrect a Regex contract from archived raw card extensions', () => {
    const card = {
      ...character,
      rawCardExtensions: {
        dataExtensions: {
          regex_scripts: [{ findRegex: statusRegex.findRegex, replaceString: statusRegex.replaceString }]
        }
      }
    } as Character
    const contract = detectCommunityUiContract({ character: card, assistantRegex: [statusRegex] })
    expect(contract.active).toBe(false)
  })

  it('does not force every reply into UI just because an occasional rich regex exists', () => {
    const contract = detectCommunityUiContract({ character, assistantRegex: [{ ...statusRegex, name: '开场白', findRegex: '/【主页】/s' }] })
    expect(contract.active).toBe(false)
    expect(contract.mode).toBe('none')
  })

  it('does not let an opening-page regex satisfy an explicit per-reply status UI contract', () => {
    const openingRegex = { ...statusRegex, id: 'opening', name: '开场白', findRegex: '/【八卦主页】/s' }
    const perReplyStatus = {
      ...statusRegex,
      id: 'status',
      name: '状态栏',
      findRegex: '/<日期>(.*?)<\\/日期>\\s*<时间>(.*?)<\\/时间>\\s*<地点>(.*?)<\\/地点>\\s*<环境>(.*?)<\\/环境>/s'
    }
    const contract = detectCommunityUiContract({
      character,
      assistantRegex: [openingRegex, perReplyStatus],
      lorebookPrompt: '每次回复必须输出完整状态栏：<日期>日期</日期><时间>时间</时间><地点>地点</地点><环境>环境</环境>'
    })
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
      appliedRegex: []
    })).toBe(true)
  })

  it('requires HTML only when the original card/source directly defines a mandatory HTML contract', () => {
    const contract = detectCommunityUiContract({
      character,
      lorebookPrompt: '每次回复严格遵守状态栏格式UI，不得省略。状态栏格式UI如下:<div><details><summary>状态</summary></details></div>'
    })
    expect(contract.mode).toBe('html-contract')
    expect(communityUiOutputConforms({ contract, rawText: '只是普通文本' })).toBe(false)
    expect(communityUiOutputConforms({ contract, rawText: '<div><details><summary>状态</summary></details></div>' })).toBe(true)
    expect(contract.exactHtmlTemplate).toContain('<details>')
    expect(buildCommunityUiPriorityPrompt(contract)).toContain('原卡 HTML 模板')
  })


  it('locally restores the original status HTML shell when AI already supplied status facts and body', () => {
    const contract = detectCommunityUiContract({
      character,
      lorebookPrompt: `每次回复必须携带状态栏格式UI。状态栏格式UI如下:
<div style="width:260px"><details><summary>状态信息</summary><div><div>📆年月日｜时间<br>🗺地点<br>😶在场角色<br>💛姿势<br>▪关系:关系<br>♥内心:心理</div></div></details><div><div>正文</div><div>这里是正文内容区域</div></div><details><summary>角色互动</summary><div><div>NPC占位</div></div></details><details><summary>场外观众席</summary><div><div>观众占位</div></div></details></div>`
    })
    const repaired = tryRepairCommunityUiLocally(contract, '📆3824年7月18｜7:00\n🗺后山菜园\n😶在场角色:测试角色；测试用户\n💛负手立于田埂\n▪关系:师徒\n♥内心:平静\n他垂眸看着你。')
    expect(repaired.repaired).toBe(true)
    expect(repaired.text).toContain('状态信息')
    expect(repaired.text).toContain('3824年7月18')
    expect(repaired.text).toContain('他垂眸看着你。')
    expect(repaired.text).not.toContain('NPC占位')
    expect(repaired.text).not.toContain('观众占位')
  })
  it('keeps all original-card tags untouched in card-first mode', () => {
    const text = '<日期>10月15日</日期><地点>公寓</地点>\n<scene_action>抬眼看你</scene_action>\n<companion_packet>{"messages":[]}</companion_packet>'
    expect(sanitizeCommunityUiText(text)).toBe(text)
  })
})
