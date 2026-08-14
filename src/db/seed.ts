import { db } from './database'

export const DEFAULT_WORLD_ID = 'world-default'

/**
 * 初始化一个干净的本地世界。
 *
 * 不写入固定演示角色、通讯录分组或伪造未读消息。
 * 新用户从空通讯录开始，自行创建 / 导入角色，并在共享资源库里选择 WorldBook / Regex / Preset。
 */
export async function seedDatabase() {
  if (await db.worlds.count()) return

  const now = new Date().toISOString()

  await db.worlds.add({
    id: DEFAULT_WORLD_ID,
    name: '草莓云世界',
    eventLevel: 'daily',
    paused: false,
    createdAt: now
  })
}
