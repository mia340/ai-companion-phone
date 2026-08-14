import { db } from './database'

export const DEFAULT_WORLD_ID = 'world-default'

/**
 * 初始化一个干净的本地世界。
 *
 * 从 V0.4.3.7.5 起不再写入林夏 / 顾言 / 苏晚等演示角色，
 * 也不再伪造未读消息。新用户从空通讯录开始，自行创建或导入角色。
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
          id: 'group-friends',
          worldId: DEFAULT_WORLD_ID,
          name: '朋友',
          order: 2
        }
      ])
    }
  )
}
