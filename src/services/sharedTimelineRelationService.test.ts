import { describe, expect, it } from 'vitest'
import { relateSharedTimelineEvents, relatedSharedTimelineEvents } from './sharedTimelineRelationService'
import type { SharedTimelineEvent } from './sharedTimelineEventService'
const e=(id:string,date:string,char='c',kind:'memory'|'moment'='memory'):SharedTimelineEvent=>({id,evidenceKey:id,worldId:'w',characterId:char,title:id,summary:id,occurredAt:date,startedAt:date,endedAt:date,itemIds:[id],items:[],sourceKinds:[kind],sourceLabels:['x'],mediaPreviewUrls:[],primaryRoute:'',importance:1,starred:false,hidden:false,manual:false})
describe('sharedTimelineRelationService',()=>{
 it('同一天形成强关系',()=>expect(relateSharedTimelineEvents([e('a','2026-01-01'),e('b','2026-01-01')])[0].kind).toBe('same-day'))
 it('不同角色绝不关联',()=>expect(relateSharedTimelineEvents([e('a','2026-01-01','a'),e('b','2026-01-01','b')])).toHaveLength(0))
 it('两周内同来源形成 continuation',()=>expect(relateSharedTimelineEvents([e('a','2026-01-01'),e('b','2026-01-08')])[0].kind).toBe('continuation'))
 it('远距离普通同角色不进入图',()=>expect(relateSharedTimelineEvents([e('a','2026-01-01'),e('b','2026-03-01')])).toHaveLength(0))
 it('related 返回另一事件',()=>expect(relatedSharedTimelineEvents('a',[e('a','2026-01-01'),e('b','2026-01-02')])[0].event.id).toBe('b'))
 it('limit 生效',()=>expect(relatedSharedTimelineEvents('a',[e('a','2026-01-01'),e('b','2026-01-02'),e('c','2026-01-03')],1)).toHaveLength(1))
})
