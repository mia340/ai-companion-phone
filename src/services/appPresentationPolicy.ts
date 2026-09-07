/**
 * 独立 App 的 AI 输出边界。
 *
 * Chat 是唯一允许社区卡作者接管 Presentation 的 Surface；朋友圈、音乐、游戏等
 * 已经拥有本地 Vue 界面，因此模型只负责“内容”，不再生成第二层 HTML/UI。
 */
export const NATIVE_APP_TEXT_ONLY_RULE =
  '当前内容会由 App 原生界面负责排版。禁止输出 HTML、XML、CSS、Markdown 卡片、状态栏、按钮、表格、代码围栏或任何界面代码；只输出题目要求的自然语言内容。'

/**
 * 把模型误生成的展示层标记降级为纯文本。
 * 保留括号动作/心理、普通标点与 emoji；只移除“界面代码/富文本壳”。
 */
export function stripGeneratedPresentationMarkup(raw: string): string {
  return String(raw ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/```(?:html|xml|css|javascript|js|tsx?|vue|markdown|md)?/gi, ' ')
    .replace(/```/g, ' ')
    .replace(/<\/?[A-Za-z][^>]{0,500}>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
}

/** 去掉轻量 Markdown 外壳，但不碰自然语言里的括号动作/心理描写。 */
export function stripLightMarkdown(raw: string): string {
  return String(raw ?? '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•·]\s+/gm, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
}

export function sanitizeNativeAppText(
  raw: string,
  options?: { singleLine?: boolean }
): string {
  let text = stripLightMarkdown(stripGeneratedPresentationMarkup(raw)).trim()
  if (options?.singleLine) {
    text = text.replace(/[\r\n\t]+/g, ' ').replace(/[ \u3000]{2,}/g, ' ')
  }
  return text.trim()
}
