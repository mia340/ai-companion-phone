import { db } from './database'
import type {
  Character,
  MomentPost
} from '../types/domain'

export const DEFAULT_WORLD_ID = 'world-default'

const MINUTE = 60 * 1000

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * MINUTE).toISOString()
}

interface SampleCharacterSeed {
  id: string
  name: string
  avatar: string
  gender: 'female' | 'male'
  age: number
  identity: string
  persona: string
  speakingStyle?: string
  background?: string
  relationship: string
  mood: string
  activity: string
  likes?: string[]
  dislikes?: string[]
}

const SAMPLE_CHARACTERS: SampleCharacterSeed[] = [
  {
    id: 'char-demo-xingxing',
    name: '星星',
    avatar: '🌻',
    gender: 'female',
    age: 21,
    identity: '大学社团的元气担当，爱笑也爱拍照',
    persona: '活泼热情、精力充沛的大学生，像小太阳一样自来熟；有点小迷糊，偶尔忘东忘西，但待人真诚。',
    speakingStyle: '爱用感叹号和 emoji，语气轻快、元气满满，偶尔撒个娇。',
    relationship: '在社团认识的好朋友，最近走得挺近',
    mood: '今天心情像大晴天，兴奋得藏不住',
    activity: '在社团活动室剪海报、偷看窗外的晚霞',
    likes: ['奶茶', '小猫', '拍天空', '社团活动'],
    dislikes: ['下雨忘带伞', '香菜', '早起']
  },
  {
    id: 'char-demo-ache',
    name: '阿澈',
    avatar: '🍃',
    gender: 'male',
    age: 23,
    identity: '住在隔壁的温柔学长，生活很规律',
    persona: '温柔沉稳、话不多但很会照顾人；有轻微强迫症，桌面和阳台都收拾得整整齐齐。',
    speakingStyle: '语气平静温和，关心人会藏在细节里，很少说肉麻的话。',
    relationship: '青梅竹马式的邻居，暗地里很在意你',
    mood: '平静，像傍晚的风',
    activity: '在阳台给新种的薄荷浇水',
    likes: ['绿植', '手冲咖啡', '傍晚散步', '做简单料理'],
    dislikes: ['嘈杂的酒吧', '深夜消息轰炸', '油腻外卖']
  },
  {
    id: 'char-demo-wantang',
    name: '晚棠',
    avatar: '🎨',
    gender: 'female',
    age: 24,
    identity: '自由插画师，表面高冷实则心软',
    persona: '外冷内热的傲娇，嘴硬心软；赶稿时会烦躁，但对在意的人很护短，养了一只叫「咸鱼」的橘猫。',
    speakingStyle: '冷淡里带点傲娇，偶尔毒舌，对熟人才会露出别扭的关心。',
    relationship: '从小一起长大的傲娇损友，互怼但很铁',
    mood: '新连载卡分镜，有点烦躁',
    activity: '在画新连载的插画，已经泡了第三杯咖啡',
    likes: ['黑咖啡', '下雨天', '画猫', '凌晨安静'],
    dislikes: ['催稿', '太甜腻的东西', '被人唠叨睡觉']
  },
  {
    id: 'char-demo-suli',
    name: '苏栗',
    avatar: '🍰',
    gender: 'female',
    age: 22,
    identity: '巷口甜品店老板，温柔又治愈',
    persona: '细心耐心，说话轻声细语，总想把身边的人喂胖；记得每个熟客的口味和近况。',
    speakingStyle: '温柔和缓，常挂在嘴边的是「累不累」「要不要尝尝新品」。',
    relationship: '常去她店里买甜品的熟客，被她当妹妹照顾',
    mood: '踏实又满足',
    activity: '在烤明天要卖的肉桂卷',
    likes: ['烘焙', '柚子茶', '给朋友投喂', '雨后的街道'],
    dislikes: ['浪费食物', '太甜的奶油', '关店太晚']
  }
]

function buildCharacter(seed: SampleCharacterSeed, index: number): Character {
  const createdAt = isoMinutesAgo(60 * 24 * (6 - index))
  return {
    id: seed.id,
    worldId: DEFAULT_WORLD_ID,
    name: seed.name,
    avatar: seed.avatar,
    gender: seed.gender,
    age: seed.age,
    identity: seed.identity,
    persona: seed.persona,
    speakingStyle: seed.speakingStyle,
    background: seed.background,
    relationship: seed.relationship,
    mood: seed.mood,
    activity: seed.activity,
    likes: seed.likes,
    dislikes: seed.dislikes,
    replySpeed: 'natural',
    createdAt,
    updatedAt: createdAt
  }
}

/** 示例角色首屏用的几条手工动态：让朋友圈一打开就有内容，不需要先配 AI。 */
function buildSampleMoments(): MomentPost[] {
  const rows: Array<{
    characterId: string
    minutesAgo: number
    content: string
    likeCount: number
  }> = [
    {
      characterId: 'char-demo-xingxing',
      minutesAgo: 22,
      content: '社团活动室今天的晚霞也太犯规了吧🌇 一边剪海报一边偷看了八百次窗外…有人想拼奶茶吗！',
      likeCount: 2
    },
    {
      characterId: 'char-demo-ache',
      minutesAgo: 14,
      content: '阳台上新来的薄荷终于活过来了，掐了一片泡水。夏天好像快过去了，晚上散步记得加件薄外套。',
      likeCount: 1
    },
    {
      characterId: 'char-demo-wantang',
      minutesAgo: 5,
      content: '新连载卡在分镜，泡了今天第三杯咖啡。别劝我睡觉，劝我也没用。……不过楼下猫今天肯让我摸了，勉强算回血。',
      likeCount: 3
    }
  ]

  return rows.map((row, index) => {
    const createdAt = isoMinutesAgo(row.minutesAgo)
    return {
      id: `moment-demo-${index + 1}`,
      worldId: DEFAULT_WORLD_ID,
      authorType: 'character' as const,
      authorId: row.characterId,
      content: row.content,
      likeCount: row.likeCount,
      likedByMe: false,
      source: 'manual' as const,
      createdAt,
      updatedAt: createdAt
    }
  })
}

/**
 * 初始化本地世界与示例人物。
 *
 * 世界：仅当本地还没有任何世界时创建「草莓云世界」。
 * 示例人物：只在“数据库原本没有任何世界”的真正首次启动灌入 4 位示例角色与 3 条现成朋友圈。
 * 已经使用过 App 的库即使后来删光角色，也不会在下一次启动时复活示例角色。
 */
export async function seedDatabase() {
  const now = new Date().toISOString()
  const hadWorldBeforeSeed = (await db.worlds.count()) > 0

  await db.transaction('rw', db.worlds, db.characters, db.momentPosts, async () => {
    if (!hadWorldBeforeSeed) {
      await db.worlds.add({
        id: DEFAULT_WORLD_ID,
        name: '草莓云世界',
        eventLevel: 'daily',
        paused: false,
        createdAt: now
      })
    }

    // 示例数据只属于“第一次打开的全新库”。如果用户已经使用过 App，
    // 即使后来主动删光角色，也不能在下次启动时把 demo 角色复活回来。
    if (hadWorldBeforeSeed || (await db.characters.count()) > 0) return

    const characters = SAMPLE_CHARACTERS.map(buildCharacter)
    await db.characters.bulkAdd(characters)
    const sampleMoments = buildSampleMoments()
    if (sampleMoments.length) {
      await db.momentPosts.bulkAdd(sampleMoments)
    }
  })
}
