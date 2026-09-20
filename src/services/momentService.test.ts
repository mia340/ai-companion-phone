import { describe, expect, it } from 'vitest'

import {
  applyExternalLike,
  applyLikeToggle,
  isValidMomentContent,
  normalizeMomentContent,
  normalizeMomentImages,
  sortMomentPostsDesc
} from './momentService'

import type { MomentPost } from '../types/domain'

function makePost(
  overrides: Partial<MomentPost> = {}
): MomentPost {
  return {
    id: 'post-1',
    worldId: 'world-default',
    authorType: 'character',
    authorId: 'char-1',
    content: '测试动态',
    likeCount: 0,
    likedByMe: false,
    source: 'ai',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides
  }
}

describe('normalizeMomentContent', () => {
  it('把折行与连续空白压成单个空格', () => {
    expect(normalizeMomentContent('今天  天气\n\n  很好\t啊'))
      .toBe('今天 天气 很好 啊')
  })

  it('把全角空格也压平', () => {
    expect(normalizeMomentContent('第一段　　第二段'))
      .toBe('第一段 第二段')
  })

  it('去掉首尾空白', () => {
    expect(normalizeMomentContent('  你好，世界。  '))
      .toBe('你好，世界。')
  })

  it('空串与纯空白归一到空串', () => {
    expect(normalizeMomentContent('')).toBe('')
    expect(normalizeMomentContent('   \n\t ')).toBe('')
  })

  it('超过上限时截断到 max 字符', () => {
    expect(normalizeMomentContent('哈哈哈哈哈哈', 4)).toBe('哈哈哈哈')
  })
})

describe('isValidMomentContent', () => {
  it('正常内容视为有效', () => {
    expect(isValidMomentContent('今天也很开心')).toBe(true)
  })

  it('空串 / 纯空白 / 折行视为无效', () => {
    expect(isValidMomentContent('')).toBe(false)
    expect(isValidMomentContent('   ')).toBe(false)
    expect(isValidMomentContent('\n\n\t  ')).toBe(false)
  })
})


describe('normalizeMomentImages', () => {
  it('只保留 data:image 静态图片并默认最多 4 张', () => {
    const images = Array.from({ length: 6 }, (_, index) => ({
      dataUrl: `data:image/png;base64,${index}`,
      name: `图${index}.png`,
      width: 100,
      height: 80,
      bytes: 123
    }))
    expect(normalizeMomentImages(images)).toHaveLength(4)
    expect(normalizeMomentImages(images).map(item => item.name))
      .toEqual(['图0.png', '图1.png', '图2.png', '图3.png'])
  })

  it('拒绝任意远程 URL / 非图片 data URL', () => {
    expect(normalizeMomentImages([
      { dataUrl: 'https://example.com/a.jpg' },
      { dataUrl: 'data:text/html;base64,abc' },
      { dataUrl: 'data:image/jpeg;base64,abc', width: 10.4, height: 20.6 }
    ])).toEqual([
      { dataUrl: 'data:image/jpeg;base64,abc', name: undefined, width: 10, height: 21, bytes: undefined }
    ])
  })
})

describe('applyExternalLike', () => {
  it('角色点赞只增加总赞数，不改变我自己的点赞状态', () => {
    const post = makePost({ likeCount: 2, likedByMe: false })
    const next = applyExternalLike(post)
    expect(next.likeCount).toBe(3)
    expect(next.likedByMe).toBe(false)
  })

  it('异常负数不会把赞数扣回去', () => {
    const post = makePost({ likeCount: 2 })
    expect(applyExternalLike(post, -3).likeCount).toBe(2)
  })
})

describe('applyLikeToggle', () => {
  it('未赞时点赞：likedByMe=true 且计数 +1', () => {
    const post = makePost({ likeCount: 3, likedByMe: false })
    const next = applyLikeToggle(post)
    expect(next.likedByMe).toBe(true)
    expect(next.likeCount).toBe(4)
  })

  it('已赞时取消：likedByMe=false 且计数 -1', () => {
    const post = makePost({ likeCount: 3, likedByMe: true })
    const next = applyLikeToggle(post)
    expect(next.likedByMe).toBe(false)
    expect(next.likeCount).toBe(2)
  })

  it('计数不会低于 0', () => {
    const post = makePost({ likeCount: 0, likedByMe: true })
    const next = applyLikeToggle(post)
    expect(next.likedByMe).toBe(false)
    expect(next.likeCount).toBe(0)
  })

  it('返回新对象，不改动入参', () => {
    const post = makePost()
    const next = applyLikeToggle(post)
    expect(next).not.toBe(post)
    expect(post.likedByMe).toBe(false)
    expect(post.likeCount).toBe(0)
  })
})

describe('sortMomentPostsDesc', () => {
  it('按发布时间倒序排列', () => {
    const posts = [
      makePost({ id: 'old', createdAt: '2026-09-01T10:00:00.000Z' }),
      makePost({ id: 'new', createdAt: '2026-09-03T10:00:00.000Z' }),
      makePost({ id: 'mid', createdAt: '2026-09-02T10:00:00.000Z' })
    ]
    expect(sortMomentPostsDesc(posts).map(post => post.id))
      .toEqual(['new', 'mid', 'old'])
  })

  it('不改动原数组顺序', () => {
    const posts = [
      makePost({ id: 'a', createdAt: '2026-09-01T10:00:00.000Z' }),
      makePost({ id: 'b', createdAt: '2026-09-03T10:00:00.000Z' })
    ]
    sortMomentPostsDesc(posts)
    expect(posts.map(post => post.id)).toEqual(['a', 'b'])
  })
})
