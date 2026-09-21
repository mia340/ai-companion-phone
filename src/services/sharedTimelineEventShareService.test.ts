import { describe, expect, it } from 'vitest'
import { buildSharedTimelineChatShare, mergeTimelineShareIntoDraft } from './sharedTimelineEventShareService'
import type { SharedTimelineEvent } from './sharedTimelineEventService'
const event:SharedTimelineEvent={id:'event-1',evidenceKey:'k',worldId:'w',characterId:'c',title:'一起看雪',summary:'约好冬天去看雪',occurredAt:'2026-01-01',startedAt:'2026-01-01',endedAt:'2026-01-01',itemIds:['m1','s1'],items:[{id:'m1',worldId:'w',sourceKind:'memory',sourceId:'m1',conversationId:'conv-1',title:'x',summary:'x',occurredAt:'2026-01-01',sourceLabel:'记忆',sourceRoute:'',importance:1,starred:false,hidden:false}],sourceKinds:['memory'],sourceLabels:['记忆'],mediaPreviewUrls:[],primaryRoute:'',importance:1,starred:false,hidden:false,manual:false}
describe('sharedTimelineEventShareService',()=>{
 it('使用真实 conversationId',()=>expect(buildSharedTimelineChatShare(event)?.conversationId).toBe('conv-1'))
 it('携带 event provenance',()=>expect(buildSharedTimelineChatShare(event)?.draft).toContain('event:event-1'))
 it('携带全部 evidence ids',()=>expect(buildSharedTimelineChatShare(event)?.draft).toContain('m1, s1'))
 it('无会话来源时拒绝分享',()=>expect(buildSharedTimelineChatShare({...event,items:[]})).toBeUndefined())
 it('空草稿直接采用事件引用',()=>expect(mergeTimelineShareIntoDraft('',buildSharedTimelineChatShare(event)!)).toContain('一起看雪'))
 it('已有时光引用不会重复注入',()=>{const s=buildSharedTimelineChatShare(event)!; expect(mergeTimelineShareIntoDraft(s.draft,s)).toBe(s.draft)})
})
