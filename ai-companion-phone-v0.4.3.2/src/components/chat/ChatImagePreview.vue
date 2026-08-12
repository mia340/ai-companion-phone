<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ images: string[]; currentIndex: number }>()
const emit = defineEmits<{
  'update:currentIndex': [index:number]
  close: []
  download: [url: string, index: number]
}>()

const currentImage = computed(() => props.images[props.currentIndex] || '')
const startX = ref<number>()
const startY = ref<number>()

function move(offset:number) {
  if (props.images.length <= 1) return
  emit('update:currentIndex', (props.currentIndex + offset + props.images.length) % props.images.length)
}
function key(event:KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowLeft') move(-1)
  if (event.key === 'ArrowRight') move(1)
}
function handlePointerDown(event: PointerEvent) {
  startX.value = event.clientX
  startY.value = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}
function handlePointerUp(event: PointerEvent) {
  if (startX.value === undefined || startY.value === undefined) return
  const dx = event.clientX - startX.value
  const dy = event.clientY - startY.value
  startX.value = undefined
  startY.value = undefined
  if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.2) move(dx < 0 ? 1 : -1)
}
function cancelPointer() {
  startX.value = undefined
  startY.value = undefined
}

onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <div v-if="currentImage" class="image-preview-backdrop" role="dialog" aria-modal="true" aria-label="聊天图片预览" @click.self="emit('close')">
    <div class="preview-toolbar">
      <button type="button" aria-label="保存当前图片" @click="emit('download',currentImage,currentIndex)">⇩</button>
      <span v-if="images.length>1">{{ currentIndex+1 }} / {{ images.length }}</span>
      <button type="button" aria-label="关闭预览" @click="emit('close')">×</button>
    </div>

    <button v-if="images.length>1" class="nav-button nav-button--left" type="button" aria-label="上一张" @click.stop="move(-1)">‹</button>
    <div class="preview-stage" @pointerdown="handlePointerDown" @pointerup="handlePointerUp" @pointercancel="cancelPointer">
      <img :src="currentImage" alt="聊天图片预览" draggable="false" />
    </div>
    <button v-if="images.length>1" class="nav-button nav-button--right" type="button" aria-label="下一张" @click.stop="move(1)">›</button>

    <div v-if="images.length>1" class="preview-thumbnails" aria-label="图片列表">
      <button v-for="(image,index) in images" :key="`${image.slice(-24)}-${index}`" type="button" :class="{active:index===currentIndex}" :aria-label="`查看第 ${index+1} 张图片`" @click="emit('update:currentIndex',index)">
        <img :src="image" alt="" draggable="false" />
      </button>
    </div>
    <small v-if="images.length>1" class="swipe-hint">左右滑动切换</small>
  </div>
</template>

<style scoped>
.image-preview-backdrop{position:absolute;z-index:60;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:70px 16px 88px;background:rgba(25,18,22,.93);backdrop-filter:blur(14px);touch-action:none}
.preview-toolbar{position:absolute;z-index:2;top:max(14px,env(safe-area-inset-top));left:14px;right:14px;display:flex;align-items:center;justify-content:space-between;color:#fff}
.preview-toolbar button,.nav-button{border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;backdrop-filter:blur(10px)}
.preview-toolbar button{width:40px;height:40px;font-size:24px}.preview-toolbar span{padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.12);font-size:12px}
.preview-stage{max-width:100%;max-height:100%;display:grid;place-items:center;touch-action:none}
.preview-stage img{max-width:100%;max-height:calc(100vh - 180px);object-fit:contain;border-radius:16px;box-shadow:0 22px 60px rgba(0,0,0,.34);user-select:none;-webkit-user-drag:none}
.nav-button{position:absolute;z-index:2;top:50%;width:40px;height:54px;transform:translateY(-50%);font-size:34px}.nav-button--left{left:8px}.nav-button--right{right:8px}
.preview-thumbnails{position:absolute;bottom:max(42px,calc(env(safe-area-inset-bottom) + 28px));left:12px;right:12px;display:flex;justify-content:center;gap:7px;overflow-x:auto;padding:4px;scrollbar-width:none}.preview-thumbnails::-webkit-scrollbar{display:none}
.preview-thumbnails button{width:46px;height:46px;flex:0 0 auto;padding:2px;overflow:hidden;border:2px solid transparent;border-radius:11px;background:rgba(255,255,255,.12);opacity:.58}.preview-thumbnails button.active{border-color:#fff;opacity:1;transform:translateY(-2px)}.preview-thumbnails img{width:100%;height:100%;object-fit:cover;border-radius:7px}
.swipe-hint{position:absolute;bottom:max(14px,env(safe-area-inset-bottom));color:rgba(255,255,255,.62);font-size:11px}
@media(max-width:390px){.nav-button{display:none}.image-preview-backdrop{padding-left:10px;padding-right:10px}.preview-stage img{max-height:calc(100vh - 190px)}}
</style>
