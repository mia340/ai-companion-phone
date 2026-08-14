import { db } from './database'

export const DEFAULT_WORLD_ID = 'world-default'

/**
 * 初始化一个干净的本地世界。
 *
 * 不写入任何固定演示角色，也不伪造未读消息。
 * 新用户从空通讯录开始，自行创建或导入角色。
 */
export async function seedDatabase() {
  if (await db.worlds.count()) return

  const now = new Date().toISOString()

  await db.transaction(
    'rw',
    db.worlds,
    db.contactGroups,
    async () => {
      await db.worlds.add({
        id: DEFAULT_WORLD_ID,
        name: '草莓云世界',
        eventLevel: 'daily',
        paused: false,
        createdAt: now
      })

      await db.contactGroups.bulkAdd([
        {
          id: 'group-special',
          worldId: DEFAULT_WORLD_ID,
          name: '特别关心',
          order: 1
        },
        {
          id: 'group-unassigned',
          worldId: DEFAULT_WORLD_ID,
          name: '未分组',
          order: 2
        }
      ])
    }
  )
}
