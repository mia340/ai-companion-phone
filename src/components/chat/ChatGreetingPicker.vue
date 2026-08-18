<script setup lang="ts">
import { computed, type StyleValue } from 'vue'

const props = defineProps<{
  title: string
  greetings: string[]
  panelStyle?: StyleValue
  required?: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  free: []
  close: []
}>()

function preview(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{user\}\}/gi, '你')
    .replace(/\{\{char\}\}/gi, props.title)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const rows = computed(() => props.greetings.map((value, index) => ({
  value,
  index,
  label: index === 0 ? '默认开场' : `备用开场 ${index}`,
  preview: preview(value) || (index === 0 ? '角色卡默认开场 UI' : `备用开场 ${index}`)
})))
</script>

<template>
  <section class="greeting-panel" :style="panelStyle">
    <header>
      <div>
        <small>{{ title }}</small>
        <h2>选择开场白</h2>
      </div>
      <button v-if="!required" type="button" aria-label="关闭" @click="emit('close')">×</button>
    </header>

    <p class="greeting-tip">
      每一份新聊天都可以独立决定怎么开始。自由开局不会把 first_mes 写进聊天历史；角色设定、世界书、Preset 与 Regex 仍然照常使用。
    </p>

    <div class="greeting-list">
      <button type="button" class="greeting-card free-card" @click="emit('free')">
        <span>自由开局</span>
        <b>不使用任何开场白，从你的第一条消息开始建立当前场景。</b>
      </button>
      <button
        v-for="row in rows"
        :key="`${row.index}-${row.value.slice(0,24)}`"
        type="button"
        class="greeting-card"
        @click="emit('select', row.index)"
      >
        <span>{{ row.label }}</span>
        <b>{{ row.preview }}</b>
      </button>
    </div>
  </section>
</template>

<style scoped>
.greeting-panel{position:absolute;left:0;right:0;bottom:0;display:grid;gap:14px;max-height:min(78vh,720px);padding:20px 18px calc(22px + env(safe-area-inset-bottom));overflow:auto;border-radius:28px 28px 0 0;background:#f9fcff;box-shadow:0 -18px 45px rgba(62,93,132,.13);color:#40546b}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}header small{color:#7899bd;font-size:12px}h2{margin:4px 0 0;font-size:27px;line-height:1.15}header button{width:42px;height:42px;border:0;border-radius:50%;background:#edf5fd;color:#587596;font-size:26px}.greeting-tip{margin:0;padding:12px 14px;border-radius:15px;background:#edf6ff;color:#6f88a4;font-size:12px;line-height:1.6}.greeting-list{display:grid;gap:10px}.greeting-card{display:grid;gap:7px;width:100%;padding:14px 15px;border:1px solid #d8e8f7;border-radius:17px;background:#fff;text-align:left;color:#40546b;box-shadow:0 6px 18px rgba(65,94,130,.05)}.greeting-card:active{transform:scale(.99)}.greeting-card span{color:#6f9fce;font-size:12px;font-weight:850}.greeting-card b{display:-webkit-box;overflow:hidden;color:#40546b;font-size:14px;font-weight:650;line-height:1.65;-webkit-box-orient:vertical;-webkit-line-clamp:5;white-space:pre-wrap}
.free-card{background:#f3f9ff;border-style:dashed}
</style>
