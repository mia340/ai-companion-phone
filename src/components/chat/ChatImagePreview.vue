<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
const props = defineProps<{ images: string[]; currentIndex: number }>()
const emit = defineEmits<{ 'update:currentIndex': [index:number]; close: [] }>()
const currentImage = computed(() => props.images[props.currentIndex] || '')
function move(offset:number){ if(props.images.length<=1)return; emit('update:currentIndex',(props.currentIndex+offset+props.images.length)%props.images.length) }
function key(event:KeyboardEvent){ if(event.key==='Escape')emit('close'); if(event.key==='ArrowLeft')move(-1); if(event.key==='ArrowRight')move(1) }
onMounted(()=>window.addEventListener('keydown',key)); onUnmounted(()=>window.removeEventListener('keydown',key))
</script>
<template>
  <div v-if="currentImage" class="image-preview-backdrop" @click.self="emit('close')">
    <button class="close-button" type="button" @click="emit('close')">×</button>
    <button v-if="images.length>1" class="nav-button nav-button--left" type="button" @click.stop="move(-1)">‹</button>
    <img :src="currentImage" alt="聊天图片预览" />
    <button v-if="images.length>1" class="nav-button nav-button--right" type="button" @click.stop="move(1)">›</button>
    <div v-if="images.length>1" class="preview-counter">{{ currentIndex+1 }} / {{ images.length }}</div>
  </div>
</template>
<style scoped>
.image-preview-backdrop{position:absolute;z-index:60;inset:0;display:grid;place-items:center;padding:18px;background:rgba(25,18,22,.91);backdrop-filter:blur(14px)}.image-preview-backdrop img{max-width:100%;max-height:86%;object-fit:contain;border-radius:18px;box-shadow:0 22px 60px rgba(0,0,0,.34)}.close-button,.nav-button{position:absolute;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff}.close-button{top:max(14px,env(safe-area-inset-top));right:14px;width:38px;height:38px;font-size:25px}.nav-button{top:50%;width:42px;height:56px;transform:translateY(-50%);font-size:38px}.nav-button--left{left:10px}.nav-button--right{right:10px}.preview-counter{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));left:50%;padding:6px 12px;transform:translateX(-50%);border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font-size:12px}
</style>
