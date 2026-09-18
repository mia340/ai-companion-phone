<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import AppIconEditor from '../components/AppIconEditor.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  CUSTOMIZABLE_APPS,
  DEFAULT_HOME_APPEARANCE,
  listAppCustomizations,
  loadHomeAppearance,
  prepareHomeWallpaper,
  resetHomeWallpaper,
  saveHomeAppearance,
  type HomeAppDefinition,
  type HomeAppearancePreferences
} from '../services/appCustomizationService'

const worldId = ref('world-default')
const worldName = ref('草莓云世界')
const customIcons = ref<Record<string, string>>({})
const appearance = ref<HomeAppearancePreferences>({ ...DEFAULT_HOME_APPEARANCE })
const editingApp = ref<HomeAppDefinition | null>(null)
const wallpaperInput = ref<HTMLInputElement>()
const savingWallpaper = ref(false)
const notice = ref('')
const error = ref('')

const iconSize = computed(() => Math.round(58 * appearance.value.iconScale))
const previewStyle = computed(() => appearance.value.wallpaperDataUrl
  ? { backgroundImage: `linear-gradient(rgba(244,250,255,.18),rgba(218,235,247,.22)), url("${appearance.value.wallpaperDataUrl}")` }
  : undefined)

function flash(message: string) {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 1800)
}

async function load() {
  const worlds = await db.worlds.toArray()
  const world = worlds[0]
  worldId.value = world?.id || 'world-default'
  worldName.value = world?.name || '草莓云世界'

  const [savedIcons, savedAppearance] = await Promise.all([
    listAppCustomizations(worldId.value),
    loadHomeAppearance(worldId.value)
  ])
  customIcons.value = Object.fromEntries(
    savedIcons.filter(item => item.iconDataUrl).map(item => [item.appKey, item.iconDataUrl as string])
  )
  appearance.value = savedAppearance
}

async function persistAppearance(next: HomeAppearancePreferences) {
  appearance.value = next
  await saveHomeAppearance(worldId.value, next)
}

async function chooseScale(scale: number) {
  await persistAppearance({ ...appearance.value, iconScale: scale })
  flash('桌面图标大小已更新。')
}

async function toggleLabels() {
  await persistAppearance({ ...appearance.value, showAppLabels: !appearance.value.showAppLabels })
  flash(appearance.value.showAppLabels ? '已显示 App 名称。' : '已隐藏 App 名称。')
}

function chooseWallpaper() {
  wallpaperInput.value?.click()
}

async function handleWallpaper(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  savingWallpaper.value = true
  error.value = ''
  try {
    const wallpaperDataUrl = await prepareHomeWallpaper(file)
    await persistAppearance({ ...appearance.value, wallpaperDataUrl })
    flash('主屏幕壁纸已保存。')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '壁纸处理失败。'
  } finally {
    savingWallpaper.value = false
    if (wallpaperInput.value) wallpaperInput.value.value = ''
  }
}

async function resetWallpaper() {
  await resetHomeWallpaper(worldId.value)
  appearance.value = { ...appearance.value, wallpaperDataUrl: undefined }
  flash('已恢复默认壁纸。')
}

function onEditorSaved(iconDataUrl?: string) {
  if (!editingApp.value) return
  const key = editingApp.value.key
  const next = { ...customIcons.value }
  if (iconDataUrl) next[key] = iconDataUrl
  else delete next[key]
  customIcons.value = next
}

onMounted(load)
</script>

<template>
  <PhoneFrame title="桌面与外观" show-back>
    <main class="appearance-page">
      <p v-if="notice" class="notice">{{ notice }}</p>

      <section class="preview-card">
        <div class="preview-phone" :style="previewStyle">
          <div class="preview-status"><span>9:41</span><span>● ●●</span></div>
          <div class="preview-title">
            <small>{{ worldName }}</small>
            <b>主屏幕</b>
          </div>
          <div class="preview-grid">
            <div v-for="app in CUSTOMIZABLE_APPS.slice(0, 8)" :key="app.key" class="preview-app">
              <AppIcon :icon="app.icon" :custom-image="customIcons[app.key]" :tones="app.tone" :size="Math.round(27 * appearance.iconScale)" />
              <span v-if="appearance.showAppLabels">{{ app.label }}</span>
            </div>
          </div>
        </div>
        <div class="preview-copy">
          <small>主屏幕外观</small>
          <h2>把美化集中在这里</h2>
          <p>桌面只负责打开 App；壁纸、图标和显示方式统一在此设置。</p>
        </div>
      </section>

      <section class="setting-group">
        <div class="group-title">
          <div><b>壁纸</b><small>仅保存在本机，并随数据备份导出</small></div>
        </div>
        <div class="wallpaper-row">
          <button class="wallpaper-preview" type="button" :style="previewStyle" @click="chooseWallpaper">
            <span v-if="!appearance.wallpaperDataUrl">默认</span>
          </button>
          <div class="wallpaper-actions">
            <button class="primary" type="button" :disabled="savingWallpaper" @click="chooseWallpaper">
              {{ savingWallpaper ? '处理中…' : appearance.wallpaperDataUrl ? '更换壁纸' : '选择照片' }}
            </button>
            <button v-if="appearance.wallpaperDataUrl" class="secondary" type="button" @click="resetWallpaper">恢复默认</button>
          </div>
        </div>
        <input ref="wallpaperInput" type="file" accept="image/*" hidden @change="handleWallpaper">
        <p v-if="error" class="error">{{ error }}</p>
      </section>

      <section class="setting-group">
        <div class="group-title">
          <div><b>App 图标</b><small>点击 App 更换自己的图片；不会上传服务器</small></div>
        </div>
        <div class="icon-grid">
          <button v-for="app in CUSTOMIZABLE_APPS" :key="app.key" type="button" class="icon-choice" @click="editingApp = app">
            <AppIcon :icon="app.icon" :custom-image="customIcons[app.key]" :tones="app.tone" :size="iconSize" />
            <span>{{ app.label }}</span>
          </button>
        </div>
      </section>

      <section class="setting-group">
        <div class="group-title">
          <div><b>桌面显示</b><small>保持三列核心网格，只调整真实手机常见的显示项</small></div>
        </div>
        <div class="segmented-row">
          <span>图标大小</span>
          <div class="segmented">
            <button type="button" :class="{active:appearance.iconScale===0.88}" @click="chooseScale(0.88)">小</button>
            <button type="button" :class="{active:appearance.iconScale===1}" @click="chooseScale(1)">标准</button>
            <button type="button" :class="{active:appearance.iconScale===1.12}" @click="chooseScale(1.12)">大</button>
          </div>
        </div>
        <button class="toggle-row" type="button" @click="toggleLabels">
          <span><b>显示 App 名称</b><small>关闭后空间桌面只显示图标</small></span>
          <i :class="{on:appearance.showAppLabels}"><em></em></i>
        </button>
      </section>

      <p class="footnote">主屏幕空白处长按可快速进入这里。布局暂时固定为三列核心入口，避免主题包和不同屏幕宽度下出现错位。</p>

      <AppIconEditor
        :open="Boolean(editingApp)"
        :world-id="worldId"
        :app="editingApp"
        :current-image="editingApp ? customIcons[editingApp.key] : undefined"
        @close="editingApp = null"
        @saved="onEditorSaved"
      />
    </main>
  </PhoneFrame>
</template>

<style scoped>
.appearance-page{min-height:100%;padding:10px 14px 42px;background:#f3f7fa;color:#2c4255}.notice{position:sticky;top:6px;z-index:20;margin:0 0 10px;padding:9px 12px;border-radius:13px;background:#557f9f;color:#fff;text-align:center;font-size:11px;box-shadow:0 8px 22px rgba(57,91,116,.18)}
.preview-card{display:grid;grid-template-columns:136px 1fr;gap:14px;align-items:center;margin-bottom:14px;padding:14px;border:1px solid rgba(51,78,99,.07);border-radius:20px;background:#fff;box-shadow:0 6px 22px rgba(49,76,97,.055)}.preview-phone{height:226px;padding:8px;border-radius:24px;background:linear-gradient(160deg,#edf8ff,#dceefa);background-size:cover;background-position:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.85),0 7px 18px rgba(54,83,106,.12);overflow:hidden}.preview-status{display:flex;justify-content:space-between;padding:2px 4px 7px;font-size:7px;font-weight:700;color:#314a5f}.preview-title{display:grid;padding:4px 4px 8px}.preview-title small{font-size:6px;color:#6b8294}.preview-title b{font-size:13px}.preview-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px 4px}.preview-app{display:grid;justify-items:center;gap:3px;min-width:0}.preview-app span{max-width:31px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:5.5px;color:#30495d}.preview-copy small{color:#8b9ba8;font-size:10px}.preview-copy h2{margin:4px 0 7px;font-size:20px;letter-spacing:-.025em}.preview-copy p{margin:0;color:#788a98;font-size:11px;line-height:1.6}
.setting-group{margin-bottom:14px;overflow:hidden;border:1px solid rgba(51,78,99,.07);border-radius:17px;background:#fff;box-shadow:0 4px 16px rgba(49,76,97,.04)}.group-title{padding:13px 14px 9px;border-bottom:1px solid #eef2f5}.group-title>div{display:grid;gap:2px}.group-title b{font-size:14px}.group-title small{color:#8e9da9;font-size:10px}.wallpaper-row{display:flex;align-items:center;gap:14px;padding:14px}.wallpaper-preview{width:88px;height:124px;flex:0 0 auto;border:1px solid #dbe4ea;border-radius:17px;background:linear-gradient(160deg,#edf8ff,#dceefa);background-size:cover;background-position:center;color:#7890a2;font-size:11px;box-shadow:0 5px 14px rgba(48,78,101,.1)}.wallpaper-actions{display:grid;gap:8px;flex:1}.primary,.secondary{border:0;border-radius:12px;padding:10px 12px;font-size:11px;font-weight:700}.primary{background:#e6f1f8;color:#557f9f}.secondary{background:#f2f4f6;color:#7e8f9c}.primary:disabled{opacity:.55}.error{margin:-5px 14px 12px;color:#b64f63;font-size:10px}.icon-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:17px 6px;padding:16px 8px 18px}.icon-choice{display:grid;justify-items:center;gap:6px;padding:0;border:0;background:transparent;color:#3b5367}.icon-choice span{max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.icon-choice:active{transform:scale(.96)}
.segmented-row,.toggle-row{min-height:62px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.segmented-row{border-bottom:1px solid #eef2f5;font-size:13px}.segmented{display:flex;padding:2px;border-radius:10px;background:#eef3f6}.segmented button{min-width:46px;border:0;border-radius:8px;background:transparent;color:#718594;padding:7px 8px;font-size:10px}.segmented button.active{background:#fff;color:#35546b;box-shadow:0 2px 7px rgba(50,77,98,.12);font-weight:700}.toggle-row{width:100%;border:0;background:#fff;text-align:left}.toggle-row>span{display:grid;gap:3px}.toggle-row b{font-size:13px}.toggle-row small{color:#8d9ca8;font-size:10px}.toggle-row i{position:relative;width:42px;height:25px;flex:0 0 auto;border-radius:999px;background:#d4dce2;transition:.18s}.toggle-row i em{position:absolute;left:3px;top:3px;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.13);transition:.18s}.toggle-row i.on{background:#6da8d1}.toggle-row i.on em{transform:translateX(17px)}.footnote{margin:8px 6px 0;color:#94a2ad;font-size:9px;line-height:1.55}
@media(max-width:360px){.preview-card{grid-template-columns:118px 1fr}.preview-phone{height:206px}.icon-grid{gap:14px 3px}.segmented button{min-width:40px}}
</style>
