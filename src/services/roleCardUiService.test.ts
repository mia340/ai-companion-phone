import { describe, expect, it } from 'vitest'
import { extractRoleCardUiHints, inferPresenceFromRoleCardScene, parseRoleCardUi, resolvePresenceFromRoleCardScene, roleCardUiToConversationPatch } from './roleCardUiService'

describe('role card UI compatibility', () => {
  it('parses brace UI and scene presence', () => {
    const source = '{日期:2017-6-9|时间:晚上}\\n{地点:主卧}\\n{内心:想抱她}\\n{周围:用户在场}\\n{待办:1.休息.2.拍摄}\\n\\n（将你揽进怀里）我也没睡。'
    const parsed = parseRoleCardUi(source)
    const patch = roleCardUiToConversationPatch(parsed.content, parsed.ui)
    expect(parsed.ui?.location).toBe('主卧')
    expect(patch.presence).toBe('together')
    expect(patch.shortTermGoals).toHaveLength(2)
  })

  it('extracts pipe-style Tavo status without removing raw text', () => {
    const source = '[角色]\\n时间 | 3055年6月5日 18:30\\n地点 | 府邸·卧室\\n心声 | 她还没睡\\n正文 | 你好\\n[/角色]'
    const hints = extractRoleCardUiHints(source)
    expect(hints?.time).toContain('3055年6月5日')
    expect(hints?.location).toBe('府邸·卧室')
    expect(inferPresenceFromRoleCardScene('（把你抱进怀里）', hints)).toBe('together')
  })

  it('lets direct physical contact override a remote/alone conflict', () => {
    const source = '{地点:清溪别墅主卧}\n{周围:独处}\n<scene_action perspective="remote">撑起身子，把脸埋进你颈窝里，低低地笑</scene_action>'
    const parsed = parseRoleCardUi(source)
    const resolution = resolvePresenceFromRoleCardScene(parsed.content, parsed.ui, 'remote')
    expect(resolution.resolvedPresence).toBe('together')
    expect(resolution.conflict).toBe(true)
    expect(resolution.source).toBe('direct-contact')
  })

})

it('不会把普通“把你/将你”语句误判为身体接触', () => {
  expect(resolvePresenceFromRoleCardScene('我会把你介绍给导演。', undefined, 'remote').resolvedPresence).toBe('remote')
  expect(resolvePresenceFromRoleCardScene('我将你说的话记下来了。', undefined, 'remote').resolvedPresence).toBe('remote')
})

it('识别“把你圈进怀里 / 拍你的后背”为直接接触', () => {
  const result = resolvePresenceFromRoleCardScene('把你圈进怀里，轻轻拍了下你的后背。', undefined, 'remote')
  expect(result.resolvedPresence).toBe('together')
  expect(result.conflict).toBe(true)
})

it('识别 Tavo emoji 状态栏与 XML 日期地点提示', () => {
  const emoji = extractRoleCardUiHints('📆太初历3824年7月18｜7:00｜晨光熹微 <br>🗺天枢山后山菜园<br>💛负手立于田埂<br>♥内心:看她刨地瓜')
  expect(emoji?.date).toBe('太初历3824年7月18')
  expect(emoji?.time).toBe('7:00')
  expect(emoji?.location).toBe('天枢山后山菜园')

  const xml = extractRoleCardUiHints('<日期>12月21日</日期><时间>05:45</时间><地点>军区大院主卧</地点>')
  expect(xml?.date).toBe('12月21日')
  expect(xml?.time).toBe('05:45')
  expect(xml?.location).toBe('军区大院主卧')
})

it('V0.4.4.6 识别人物与相对位置结构化字段中的同场 Persona', () => {
  const source = `📅日期：2024年7月15日-周
⏰时间：17:27
🏢地点：我就职的公司楼下
🚶人物：我，测试角色，大门保安
👉相对位置：我站在写字楼大门口(刚出来)，测试角色站在我面前，撑着伞遮过我头顶`
  const hints = extractRoleCardUiHints(source)
  expect(hints?.participants).toContain('我')
  expect(hints?.relativePosition).toContain('站在我面前')
  const resolved = resolvePresenceFromRoleCardScene(source, hints, undefined, ['我'])
  expect(resolved.resolvedPresence).toBe('together')
  expect(resolved.source).toBe('ui-surroundings')
})

it('V0.4.4.7 作者文本状态头兼容 Unicode 冒号并去掉右侧方括号', () => {
  const hints = extractRoleCardUiHints(`【地点∶北京｜酒吧】
【时间∶2025年4月16日，星期三，23∶00】
【季节∶春天】
【天气∶细雨】
【内心∶陌生人都能这么熟练搭讪】`)
  expect(hints?.location).toBe('北京｜酒吧')
  expect(hints?.time).toBe('2025年4月16日，星期三，23∶00')
  expect(hints?.inner).toBe('陌生人都能这么熟练搭讪')
})
