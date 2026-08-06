import { describe, expect, it } from 'vitest'
import { parseCharacterCardJson } from './characterCardImportService'

describe('character card import', () => {
  it('imports SillyTavern V2 JSON', () => {
    const result = parseCharacterCardJson(JSON.stringify({
      spec: 'chara_card_v2',
      data: {
        name: '顾言',
        personality: '克制，慢热',
        description: '身份：医生',
        first_mes: '还没睡？',
        mes_example: '{{user}}: 你想我吗？\n{{char}}: ……你觉得呢。',
        creator: 'tester'
      }
    }))
    expect(result.format).toBe('sillytavern-v2')
    expect(result.patch.name).toBe('顾言')
    expect(result.patch.exampleDialogues?.length).toBe(1)
  })
})
