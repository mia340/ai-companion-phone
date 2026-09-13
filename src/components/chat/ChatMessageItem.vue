<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type CSSProperties } from 'vue'
import CharacterAvatar from '../CharacterAvatar.vue'
import SafeRichHtml from './SafeRichHtml.vue'
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
  selectGreeting: [index: number]
}>()

const timer = ref<number>()
const images = computed(() => getMessageImages(props.message).filter(image => Boolean(image.dataUrl)))
const urls = computed(() => images.value.map(image => image.dataUrl || ''))
const displayText = computed(() => props.message.displayContent ?? props.message.content)

const richHtmlHasOwnSurface = computed(() => {
  const html = props.message.richHtml || ''
  if (!html.trim()) return false
  // 作者已经为 UI 声明背景/边框/阴影时，外层保持透明，避免二次套卡。
  // 只有 bare markup（常见于老卡 first_mes 的 details/br）才由小手机提供中性承载面。
  return /<style\b/i.test(html)
    || /(?:background(?:-color)?|border(?:-color|-width|-style)?|box-shadow)\s*:/i.test(html)
})
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
  <div :class="['message-row',message.senderId==='user'?'message-row--mine':'message-row--theirs',{'message-row--action':message.type==='action'}]">
    <template v-if="message.senderId !== 'user'">
      <section v-if="message.roleCardUi" class="role-card-ui role-card-ui--standalone">
        <div class="role-card-ui__top"><b>{{ message.roleCardUi.date || '剧情' }}</b><span>{{ message.roleCardUi.time || '' }}</span></div>
        <div v-if="message.roleCardUi.location" class="role-card-ui__row"><small>地点</small><span>{{ message.roleCardUi.location }}</span></div>
        <div v-if="message.roleCardUi.inner" class="role-card-ui__row"><small>内心</small><span>{{ message.roleCardUi.inner }}</span></div>
        <div v-if="message.roleCardUi.surroundings" class="role-card-ui__row"><small>周围</small><span>{{ message.roleCardUi.surroundings }}</span></div>
        <div v-if="message.roleCardUi.todos?.length" class="role-card-ui__todos"><small>待办</small><ol><li v-for="(todo,index) in message.roleCardUi.todos" :key="`${message.id}-todo-${index}`">{{ todo }}</li></ol></div>
      </section>
      <div v-if="message.type==='action'" class="scene-action-card">
        <small>{{ character?.name || '角色' }}此刻</small>
        <span>{{ displayText }}</span>
      </div>
      <CharacterAvatar v-if="character && message.type!=='action'" :avatar="character.avatar" :name="character.name" :size="38" />
      <div v-if="message.type!=='action'" class="assistant-message-stack">
        <div
          v-if="message.type==='rich' && message.richHtml"
          :class="['bubble','bubble--theirs','bubble--rich',{'bubble--rich-fallback-surface':!richHtmlHasOwnSurface}]"
          @pointerdown="start"
          @pointerup="cancel"
          @pointerleave="cancel"
          @pointercancel="cancel"
          @contextmenu.prevent="openMenu"
        >
          <SafeRichHtml :html="message.richHtml" @select-greeting="emit('selectGreeting', $event)" />
        </div>
        <button
          v-else
          :class="['bubble','bubble--theirs',{
            'bubble--music':message.type==='music',
            'bubble--image':message.type==='image',
            'bubble--single-image':message.type==='image' && images.length===1,
            'bubble--multi-image':message.type==='image' && images.length>1,
            'bubble--streaming':streaming,
            'bubble--emoji':message.type==='emoji',
            'bubble--voice':message.type==='voice',
            'bubble--rich':message.type==='rich',
            'bubble--recalled':Boolean(message.recalledAt)
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
          <template v-if="message.recalledAt"><span class="recalled-message">对方撤回了一条消息</span></template>
          <template v-else-if="message.type==='image' && urls.length">
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
            <span v-if="displayText" class="image-caption">{{ displayText }}</span>
          </template>
          <span v-else-if="message.type==='image' && message.placeholderImagePrompt" class="image-placeholder"><b>角色想分享一张图片</b><small>{{ message.placeholderImagePrompt }}</small></span>
          <span v-else-if="message.type==='image'" class="missing-image">图片未包含在这份备份中<small v-if="displayText">{{ displayText }}</small></span>
          <template v-else-if="message.type==='emoji'"><span class="emoji-message">{{ displayText }}</span></template>
          <template v-else-if="message.type==='voice'"><span class="voice-message-icon">{{ speechState==='playing' ? 'Ⅱ' : '▶' }}</span><span class="voice-message-main"><b>语音消息 · {{ message.voiceDurationSeconds || 2 }}″</b><small>{{ displayText }}</small></span></template>
          <template v-else><span v-if="message.type==='music'" class="music-message-mark">♫</span>{{ displayText }}<i v-if="streaming" class="streaming-caret"></i></template>
        </button>
        <div v-if="message.reactionEmoji" class="message-reaction">{{ message.reactionEmoji }}</div>
        <small v-if="message.proactiveSource" class="proactive-source">{{ message.proactiveSource==='continue-topic'?'延续话题':message.proactiveSource==='promise-reminder'?'履行承诺':message.proactiveSource==='daily-share'?'分享日常':message.proactiveSource==='care'?'关心状态':'剧情事件' }}</small>
        <div v-if="speechAvailable && message.type!=='image' && message.type!=='voice' && message.type!=='emoji' && message.type!=='rich' && displayText && !streaming" class="speech-controls">
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
      <div class="user-message-stack">
      <button
        :class="['bubble','bubble--mine',{
          'bubble--image':message.type==='image',
          'bubble--single-image':message.type==='image' && images.length===1,
          'bubble--multi-image':message.type==='image' && images.length>1,
          'bubble--emoji':message.type==='emoji',
          'bubble--voice':message.type==='voice',
          'bubble--recalled':Boolean(message.recalledAt)
        }]"
        type="button"
        @pointerdown="start"
        @pointerup="cancel"
        @pointerleave="cancel"
        @pointercancel="cancel"
        @contextmenu.prevent="openMenu"
      >
        <span v-if="message.replyTo" class="message-reply-quote message-reply-quote--mine"><b>{{ message.replyTo.senderName }}</b><span>{{ message.replyTo.preview }}</span></span>
        <template v-if="message.recalledAt"><span class="recalled-message">你撤回了一条消息</span></template>
        <template v-else-if="message.type==='image' && urls.length">
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
          <span v-if="displayText" class="image-caption image-caption--mine">{{ displayText }}</span>
        </template>
        <span v-else-if="message.type==='image' && message.placeholderImagePrompt" class="image-placeholder image-placeholder--mine"><b>想分享一张图片</b><small>{{ message.placeholderImagePrompt }}</small></span>
        <span v-else-if="message.type==='image'" class="missing-image missing-image--mine">图片未包含在这份备份中<small v-if="displayText">{{ displayText }}</small></span>
        <template v-else-if="message.type==='emoji'"><span class="emoji-message">{{ displayText }}</span></template>
        <template v-else-if="message.type==='voice'"><span class="voice-message-icon">▶</span><span class="voice-message-main"><b>语音消息 · {{ message.voiceDurationSeconds || 2 }}″</b><small>{{ displayText }}</small></span></template>
        <SafeRichHtml v-else-if="message.type==='rich' && message.richHtml" :html="message.richHtml" @select-greeting="emit('selectGreeting', $event)" />
        <template v-else>{{ displayText }}</template>
      </button>
      <span v-if="message.reactionEmoji" class="message-reaction message-reaction--mine">{{ message.reactionEmoji }}</span>
      <button type="button" :class="['message-delivery-state',`message-delivery-state--${message.status}`,{'message-delivery-state--vision-fallback':message.visionFallback}]" :title="message.status==='failed'||message.status==='cancelled'?'点击重试':undefined" @click="message.status==='failed'||message.status==='cancelled'?emit('retryMessage',message):openMenu()">{{ deliveryLabel }}</button>
      </div>
      <CharacterAvatar :avatar="userProfile?.avatar || '🧑'" :name="userProfile?.name || '我'" :size="38" />
    </template>
  </div>
</template>

<style scoped>
.message-time{margin:16px 0 9px;text-align:center;color:rgba(82,101,118,.48);font-size:10.5px;letter-spacing:.01em}
.message-row{width:100%;display:flex;flex-wrap:wrap;align-items:flex-start;gap:9px;margin:9px 0;animation:bubble-in .2s cubic-bezier(.2,.82,.24,1) both}
.message-row--theirs{justify-content:flex-start}.message-row--mine{justify-content:flex-end}.message-row--action{justify-content:center;margin:5px 0}
.scene-action-card{width:min(82%,420px);display:grid;gap:3px;padding:7px 12px;border:0;border-radius:12px;background:rgba(255,255,255,.42);color:#6d8294;text-align:center}.scene-action-card small{color:#7399b8;font-size:9px;letter-spacing:.04em}.scene-action-card span{font-size:12px;line-height:1.58;font-style:italic;white-space:pre-wrap}
.assistant-message-stack{min-width:0;max-width:76%;display:flex;flex-direction:column;align-items:flex-start;gap:3px}.assistant-message-stack .bubble{max-width:100%}.user-message-stack{min-width:0;max-width:76%;display:flex;flex-direction:column;align-items:flex-end;gap:2px}.user-message-stack>.bubble{max-width:100%}
.role-card-ui{width:min(100%,430px);box-sizing:border-box;margin-bottom:5px;padding:11px 12px;border:1px solid rgba(82,126,161,.10);border-radius:15px;background:rgba(255,255,255,.94);color:#4d6579;box-shadow:0 2px 8px rgba(52,84,109,.05)}.role-card-ui__top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:7px;border-bottom:1px solid rgba(63,96,122,.08)}.role-card-ui__top b{color:#4f86b0;font-size:11px}.role-card-ui__top span{color:#8797a5;font-size:10px}.role-card-ui__row{display:grid;grid-template-columns:32px minmax(0,1fr);gap:7px;padding-top:6px;font-size:11px;line-height:1.5}.role-card-ui__row small,.role-card-ui__todos>small{color:#7694aa;font-size:9px}.role-card-ui__todos{display:grid;grid-template-columns:32px minmax(0,1fr);gap:7px;padding-top:6px}.role-card-ui--standalone{flex:0 0 min(84%,430px);margin-left:47px}.message-row--action .role-card-ui--standalone{margin-left:0}.role-card-ui__todos ol{margin:0;padding-left:17px;color:#607487;font-size:10px;line-height:1.5}
.bubble{position:relative;max-width:76%;padding:10px 13px;overflow:hidden;border:1px solid rgba(47,79,104,.055);border-radius:18px;line-height:1.62;font-size:15px;text-align:left;word-break:break-word;white-space:pre-wrap;box-shadow:0 1px 3px rgba(43,72,98,.055);user-select:text;cursor:default;touch-action:pan-y}
.bubble--theirs{border-top-left-radius:6px;background:#fff;color:#263b4d}.bubble--mine{border-color:transparent;border-top-right-radius:6px;background:#8fc2e8;color:#fff;box-shadow:0 1px 3px rgba(65,130,178,.10)}.bubble--music{background:linear-gradient(145deg,#fff,#f4f9fd)}.music-message-mark{margin-right:5px;color:#5c96c2}
.bubble--image{width:auto;max-width:min(278px,75vw);display:flex;flex-direction:column;gap:0;padding:4px;line-height:1.5}.bubble--single-image{max-width:min(260px,70vw)}.bubble--multi-image{width:min(278px,75vw)}
.message-image-grid{display:grid;gap:3px;overflow:hidden;border-radius:14px;background:#e7eef4}.message-image-grid--1{display:block;width:max-content;max-width:100%}.message-image-grid--2,.message-image-grid--3,.message-image-grid--4{grid-template-columns:repeat(2,minmax(0,1fr))}.message-image-grid--5,.message-image-grid--6{grid-template-columns:repeat(3,minmax(0,1fr))}.message-image-button{position:relative;min-width:0;height:112px;padding:0;overflow:hidden;border:0;background:#e7eef4;cursor:zoom-in}.message-image-grid--1 .message-image-button{display:block;height:auto;min-height:148px;max-height:300px}.message-image-button--portrait{width:min(208px,56vw)}.message-image-button--square{width:min(226px,61vw)}.message-image-button--landscape{width:min(252px,68vw)}.message-image-grid--3 .message-image-button:first-child{grid-row:span 2;height:227px}.message-image-grid--5 .message-image-button,.message-image-grid--6 .message-image-button{height:88px}.message-image{display:block;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none}
.message-reply-quote{display:flex;flex-direction:column;gap:2px;margin:-2px -3px 8px;padding:6px 8px;overflow:hidden;border-left:3px solid rgba(91,145,187,.52);border-radius:7px;background:#f1f6fa;line-height:1.35;font-size:11px;color:#647d91}.message-reply-quote b,.message-reply-quote span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message-reply-quote--mine{border-left-color:rgba(255,255,255,.72);background:rgba(255,255,255,.17);color:rgba(255,255,255,.94)}
.image-caption{display:block;padding:8px 9px 7px;color:#40586b;font-size:13px;line-height:1.5;text-align:left;overflow-wrap:anywhere}.image-caption--mine{color:#fff}.missing-image{min-width:180px;display:grid;gap:5px;padding:18px 14px;color:#70879a;line-height:1.45;text-align:center}.missing-image small{color:inherit;opacity:.8}.missing-image--mine{color:#fff}
.message-delivery-state{align-self:flex-end;margin:0 4px 2px 0;padding:3px 4px;border:0;background:transparent;color:#8495a3;font-size:10px;white-space:nowrap}.message-delivery-state--failed,.message-delivery-state--cancelled,.message-delivery-state--vision-fallback{color:#c75d69;font-weight:700}
.speech-controls{display:flex;align-items:center;gap:6px;padding-left:4px}.speech-controls button{padding:3px 8px;border:0;border-radius:9px;background:rgba(255,255,255,.84);color:#6387a2;font-size:10.5px}.alternative-nav{display:flex;align-items:center;gap:7px;margin:1px 0 0 4px;color:#8193a1;font-size:10px}.alternative-nav button{width:24px;height:22px;border:0;border-radius:9px;background:rgba(255,255,255,.88);color:#6289a7;font-size:18px;line-height:1}.alternative-nav button:disabled{opacity:.28}.assistant-message-state{padding-left:4px;color:#8193a1;font-size:10px}.assistant-message-state--failed{color:#c75d69}
.streaming-caret{display:inline-block;width:2px;height:1.08em;margin-left:2px;border-radius:999px;background:currentColor;vertical-align:-.16em;animation:stream-caret .8s steps(2,end) infinite}
.bubble--emoji{min-width:52px;padding:6px 10px;border:0;background:transparent!important;box-shadow:none;font-size:34px;line-height:1.15}.emoji-message{display:block;filter:drop-shadow(0 3px 6px rgba(49,70,88,.11))}.bubble--voice{min-width:190px;display:flex;align-items:center;gap:10px;white-space:normal}.voice-message-icon{width:34px;height:34px;display:grid;place-items:center;flex:0 0 auto;border-radius:50%;background:#edf5fb;color:#5b91ba;font-size:13px;font-weight:900}.bubble--mine .voice-message-icon{background:rgba(255,255,255,.22);color:#fff}.voice-message-main{min-width:0;display:flex;flex:1;flex-direction:column;gap:2px}.voice-message-main b{font-size:12px}.voice-message-main small{max-width:210px;overflow:hidden;opacity:.72;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.bubble--recalled{background:rgba(255,255,255,.58);box-shadow:none}.recalled-message{color:#8997a2;font-size:12px;font-style:italic}.message-reaction{align-self:flex-start;margin:-8px 0 0 10px;padding:2px 7px;border:1px solid rgba(63,93,116,.08);border-radius:999px;background:#fff;font-size:15px;box-shadow:0 2px 7px rgba(45,69,88,.07)}.message-reaction--mine{align-self:flex-end;margin:24px -18px 0 0;z-index:2}.proactive-source{margin:0 0 0 4px;color:#8294a2;font-size:9px}.image-placeholder{min-width:190px;display:grid;gap:5px;padding:18px 15px;border-radius:13px;background:linear-gradient(145deg,#f7fbfe,#eaf3fa);color:#587286;text-align:center}.image-placeholder:before{content:'▧';font-size:30px;color:#6da1c8}.image-placeholder small{color:#7890a2;line-height:1.5}.image-placeholder--mine{background:rgba(255,255,255,.18);color:#fff}.image-placeholder--mine small{color:rgba(255,255,255,.82)}
@keyframes bubble-in{from{opacity:0;transform:translate3d(0,6px,0) scale(.987)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}@keyframes stream-caret{0%,45%{opacity:1}46%,100%{opacity:.18}}
@media(max-width:390px){.message-image-button--portrait{width:min(192px,54vw)}.message-image-button--square{width:min(212px,59vw)}.message-image-button--landscape{width:min(238px,66vw)}.message-image-grid--5 .message-image-button,.message-image-grid--6 .message-image-button{height:80px}}
@media(prefers-reduced-motion:reduce){.message-row,.streaming-caret{animation:none}}
</style>

<style scoped>
.bubble--rich{max-width:min(430px,84vw);padding:0;border:0;background:transparent!important;box-shadow:none!important;border-radius:0!important;overflow:visible}.bubble--rich.bubble--rich-fallback-surface{padding:11px 14px;border:1px solid rgba(47,79,104,.055);background:#fff!important;border-radius:18px 18px 18px 6px!important;box-shadow:0 1px 3px rgba(43,72,98,.055)!important;overflow:hidden}.bubble--rich:active{transform:none}
</style>
