<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type CSSProperties } from 'vue'
import CharacterAvatar from '../CharacterAvatar.vue'
import { getMessageImages } from '../../services/messageImageService'
import type { Character, Message, MessageImage, UserProfile } from '../../types/domain'

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
  selectAlternative: [message: Message, offset: number]
}>()

const timer = ref<number>()
const images = computed(() => getMessageImages(props.message).filter(image => Boolean(image.dataUrl)))
const urls = computed(() => images.value.map(image => image.dataUrl || ''))
const alternativeCount = computed(() => props.message.alternatives?.length || 0)
const alternativeIndex = computed(() => Math.min(
  Math.max(0, props.message.activeAlternativeIndex ?? 0),
  Math.max(0, alternativeCount.value - 1)
))
const imageCountClass = computed(() => `message-image-grid--${Math.min(images.value.length, 6)}`)
const deliveryLabel = computed(() => {
  const count = images.value.length
  if (props.message.status === 'pending') return count ? `${count} 张图片发送中` : '发送中'
  if (props.message.status === 'failed') return '发送失败 · 重试'
  if (props.message.status === 'cancelled') return '已停止 · 重试'
  if (props.message.type === 'image' && props.message.visionFallback) return '模型未读取图片 · 已按文字回复'
  if (props.message.type === 'image' && props.message.visionUsed) return `AI 已查看 ${count || 1} 张图片`
  if (props.message.status === 'read') return '已读'
  return count ? `${count} 张图片已发送` : '已发送'
})

function cancel() {
  if (timer.value !== undefined) {
    window.clearTimeout(timer.value)
    timer.value = undefined
  }
}
function openMenu() {
  cancel()
  emit('openMenu', props.message)
}
function start() {
  cancel()
  timer.value = window.setTimeout(openMenu, 480)
}
function openImage(index: number) {
  if (urls.value.length) emit('openImages', urls.value, Math.min(index, urls.value.length - 1))
}
function imageOrientation(image: MessageImage) {
  if (!image.width || !image.height) return 'square'
  const ratio = image.width / image.height
  if (ratio < .82) return 'portrait'
  if (ratio > 1.28) return 'landscape'
  return 'square'
}
function imageButtonStyle(image: MessageImage): CSSProperties | undefined {
  if (images.value.length !== 1 || !image.width || !image.height) return undefined
  const ratio = Math.min(1.58, Math.max(.68, image.width / image.height))
  return { aspectRatio: String(ratio) }
}

onBeforeUnmount(cancel)
</script>

<template>
  <div v-if="showTime" class="message-time">{{ timeLabel }}</div>
  <div :class="['message-row',message.senderId==='user'?'message-row--mine':'message-row--theirs']">
    <template v-if="message.senderId !== 'user'">
      <CharacterAvatar v-if="character" :avatar="character.avatar" :name="character.name" :size="38" />
      <div class="assistant-message-stack">
        <button
          :class="['bubble','bubble--theirs',{
            'bubble--music':message.type==='music',
            'bubble--image':message.type==='image',
            'bubble--single-image':message.type==='image' && images.length===1,
            'bubble--multi-image':message.type==='image' && images.length>1,
            'bubble--streaming':streaming,
            'bubble--emoji':message.type==='emoji',
            'bubble--voice':message.type==='voice'
          }]"
          type="button"
          @pointerdown="start"
          @pointerup="cancel"
          @pointerleave="cancel"
          @pointercancel="cancel"
          @contextmenu.prevent="openMenu"
          @click="message.type==='voice' ? emit('toggleSpeech', message) : undefined"
        >
          <span v-if="message.replyTo" class="message-reply-quote"><b>{{ message.replyTo.senderName }}</b><span>{{ message.replyTo.preview }}</span></span>
          <template v-if="message.type==='image' && urls.length">
            <div :class="['message-image-grid',imageCountClass]">
              <button
                v-for="(image,index) in images"
                :key="`${image.name}-${index}`"
                type="button"
                :class="['message-image-button', images.length===1 ? `message-image-button--${imageOrientation(image)}` : '']"
                :style="imageButtonStyle(image)"
                :aria-label="`查看第 ${index + 1} 张图片`"
                @click.stop="openImage(index)"
              >
                <img
                  :src="image.dataUrl"
                  :alt="image.name || `聊天图片 ${index+1}`"
                  class="message-image"
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                />
              </button>
            </div>
            <span v-if="message.content" class="image-caption">{{ message.content }}</span>
          </template>
          <span v-else-if="message.type==='image'" class="missing-image">图片未包含在这份备份中<small v-if="message.content">{{ message.content }}</small></span>
          <template v-else-if="message.type==='emoji'"><span class="emoji-message">{{ message.content }}</span></template>
          <template v-else-if="message.type==='voice'"><span class="voice-message-icon">{{ speechState==='playing' ? 'Ⅱ' : '▶' }}</span><span class="voice-message-main"><b>语音消息 · {{ message.voiceDurationSeconds || 2 }}″</b><small>{{ message.content }}</small></span></template>
          <template v-else><span v-if="message.type==='music'" class="music-message-mark">♫</span>{{ message.content }}<i v-if="streaming" class="streaming-caret"></i></template>
        </button>
        <div v-if="speechAvailable && message.type!=='image' && message.type!=='voice' && message.type!=='emoji' && message.content && !streaming" class="speech-controls">
          <button type="button" @click.stop="emit('toggleSpeech',message)">{{ speechState==='playing'?'暂停':speechState==='paused'?'继续':'朗读' }}</button>
          <button v-if="speechState==='playing'||speechState==='paused'" type="button" @click.stop="emit('stopSpeech')">停止</button>
        </div>
        <div v-if="alternativeCount > 1 && !streaming" class="alternative-nav" aria-label="候选回复">
          <button type="button" :disabled="alternativeIndex <= 0" @click.stop="emit('selectAlternative', message, -1)">‹</button>
          <span>{{ alternativeIndex + 1 }} / {{ alternativeCount }}</span>
          <button type="button" :disabled="alternativeIndex >= alternativeCount - 1" @click.stop="emit('selectAlternative', message, 1)">›</button>
        </div>
        <small v-if="message.status==='cancelled'||message.status==='failed'" :class="['assistant-message-state',`assistant-message-state--${message.status}`]">{{ message.status==='cancelled'?'已停止生成':'回复中断' }}</small>
      </div>
    </template>

    <template v-else>
      <button
        :class="['bubble','bubble--mine',{
          'bubble--image':message.type==='image',
          'bubble--single-image':message.type==='image' && images.length===1,
          'bubble--multi-image':message.type==='image' && images.length>1,
          'bubble--emoji':message.type==='emoji',
          'bubble--voice':message.type==='voice'
        }]"
        type="button"
        @pointerdown="start"
        @pointerup="cancel"
        @pointerleave="cancel"
        @pointercancel="cancel"
        @contextmenu.prevent="openMenu"
      >
        <span v-if="message.replyTo" class="message-reply-quote message-reply-quote--mine"><b>{{ message.replyTo.senderName }}</b><span>{{ message.replyTo.preview }}</span></span>
        <template v-if="message.type==='image' && urls.length">
          <div :class="['message-image-grid',imageCountClass]">
            <button
              v-for="(image,index) in images"
              :key="`${image.name}-${index}`"
              type="button"
              :class="['message-image-button', images.length===1 ? `message-image-button--${imageOrientation(image)}` : '']"
              :style="imageButtonStyle(image)"
              :aria-label="`查看第 ${index + 1} 张图片`"
              @click.stop="openImage(index)"
            >
              <img
                :src="image.dataUrl"
                :alt="image.name || `聊天图片 ${index+1}`"
                class="message-image"
                loading="lazy"
                decoding="async"
                draggable="false"
              />
            </button>
          </div>
          <span v-if="message.content" class="image-caption image-caption--mine">{{ message.content }}</span>
        </template>
        <span v-else-if="message.type==='image'" class="missing-image missing-image--mine">图片未包含在这份备份中<small v-if="message.content">{{ message.content }}</small></span>
        <template v-else-if="message.type==='emoji'"><span class="emoji-message">{{ message.content }}</span></template>
        <template v-else-if="message.type==='voice'"><span class="voice-message-icon">▶</span><span class="voice-message-main"><b>语音消息 · {{ message.voiceDurationSeconds || 2 }}″</b><small>{{ message.content }}</small></span></template>
        <template v-else>{{ message.content }}</template>
      </button>
      <button type="button" :class="['message-delivery-state',`message-delivery-state--${message.status}`,{'message-delivery-state--vision-fallback':message.visionFallback}]" :title="message.status==='failed'||message.status==='cancelled'?'点击重试':undefined" @click="message.status==='failed'||message.status==='cancelled'?emit('retryMessage',message):openMenu()">{{ deliveryLabel }}</button>
      <CharacterAvatar :avatar="userProfile?.avatar || '🧑'" :name="userProfile?.name || '我'" :size="38" />
    </template>
  </div>
</template>

<style scoped>
.message-time{margin:15px 0 9px;text-align:center;color:rgba(91,63,74,.46);font-size:11px}
.message-row{width:100%;display:flex;align-items:flex-start;gap:9px;margin:9px 0;animation:bubble-in .22s cubic-bezier(.2,.82,.24,1) both}
.message-row--theirs{justify-content:flex-start}.message-row--mine{justify-content:flex-end}
.assistant-message-stack{min-width:0;max-width:74%;display:flex;flex-direction:column;align-items:flex-start;gap:3px}.assistant-message-stack .bubble{max-width:100%}
.bubble{position:relative;max-width:74%;padding:11px 14px;overflow:hidden;border:0;border-radius:17px;line-height:1.6;font-size:15px;text-align:left;word-break:break-word;white-space:pre-wrap;box-shadow:0 2px 10px rgba(89,56,70,.06);user-select:text;cursor:default;touch-action:pan-y}
.bubble--theirs{border-top-left-radius:6px;background:#fff;color:#563f49}.bubble--mine{border-top-right-radius:6px;background:#e88ab0;color:#fff}.bubble--music{background:linear-gradient(145deg,#fff,#fff1f7)}.music-message-mark{margin-right:5px;color:#cf6f98}
.bubble--image{width:auto;max-width:min(278px,75vw);display:flex;flex-direction:column;gap:0;padding:4px;line-height:1.5}
.bubble--single-image{max-width:min(260px,70vw)}.bubble--multi-image{width:min(278px,75vw)}
.message-image-grid{display:grid;gap:3px;overflow:hidden;border-radius:13px;background:#eadde2}
.message-image-grid--1{display:block;width:max-content;max-width:100%}
.message-image-grid--2,.message-image-grid--3,.message-image-grid--4{grid-template-columns:repeat(2,minmax(0,1fr))}
.message-image-grid--5,.message-image-grid--6{grid-template-columns:repeat(3,minmax(0,1fr))}
.message-image-button{position:relative;min-width:0;height:112px;padding:0;overflow:hidden;border:0;background:#eadde2;cursor:zoom-in}
.message-image-grid--1 .message-image-button{display:block;height:auto;min-height:148px;max-height:300px}
.message-image-button--portrait{width:min(208px,56vw)}
.message-image-button--square{width:min(226px,61vw)}
.message-image-button--landscape{width:min(252px,68vw)}
.message-image-grid--3 .message-image-button:first-child{grid-row:span 2;height:227px}
.message-image-grid--5 .message-image-button,.message-image-grid--6 .message-image-button{height:88px}
.message-image{display:block;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none}
.message-reply-quote{display:flex;flex-direction:column;gap:2px;margin:-3px -4px 8px;padding:6px 8px;overflow:hidden;border-left:3px solid rgba(210,102,148,.58);border-radius:7px;background:rgba(221,195,206,.25);line-height:1.35;font-size:11px;color:#856673}.message-reply-quote b,.message-reply-quote span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message-reply-quote--mine{border-left-color:rgba(255,255,255,.72);background:rgba(255,255,255,.18);color:rgba(255,255,255,.92)}
.image-caption{display:block;padding:8px 9px 7px;color:#644a55;font-size:13px;line-height:1.5;text-align:left;overflow-wrap:anywhere}.image-caption--mine{color:#fff}
.missing-image{min-width:180px;display:grid;gap:5px;padding:18px 14px;color:#8c6c79;line-height:1.45;text-align:center}.missing-image small{color:inherit;opacity:.8}.missing-image--mine{color:#fff}
.message-delivery-state{align-self:flex-end;margin:0 -2px 2px 0;padding:3px 4px;border:0;background:transparent;color:#9b7d89;font-size:10px;white-space:nowrap}.message-delivery-state--failed,.message-delivery-state--cancelled,.message-delivery-state--vision-fallback{color:#c84f63;font-weight:700}
.speech-controls{display:flex;align-items:center;gap:6px;padding-left:4px}.speech-controls button{padding:2px 7px;border:0;border-radius:9px;background:rgba(255,255,255,.72);color:#9a687c;font-size:11px}
.alternative-nav{display:flex;align-items:center;gap:7px;margin:1px 0 0 4px;color:#9b7786;font-size:10px}.alternative-nav button{width:24px;height:22px;border:0;border-radius:9px;background:rgba(255,255,255,.82);color:#a45d7c;font-size:18px;line-height:1}.alternative-nav button:disabled{opacity:.28}
.assistant-message-state{padding-left:4px;color:#9b7d89;font-size:10px}.assistant-message-state--failed{color:#c84f63}
.streaming-caret{display:inline-block;width:2px;height:1.08em;margin-left:2px;border-radius:999px;background:currentColor;vertical-align:-.16em;animation:stream-caret .8s steps(2,end) infinite}
@keyframes bubble-in{from{opacity:0;transform:translate3d(0,7px,0) scale(.985)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}
@keyframes stream-caret{0%,45%{opacity:1}46%,100%{opacity:.18}}
@media(max-width:390px){.message-image-button--portrait{width:min(192px,54vw)}.message-image-button--square{width:min(212px,59vw)}.message-image-button--landscape{width:min(238px,66vw)}.message-image-grid--5 .message-image-button,.message-image-grid--6 .message-image-button{height:80px}}
@media(prefers-reduced-motion:reduce){.message-row,.streaming-caret{animation:none}}

.bubble--emoji{min-width:52px;padding:6px 10px;background:transparent!important;box-shadow:none;font-size:34px;line-height:1.15}.emoji-message{display:block;filter:drop-shadow(0 3px 6px rgba(72,42,55,.12))}.bubble--voice{min-width:190px;display:flex;align-items:center;gap:10px;white-space:normal}.voice-message-icon{width:34px;height:34px;display:grid;place-items:center;flex:0 0 auto;border-radius:50%;background:rgba(215,105,151,.12);color:#c05f88;font-size:13px;font-weight:900}.bubble--mine .voice-message-icon{background:rgba(255,255,255,.22);color:#fff}.voice-message-main{min-width:0;display:flex;flex:1;flex-direction:column;gap:2px}.voice-message-main b{font-size:12px}.voice-message-main small{max-width:210px;overflow:hidden;opacity:.72;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
</style>
