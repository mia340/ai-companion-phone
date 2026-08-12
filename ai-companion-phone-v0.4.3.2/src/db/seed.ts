import { db } from './database'

export const DEFAULT_WORLD_ID = 'world-default'

export async function seedDatabase() {
  if (await db.worlds.count()) return

  const now = new Date().toISOString()

  await db.transaction(
    'rw',
    db.worlds,
    db.characters,
    db.contactGroups,
    db.conversations,
    db.messages,
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

      await db.characters.bulkAdd([
        {
          id: 'char-lin',
          worldId: DEFAULT_WORLD_ID,

          name: '林夏',
          nickname: '夏夏',
          avatar: '🌸',
          gender: 'female',
          age: 24,
          identity: '花店店主',

          relationship: '挚友',
          persona: '温柔、细腻、会主动关心你。',
          speakingStyle: '语气温柔自然，喜欢分享生活中的小事。',
          background:
            '经营着一家安静的小花店，喜欢记录天气和花期。',
          likes: ['鲜花', '甜品', '雨天', '散步'],
          dislikes: ['冷漠', '失约', '激烈争吵'],

          mood: '有点想你',
          activity: '刚结束下午茶',

          groups: ['group-special', 'group-friends'],
          replySpeed: 'natural',

          createdAt: now,
          updatedAt: now
        },
        {
          id: 'char-gu',
          worldId: DEFAULT_WORLD_ID,

          name: '顾言',
          avatar: '🫧',
          gender: 'male',
          age: 27,
          identity: '自由撰稿人',

          relationship: '朋友',
          persona: '安静、克制，偶尔毒舌。',
          speakingStyle: '表达简洁，很少使用表情，偶尔冷幽默。',
          background:
            '经常在书店和咖啡馆写作，不太擅长直接表达关心。',
          likes: ['阅读', '咖啡', '安静的地方'],
          dislikes: ['喧闹', '虚伪', '被人催促'],

          mood: '平静',
          activity: '在书店看书',

          groups: ['group-friends'],
          replySpeed: 'natural',

          createdAt: now,
          updatedAt: now
        }
      ])

      await db.conversations.bulkAdd([
        {
          id: 'conv-lin',
          worldId: DEFAULT_WORLD_ID,
          type: 'single',
          title: '林夏',
          memberIds: ['char-lin'],
          pinned: true,
          muted: false,
          unread: 2,
          updatedAt: now
        },
        {
          id: 'conv-gu',
          worldId: DEFAULT_WORLD_ID,
          type: 'single',
          title: '顾言',
          memberIds: ['char-gu'],
          pinned: false,
          muted: false,
          unread: 0,
          updatedAt: now
        }
      ])

      await db.messages.bulkAdd([
        {
          id: crypto.randomUUID(),
          worldId: DEFAULT_WORLD_ID,
          conversationId: 'conv-lin',
          senderId: 'char-lin',
          type: 'text',
          content:
            '你终于回来啦，我刚刚还在想今天要不要主动找你。',
          status: 'delivered',
          createdAt: now
        },
        {
          id: crypto.randomUUID(),
          worldId: DEFAULT_WORLD_ID,
          conversationId: 'conv-gu',
          senderId: 'char-gu',
          type: 'text',
          content:
            '书店今天很安静。看到一本书，感觉你会喜欢。',
          status: 'read',
          createdAt: now
        }
      ])
    }
  )
}