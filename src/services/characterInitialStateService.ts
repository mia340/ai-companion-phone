function normalizeOpeningText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function cleanFieldValue(value?: string, maxLength = 80) {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[。.!！]+$/, '')
    .trim()
    .slice(0, maxLength)
}

/**
 * 从作者开场中提取明确的“当前活动/动作”字段。
 * 这里只读取显式结构，不根据角色类型或角色名猜测状态。
 */
export function inferCardInitialActivity(opening?: string) {
  if (!opening?.trim()) return ''
  const source = normalizeOpeningText(opening)

  const xml = source.match(
    /<(?:活动|当前活动|动作|action|activity|current[_ -]?activity|current[_ -]?action)>\s*([\s\S]{1,100}?)\s*<\/(?:活动|当前活动|动作|action|activity|current[_ -]?activity|current[_ -]?action)>/i
  )?.[1]
  if (xml) return cleanFieldValue(xml, 80)

  const plain = source
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n{2,}/g, '\n')
  const explicit = plain.match(
    /(?:^|\n)\s*(?:💛|🎬|活动|当前活动|动作|action|activity|current[_ -]?activity|current[_ -]?action)\s*[:：=]?\s*([^\n]{1,100})/i
  )?.[1]

  return cleanFieldValue(explicit, 80)
}

/**
 * 从作者开场中提取明确的关系字段。没有字段就返回空字符串，
 * 不用“朋友/陌生人”等应用默认值替作者做决定。
 */
export function inferCardInitialRelationship(opening?: string) {
  if (!opening?.trim()) return ''
  const source = normalizeOpeningText(opening)

  const xml = source.match(
    /<(?:关系|关系状态|relationship|relation)>\s*([\s\S]{1,50}?)\s*<\/(?:关系|关系状态|relationship|relation)>/i
  )?.[1]
  if (xml) return cleanFieldValue(xml, 40)

  const plain = source.replace(/<[^>]+>/g, '\n')
  const explicit = plain.match(
    /(?:^|\n)\s*[▪•·\-]?\s*(?:关系|关系状态|relationship|relation)\s*[:：=]\s*([^\n<]{1,50})/i
  )?.[1]

  return cleanFieldValue(explicit, 40)
}
