<script setup lang="ts">
import { ref, type CSSProperties } from 'vue'
import type { MusicState } from '../../types/domain'

defineProps<{
  title: string
  musicState?: MusicState
  isSending: boolean
  panelStyle?: CSSProperties
  formatDuration: (value: number) => string
}>()
const emit = defineEmits<{
  dragStart: [event: PointerEvent]
  dragMove: [event: PointerEvent]
  dragEnd: []
  patch: [patch: Partial<MusicState>]
  localAudio: [file: File]
  useUrl: []
  toggle: []
  timeUpdate: []
  playState: [isPlaying: boolean]
  metadata: []
  seek: [value: number]
  reaction: []
  close: []
}>()
const audioRef = ref<HTMLAudioElement>()
function fileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('localAudio', file)
}
function patch(key: 'title'|'artist'|'audioUrl', event: Event) {
  emit('patch', { [key]: (event.target as HTMLInputElement).value })
}
defineExpose({ getAudioElement: () => audioRef.value })
</script>

<template>
  <section class="bottom-panel" :style="panelStyle">
    <div class="panel-handle"
      @pointerdown="emit('dragStart',$event)" @pointermove="emit('dragMove',$event)"
      @pointerup="emit('dragEnd')" @pointercancel="emit('dragEnd')"></div>
    <div class="panel-title-row">
      <div><small>共享此刻的声音</small><h2>一起听歌</h2></div>
      <button type="button" @click="emit('close')">×</button>
    </div>
    <div class="music-cover">♫</div>
    <label>歌曲名称<input :value="musicState?.title" placeholder="例如：晴天" @input="patch('title',$event)" /></label>
    <label>歌手<input :value="musicState?.artist" placeholder="可选" @input="patch('artist',$event)" /></label>
    <label>音频地址<input :value="musicState?.audioUrl" placeholder="https://.../music.mp3" @input="patch('audioUrl',$event)" @change="emit('useUrl')" /></label>
    <label class="local-file-button">选择本地音频<input type="file" accept="audio/*" @change="fileSelected" /></label>
    <audio ref="audioRef" preload="metadata" @timeupdate="emit('timeUpdate')" @loadedmetadata="emit('metadata')"
      @play="emit('playState',true)" @pause="emit('playState',false)" @ended="emit('playState',false)"></audio>
    <div class="music-progress-row">
      <span>{{ formatDuration(musicState?.currentTime ?? 0) }}</span>
      <input :value="musicState?.currentTime ?? 0" type="range" min="0" :max="musicState?.duration || 1" step="0.1"
        @input="emit('seek',Number(($event.target as HTMLInputElement).value))" />
      <span>{{ formatDuration(musicState?.duration ?? 0) }}</span>
    </div>
    <div class="music-controls">
      <button type="button" class="music-play" @click="emit('toggle')">{{ musicState?.isPlaying ? 'Ⅱ' : '▶' }}</button>
      <button type="button" class="music-react" :disabled="isSending" @click="emit('reaction')">让 {{ title }} 说说</button>
    </div>
    <p class="panel-footnote">本地音频只在当前浏览器会话中有效；网络音频地址会随聊天保存。</p>
  </section>
</template>

<style scoped>
.bottom-panel{width:100%;max-height:88%;overflow-y:auto;padding:8px 18px max(24px,env(safe-area-inset-bottom));border-radius:26px 26px 0 0;background:#fffafb;box-shadow:0 -18px 50px rgba(70,42,55,.18);transition:transform .24s cubic-bezier(.22,.8,.24,1);will-change:transform}.panel-handle{position:relative;width:84px;height:17px;margin:-3px auto 15px;background:transparent;touch-action:none}.panel-handle:after{content:'';position:absolute;top:5px;left:50%;width:42px;height:5px;transform:translateX(-50%);border-radius:999px;background:#dccbd2}.panel-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.panel-title-row h2{margin:2px 0 16px}.panel-title-row small{color:#a17c8d}.panel-title-row>button{width:36px;height:36px;border:0;border-radius:50%;background:#f3e9ed;color:#765864;font-size:22px}.music-cover{width:104px;height:104px;display:grid;place-items:center;margin:0 auto 18px;border-radius:27px;background:linear-gradient(145deg,#ffdbea,#e99abb);color:#fff;font-size:48px;box-shadow:0 16px 28px rgba(203,98,143,.22)}label{display:flex;flex-direction:column;gap:5px;margin:11px 0;font-size:12px;font-weight:700}label input{padding:11px 12px;border:1px solid rgba(80,50,62,.1);border-radius:13px;background:#fff}.local-file-button{align-items:center;padding:11px;border-radius:13px;background:#f4e9ee;color:#8a6073;text-align:center;cursor:pointer}.local-file-button input{display:none}.music-progress-row{display:grid;grid-template-columns:38px 1fr 38px;align-items:center;gap:7px;margin-top:14px;font-size:11px;color:#8d6e7b}.music-progress-row input{width:100%}.music-controls{display:flex;align-items:center;justify-content:center;gap:14px;margin:16px 0}.music-play{width:54px;height:54px;border:0;border-radius:50%;background:#d96b99;color:#fff;font-size:21px}.music-react{padding:12px 17px;border:0;border-radius:15px;background:#f2e6eb;color:#76515f;font-weight:700}.music-react:disabled{opacity:.55}.panel-footnote{color:#9a7d8a;font-size:12px;line-height:1.65}
</style>
