import { z } from 'zod'
import {
  homeLayoutPagesSchema,
  normalizeHomeAppearance,
  type HomeAppearancePreferences
} from './appCustomizationService'

export const HOME_LAYOUT_BACKUP_FORMAT = 'ai-companion-home-layout' as const
export const HOME_LAYOUT_BACKUP_VERSION = 1 as const

const homeLayoutBackupSchema = z.object({
  format: z.literal(HOME_LAYOUT_BACKUP_FORMAT),
  version: z.literal(HOME_LAYOUT_BACKUP_VERSION),
  exportedAt: z.string().min(1),
  appearance: z.object({
    wallpaperDataUrl: z.string().optional(),
    iconScale: z.number().min(0.6).max(1.5),
    showAppLabels: z.boolean(),
    homeAppKeys: z.array(z.string()),
    homePageKeys: z.array(z.array(z.string())),
    homeLayoutPages: homeLayoutPagesSchema,
    dockAppKeys: z.array(z.string()).max(4),
    homeWidgetKeys: z.array(z.string()),
    widgetStyle: z.enum(['clear', 'frosted', 'solid']),
    themePreset: z.enum(['default', 'dark', 'clear', 'tinted']).default('default'),
    homeWidgetSettings: z.object({
      photo: z.object({ imageDataUrl: z.string().optional(), caption: z.string().optional() }).optional(),
      calendar: z.object({ startWeekOnMonday: z.boolean().optional() }).optional()
    }).default({}),
    homeLayoutRevision: z.number().int().nonnegative().default(0)
  })
})

export type HomeLayoutBackup = z.infer<typeof homeLayoutBackupSchema>

export function createHomeLayoutBackup(value: HomeAppearancePreferences): HomeLayoutBackup {
  const appearance = normalizeHomeAppearance(value)
  return homeLayoutBackupSchema.parse({
    format: HOME_LAYOUT_BACKUP_FORMAT,
    version: HOME_LAYOUT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appearance
  })
}

export function serializeHomeLayoutBackup(value: HomeAppearancePreferences) {
  return JSON.stringify(createHomeLayoutBackup(value), null, 2)
}

export function parseHomeLayoutBackup(text: string): HomeAppearancePreferences {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('桌面布局文件不是有效 JSON')
  }
  const result = homeLayoutBackupSchema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(`桌面布局文件不兼容：${issue?.message || '结构校验失败'}`)
  }
  return normalizeHomeAppearance(result.data.appearance)
}
