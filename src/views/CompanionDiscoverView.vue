<script setup lang="ts">
import { liveQuery } from 'dexie'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'

const router = useRouter()
const unread = ref(0)
let subscription: { unsubscribe: () => void } | undefined
onMounted(() => {
  subscription = liveQuery(async () => {
    const world = (await db.worlds.toArray())[0]
    return db.socialNotifications.where('worldId').equals(world?.id || 'world-default').filter(item => !item.read).count()
  }).subscribe(count => { unread.value = count })
})
onUnmounted(() => subscription?.unsubscribe())
</script>

<template>
  <PhoneFrame title="发现">
    <section class="discover-page">
      <button type="button" class="discover-row" @click="router.push('/app/朋友圈')">
        <span class="moment-icon" aria-hidden="true">✿</span>
        <span>朋友圈</span>
        <span v-if="unread" class="unread" aria-label="未读互动">{{ unread > 99 ? '99+' : unread }}</span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>
      <div class="discover-quiet" aria-hidden="true"><span>生活很大</span><span>值得慢慢发现</span><i></i></div>
    </section>
  </PhoneFrame>
</template>
<style scoped>
.discover-page{min-height:100%;padding:16px 0;background:#f5f7f9;color:#273b4d}
.discover-row{display:flex;align-items:center;width:100%;min-height:60px;padding:13px 20px;gap:15px;text-align:left;background:#fff;border:0;font-size:16px;cursor:pointer;color:inherit}
.moment-icon{color:#12b968;font-size:26px;width:28px;text-align:center}.chevron{margin-left:auto;color:#a4b0bc;font-size:24px;font-weight:300}.unread{display:grid;place-items:center;margin-left:auto;padding:0 5px;min-width:19px;height:19px;border-radius:10px;color:#fff;background:#eb5362;font:11px/19px sans-serif}.unread+.chevron{margin-left:0}
.discover-quiet{min-height:360px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#8ea1af;font-size:14px;letter-spacing:.22em;background:radial-gradient(55% 24% at 88% 54%,rgba(210,234,249,.58),transparent 70%),radial-gradient(50% 20% at 12% 74%,rgba(221,240,251,.5),transparent 74%)}.discover-quiet i{width:20px;height:1px;margin-top:5px;background:#9cafbb}
</style>
