<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import CharacterAvatar from '../CharacterAvatar.vue'
import { getMessageImages } from '../../services/messageImageService'
import type { Character, Message, UserProfile } from '../../types/domain'

const props = defineProps<{
  message: Message
  character?: Character
  userProfile?: UserProfile
  showTime: boolean
  timeLabel: string
  streaming?: boolean
  speechAvailable?: boolean
  speechState?: 'idle'|'playing'|'paused'
}>()
const emit = defineEmits<{
  openMenu: [message: Message]
  openImages: [urls: string[], index: number]
  toggleSpeech: [message: Message]
  stopSpeech: []
  retryMessage: [message: Message]
}>()
const timer = ref<number>()
const images = computed(() => getMessageImages(props.message))
const urls = computed(() => images.value.map(image => image.dataUrl || '').filter(Boolean))
function cancel() { if (timer.value !== undefined) { window.clearTimeout(timer.value); timer.value = undefined } }
function openMenu() { cancel(); emit('openMenu', props.message) }
function start() { cancel(); timer.value = window.setTimeout(openMenu,480) }
function openImage(index: number) { if (urls.value.length) emit('openImages', urls.value, Math.min(index,urls.value.length-1)) }
onBeforeUnmount(cancel)
</script>

<template>
  <div v-if="showTime" class="message-time">{{ timeLabel }}</div>
  <div :class="['message-row',message.senderId==='user'?'message-row--mine':'message-row--theirs']">
    <template v-if="message.senderId !== 'user'">
      <CharacterAvatar v-if="character" :avatar="character.avatar" :name="character.name" :size="38" />
      <div class="assistant-message-stack">
        <button :class="['bubble','bubble--theirs',{'bubble--music':message.type==='music','bubble--image':message.type==='image','bubble--streaming':streaming}]" type="button" @pointerdown="start" @pointerup="cancel" @pointerleave="cancel" @pointercancel="cancel" @contextmenu.prevent="openMenu">
          <span v-if="message.replyTo" class="message-reply-quote"><b>{{ message.replyTo.senderName }}</b><span>{{ message.replyTo.preview }}</span></span>
          <template v-if="message.type==='image' && urls.length">
            <div :class="['message-image-grid',`message-image-grid--${Math.min(urls.length,4)}`]">
              <button v-for="(image,index) in images" :key="`${image.name}-${index}`" type="button" class="message-image-button" @click.stop="openImage(index)">
                <img v-if="image.dataUrl" :src="image.dataUrl" :alt="image.name || `聊天图片 ${index+1}`" class="message-image" />
              </button>
            </div>
            <span v-if="message.content" class="image-caption">{{ message.content }}</span>
          </template>
          <span v-else-if="message.type==='image'" class="missing-image">图片未包含在这份备份中<small v-if="message.content">{{ message.content }}</small></span>
          <template v-else><span v-if="message.type==='music'" class="music-message-mark">♫</span>{{ message.content }}<i v-if="streaming" class="streaming-caret"></i></template>
        </button>
        <div v-if="speechAvailable && message.type!=='image' && message.content && !streaming" class="speech-controls">
          <button type="button" @click.stop="emit('toggleSpeech',message)">{{ speechState==='playing'?'暂停':speechState==='paused'?'继续':'朗读' }}</button>
          <button v-if="speechState==='playing'||speechState==='paused'" type="button" @click.stop="emit('stopSpeech')">停止</button>
        </div>
        <small v-if="message.status==='cancelled'||message.status==='failed'" :class="['assistant-message-state',`assistant-message-state--${message.status}`]">{{ message.status==='cancelled'?'已停止生成':'回复中断' }}</small>
      </div>
    </template>
    <template v-else>
      <button :class="['bubble','bubble--mine',{'bubble--image':message.type==='image'}]" type="button" @pointerdown="start" @pointerup="cancel" @pointerleave="cancel" @pointercancel="cancel" @contextmenu.prevent="openMenu">
        <span v-if="message.replyTo" class="message-reply-quote message-reply-quote--mine"><b>{{ message.replyTo.senderName }}</b><span>{{ message.replyTo.preview }}</span></span>
        <template v-if="message.type==='image' && urls.length">
          <div :class="['message-image-grid',`message-image-grid--${Math.min(urls.length,4)}`]">
            <button v-for="(image,index) in images" :key="`${image.name}-${index}`" type="button" class="message-image-button" @click.stop="openImage(index)">
              <img v-if="image.dataUrl" :src="image.dataUrl" :alt="image.name || `聊天图片 ${index+1}`" class="message-image" />
            </button>
          </div>
          <span v-if="message.content" class="image-caption image-caption--mine">{{ message.content }}</span>
        </template>
        <span v-else-if="message.type==='image'" class="missing-image missing-image--mine">图片未包含在这份备份中<small v-if="message.content">{{ message.content }}</small></span>
        <template v-else>{{ message.content }}</template>
      </button>
      <button type="button" :class="['message-delivery-state',`message-delivery-state--${message.status}`]" :title="message.status==='failed'||message.status==='cancelled'?'点击重试':undefined" @click="message.status==='failed'||message.status==='cancelled'?emit('retryMessage',message):openMenu()">{{ message.status==='pending'?'发送中':message.status==='failed'?'发送失败 · 重试':message.status==='cancelled'?'已停止 · 重试':message.status==='read'?'已读':'已发送' }}</button>
      <CharacterAvatar :avatar="userProfile?.avatar || '🧑'" :name="userProfile?.name || '我'" :size="38" />
    </template>
  </div>
</template>

<style scoped>
.message-time{margin:15px 0 9px;text-align:center;color:rgba(91,63,74,.46);font-size:11px}.message-row{width:100%;display:flex;align-items:flex-start;gap:9px;margin:9px 0;animation:bubble-in .22s cubic-bezier(.2,.82,.24,1) both}.message-row--theirs{justify-content:flex-start}.message-row--mine{justify-content:flex-end}.assistant-message-stack{min-width:0;max-width:74%;display:flex;flex-direction:column;align-items:flex-start;gap:3px}.assistant-message-stack .bubble{max-width:100%}.bubble{position:relative;max-width:74%;padding:11px 14px;overflow:hidden;border:0;border-radius:17px;line-height:1.6;font-size:15px;text-align:left;word-break:break-word;white-space:pre-wrap;box-shadow:0 2px 10px rgba(89,56,70,.06);user-select:text;cursor:default;touch-action:pan-y}.bubble--theirs{border-top-left-radius:6px;background:#fff;color:#563f49}.bubble--mine{border-top-right-radius:6px;background:#e88ab0;color:#fff}.bubble--music{background:linear-gradient(145deg,#fff,#fff1f7)}.music-message-mark{margin-right:5px;color:#cf6f98}.bubble--image{width:min(270px,72vw);max-width:76%;display:flex;flex-direction:column;gap:0;padding:4px;line-height:1.5}.message-image-grid{display:grid;gap:3px;overflow:hidden;border-radius:13px}.message-image-grid--1{grid-template-columns:1fr}.message-image-grid--2{grid-template-columns:repeat(2,1fr)}.message-image-grid--3,.message-image-grid--4{grid-template-columns:repeat(2,1fr)}.message-image-button{min-width:0;height:112px;padding:0;overflow:hidden;border:0;background:#eadde2;cursor:zoom-in}.message-image-grid--1 .message-image-button{height:min(330px,65vw)}.message-image-grid--3 .message-image-button:first-child{grid-row:span 2;height:227px}.message-image{display:block;width:100%;height:100%;object-fit:cover}.message-reply-quote{display:flex;flex-direction:column;gap:2px;margin:-3px -4px 8px;padding:6px 8px;overflow:hidden;border-left:3px solid rgba(210,102,148,.58);border-radius:7px;background:rgba(221,195,206,.25);line-height:1.35;font-size:11px;color:#856673}.message-reply-quote b,.message-reply-quote span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message-reply-quote--mine{border-left-color:rgba(255,255,255,.72);background:rgba(255,255,255,.18);color:rgba(255,255,255,.92)}.image-caption{display:block;padding:8px 9px 7px;color:#644a55;font-size:13px;line-height:1.5;text-align:left;overflow-wrap:anywhere}.image-caption--mine{color:#fff}.missing-image{min-width:180px;display:grid;gap:5px;padding:18px 14px;color:#8c6c79;line-height:1.45;text-align:center}.missing-image small{color:inherit;opacity:.8}.missing-image--mine{color:#fff}.message-delivery-state{align-self:flex-end;margin:0 -2px 2px 0;padding:3px 4px;border:0;background:transparent;color:#9b7d89;font-size:10px;white-space:nowrap}.message-delivery-state--failed,.message-delivery-state--cancelled{color:#c84f63;font-weight:700}.speech-controls{display:flex;align-items:center;gap:6px;padding-left:4px}.speech-controls button{padding:2px 7px;border:0;border-radius:9px;background:rgba(255,255,255,.72);color:#9a687c;font-size:11px}.assistant-message-state{padding-left:4px;color:#9b7d89;font-size:10px}.assistant-message-state--failed{color:#c84f63}.streaming-caret{display:inline-block;width:2px;height:1.08em;margin-left:2px;border-radius:999px;background:currentColor;vertical-align:-.16em;animation:stream-caret .8s steps(2,end) infinite}@keyframes bubble-in{from{opacity:0;transform:translate3d(0,7px,0) scale(.985)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}@keyframes stream-caret{0%,45%{opacity:1}46%,100%{opacity:.18}}@media(prefers-reduced-motion:reduce){.message-row,.streaming-caret{animation:none}}
</style>
