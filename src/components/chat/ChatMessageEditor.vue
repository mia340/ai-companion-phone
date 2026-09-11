<script setup lang="ts">
import type { CSSProperties } from 'vue'

const props = defineProps<{
  modelValue: string
  senderLabel?: string
  isSaving?: boolean
  panelStyle?: CSSProperties
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  dragStart: [event: PointerEvent]
  dragMove: [event: PointerEvent]
  dragEnd: []
  save: []
  close: []
}>()
</script>

<template>
  <section class="editor-panel" :style="panelStyle">
    <div
      class="panel-handle"
      @pointerdown="emit('dragStart', $event)"
      @pointermove="emit('dragMove', $event)"
      @pointerup="emit('dragEnd')"
      @pointercancel="emit('dragEnd')"
    ></div>

    <header class="editor-head">
      <div>
        <strong>编辑消息</strong>
        <small>{{ senderLabel || '当前消息' }}</small>
      </div>
      <button type="button" aria-label="关闭编辑器" @click="emit('close')">×</button>
    </header>

    <textarea
      class="editor-textarea"
      :value="props.modelValue"
      rows="10"
      autofocus
      spellcheck="false"
      aria-label="消息编辑内容"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>

    <div class="editor-meta">
      <span>{{ props.modelValue.length }} 字符</span>
      <span>可拖动右下角调整高度</span>
    </div>

    <footer class="editor-actions">
      <button type="button" class="secondary" @click="emit('close')">取消</button>
      <button type="button" class="primary" :disabled="isSaving" @click="emit('save')">
        {{ isSaving ? '保存中…' : '保存修改' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.editor-panel{
  width:100%;
  max-height:88%;
  overflow:auto;
  padding:8px 16px max(22px,env(safe-area-inset-bottom));
  border-radius:28px 28px 0 0;
  background:rgba(248,252,255,.985);
  box-shadow:0 -18px 55px rgba(41,72,96,.18);
  backdrop-filter:blur(24px) saturate(150%);
  transition:transform .24s cubic-bezier(.22,.8,.24,1);
  will-change:transform;
}
.panel-handle{position:relative;width:82px;height:18px;margin:-2px auto 7px;touch-action:none;cursor:grab}
.panel-handle::after{content:'';position:absolute;top:6px;left:50%;width:42px;height:5px;transform:translateX(-50%);border-radius:999px;background:#c8d9e6}
.editor-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 2px 13px}
.editor-head>div{display:grid;gap:2px}.editor-head strong{color:#273d50;font-size:17px;letter-spacing:-.01em}.editor-head small{color:#91a0ac;font-size:11px}
.editor-head button{width:34px;height:34px;border:0;border-radius:50%;background:#eaf2f8;color:#637b8f;font-size:22px;line-height:1;cursor:pointer}
.editor-textarea{
  box-sizing:border-box;
  width:100%;
  min-height:230px;
  max-height:58vh;
  padding:15px 16px;
  resize:vertical;
  overflow:auto;
  border:1px solid #dce9f2;
  border-radius:18px;
  outline:none;
  background:#fff;
  color:#253a4b;
  font:inherit;
  font-size:15px;
  line-height:1.72;
  box-shadow:0 8px 24px rgba(58,92,118,.055);
  user-select:text;
  -webkit-user-select:text;
}
.editor-textarea:focus{border-color:#9bc4e2;box-shadow:0 0 0 4px rgba(95,159,210,.10),0 8px 24px rgba(58,92,118,.055)}
.editor-meta{display:flex;justify-content:space-between;gap:10px;padding:7px 3px 10px;color:#98a6b1;font-size:10.5px}
.editor-actions{display:grid;grid-template-columns:minmax(90px,.7fr) minmax(150px,1.3fr);gap:9px}
.editor-actions button{min-height:46px;border:0;border-radius:15px;font:inherit;font-size:14px;font-weight:750;cursor:pointer}
.editor-actions .secondary{background:#edf3f7;color:#60778a}.editor-actions .primary{background:#69a6d2;color:#fff;box-shadow:0 8px 18px rgba(78,137,181,.16)}
.editor-actions button:disabled{opacity:.5}
</style>
