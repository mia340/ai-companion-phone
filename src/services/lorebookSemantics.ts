import type { LorebookEntry } from '../types/domain'
import { looksLikeMandatoryPerReplyContract } from './resourceIntentRouter'

export type InitialLorebookEntryMode = 'mandatory' | 'constant' | 'keyword' | 'none'

/**
 * 初始扫描的基础激活语义；Focus / Sticky / Cooldown / Delay 仍由运行时上层处理。
 *
 * 兼容策略：
 * - CCv3 规范中 use_regex=true 时，keys 采用 Regex 匹配，constant 应被忽略。
 * - 但社区中存在大量“constant=true + use_regex=true + keys=[]”的旧导出；严格照规范会让整本卡失效。
 *   对这种没有可执行 Regex key 的矛盾数据，保留 constant 作为兼容兜底，并在导入/Debug 层提示。
 */
export function initialLorebookEntryMode(entry: LorebookEntry): InitialLorebookEntryMode {
  if (!entry.enabled) return 'none'
  if (!entry.keywords.length && looksLikeMandatoryPerReplyContract(entry)) return 'mandatory'
  if (entry.useRegex && entry.keywords.length) return 'keyword'
  if (entry.constant) return 'constant'
  if (entry.keywords.length) return 'keyword'
  return 'none'
}
