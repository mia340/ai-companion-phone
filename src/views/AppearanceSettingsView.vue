<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AppIconEditor from '../components/AppIconEditor.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  CUSTOMIZABLE_APPS,
  DEFAULT_HOME_APPEARANCE,
  WIDGET_CATALOG,
  listAppCustomizations,
  loadHomeAppearance,
  prepareHomeWallpaper,
  resetHomeWallpaper,
  resolveDockApps,
  resolveHomeApps,
  saveHomeAppearance,
  type HomeAppDefinition,
  type HomeAppKey,
  type HomeAppearancePreferences,
  type HomeWidgetKey,
  type HomeWidgetStyle
} from '../services/appCustomizationService'

const route = useRoute()
const worldId = ref('world-default')
const worldName = ref('草莓云世界')
const customIcons = ref<Record<string, string>>({})
const appearance = ref<HomeAppearancePreferences>({ ...DEFAULT_HOME_APPEARANCE })
const editingApp = ref<HomeAppDefinition | null>(null)
const wallpaperInput = ref<HTMLInputElement>()
const wallpaperSection = ref<HTMLElement>()
const savingWallpaper = ref(false)
const notice = ref('')
const error = ref('')

const iconSize = computed(() => Math.round(54 * appearance.value.iconScale))
const previewApps = computed(() => resolveHomeApps(appearance.value).slice(0, 8))
const previewDock = computed(() => resolveDockApps(appearance.value))
const previewStyle = computed(() => appearance.value.wallpaperDataUrl
  ? { backgroundImage: `linear-gradient(rgba(19,38,54,.04),rgba(19,38,54,.09)), url("${appearance.value.wallpaperDataUrl}")` }
  : undefined)
const homeAppSet = computed(() => new Set(appearance.value.homeAppKeys))
const dockAppSet = computed(() => new Set(appearance.value.dockAppKeys))
const widgetSet = computed(() => new Set(appearance.value.homeWidgetKeys))

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

  if (route.query.section === 'wallpaper') {
    await nextTick()
    wallpaperSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

async function persistAppearance(next: HomeAppearancePreferences) {
  appearance.value = await saveHomeAppearance(worldId.value, next)
}

async function chooseScale(scale: number) {
  await persistAppearance({ ...appearance.value, iconScale: scale })
  flash('桌面图标大小已更新。')
}

async function toggleLabels() {
  await persistAppearance({ ...appearance.value, showAppLabels: !appearance.value.showAppLabels })
}

async function chooseWidgetStyle(style: HomeWidgetStyle) {
  await persistAppearance({ ...appearance.value, widgetStyle: style })
}

async function toggleWidget(key: HomeWidgetKey) {
  const exists = appearance.value.homeWidgetKeys.includes(key)
  await persistAppearance({
    ...appearance.value,
    homeWidgetKeys: exists
      ? appearance.value.homeWidgetKeys.filter(item => item !== key)
      : [...appearance.value.homeWidgetKeys, key]
  })
}

async function toggleHomeApp(key: HomeAppKey) {
  const exists = appearance.value.homeAppKeys.includes(key)
  await persistAppearance({
    ...appearance.value,
    homeAppKeys: exists
      ? appearance.value.homeAppKeys.filter(item => item !== key)
      : [...appearance.value.homeAppKeys, key]
  })
}

async function toggleDockApp(key: HomeAppKey) {
  const exists = appearance.value.dockAppKeys.includes(key)
  if (!exists && appearance.value.dockAppKeys.length >= 4) {
    flash('Dock 最多放 4 个 App。')
    return
  }
  await persistAppearance({
    ...appearance.value,
    dockAppKeys: exists
      ? appearance.value.dockAppKeys.filter(item => item !== key)
      : [...appearance.value.dockAppKeys, key]
  })
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
  <PhoneFrame title="桌面与小组件" show-back>
    <main class="appearance-page">
      <p v-if="notice" class="notice">{{ notice }}</p>

      <section class="preview-card">
        <div class="preview-phone" :style="previewStyle">
          <div class="preview-status"><span>9:41</span><span>● ●●</span></div>
          <div v-if="appearance.homeWidgetKeys.includes('greeting')" class="preview-widget" :class="`style-${appearance.widgetStyle}`">
            <small>9月18日 星期五</small><b>上午好</b><span>{{ worldName }}</span>
          </div>
          <div class="preview-grid">
            <div v-for="app in previewApps" :key="app.key" class="preview-app">
              <AppIcon :icon="app.icon" :custom-image="customIcons[app.key]" :tones="app.tone" :size="Math.round(25 * appearance.iconScale)" />
              <span v-if="appearance.showAppLabels">{{ app.label }}</span>
            </div>
          </div>
          <div class="preview-dock">
            <AppIcon v-for="app in previewDock" :key="app.key" :icon="app.icon" :custom-image="customIcons[app.key]" :tones="app.tone" :size="24" />
          </div>
        </div>
        <div class="preview-copy">
          <small>主屏幕</small>
          <h2>像真实手机一样布置</h2>
          <p>壁纸、App、Dock 和小组件都由玩家自己组合；设置只保存在本机。</p>
        </div>
      </section>

      <section ref="wallpaperSection" class="setting-group">
        <div class="group-title">
          <div><b>墙纸</b><small>使用自己的照片，或恢复知间默认背景</small></div>
        </div>
        <div class="wallpaper-row">
          <button class="wallpaper-preview" type="button" :style="previewStyle" @click="chooseWallpaper">
            <span v-if="!appearance.wallpaperDataUrl">默认</span>
          </button>
          <div class="wallpaper-actions">
            <button class="primary" type="button" :disabled="savingWallpaper" @click="chooseWallpaper">
              {{ savingWallpaper ? '处理中…' : appearance.wallpaperDataUrl ? '更换墙纸' : '选择照片' }}
            </button>
            <button v-if="appearance.wallpaperDataUrl" class="secondary" type="button" @click="resetWallpaper">恢复默认</button>
          </div>
        </div>
        <input ref="wallpaperInput" type="file" accept="image/*" hidden @change="handleWallpaper">
        <p v-if="error" class="error">{{ error }}</p>
      </section>

      <section class="setting-group">
        <div class="group-title">
          <div><b>小组件</b><small>参考真实手机的小/中号组件，按需要组合</small></div>
        </div>
        <div class="widget-style-row">
          <span>组件材质</span>
          <div class="segmented">
            <button type="button" :class="{active:appearance.widgetStyle==='clear'}" @click="chooseWidgetStyle('clear')">通透</button>
            <button type="button" :class="{active:appearance.widgetStyle==='frosted'}" @click="chooseWidgetStyle('frosted')">毛玻璃</button>
            <button type="button" :class="{active:appearance.widgetStyle==='solid'}" @click="chooseWidgetStyle('solid')">实色</button>
          </div>
        </div>
        <div class="widget-grid">
          <button v-for="widget in WIDGET_CATALOG" :key="widget.key" type="button" class="widget-card" :class="{on:widgetSet.has(widget.key)}" @click="toggleWidget(widget.key)">
            <span class="widget-mark">{{ widget.key === 'greeting' ? '09:41' : widget.key === 'companion' ? '☺' : widget.key === 'world' ? '◎' : '♪' }}</span>
            <b>{{ widget.label }}</b>
            <small>{{ widget.description }}</small>
            <em>{{ widgetSet.has(widget.key) ? '已添加' : '添加' }}</em>
          </button>
        </div>
      </section>

      <section class="setting-group">
        <div class="group-title">
          <div><b>桌面 App</b><small>隐藏只会移除入口，不会删除任何数据</small></div>
        </div>
        <div class="place-list">
          <div v-for="app in CUSTOMIZABLE_APPS" :key="app.key" class="place-row">
            <div class="place-app">
              <AppIcon :icon="app.icon" :custom-image="customIcons[app.key]" :tones="app.tone" :size="42" />
              <span><b>{{ app.label }}</b><small>{{ app.route }}</small></span>
            </div>
            <button type="button" class="add-toggle" :class="{on:homeAppSet.has(app.key)}" @click="toggleHomeApp(app.key)">
              {{ homeAppSet.has(app.key) ? '桌面 ✓' : '加到桌面' }}
            </button>
          </div>
        </div>
      </section>

      <section class="setting-group">
        <div class="group-title">
          <div><b>Dock</b><small>底部常驻任务栏，最多 4 个 App</small></div>
          <span class="count">{{ appearance.dockAppKeys.length }}/4</span>
        </div>
        <div class="dock-picker">
          <button v-for="app in CUSTOMIZABLE_APPS" :key="app.key" type="button" class="dock-choice" :class="{on:dockAppSet.has(app.key)}" :disabled="!dockAppSet.has(app.key) && appearance.dockAppKeys.length >= 4" @click="toggleDockApp(app.key)">
            <AppIcon :icon="app.icon" :custom-image="customIcons[app.key]" :tones="app.tone" :size="48" />
            <span>{{ app.label }}</span>
          </button>
        </div>
      </section>

      <section class="setting-group">
        <div class="group-title">
          <div><b>App 图标</b><small>点击 App 换成自己的图片；不会上传服务器</small></div>
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
          <div><b>显示方式</b><small>调整图标大小和名称显示</small></div>
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
          <span><b>显示 App 名称</b><small>Dock 默认不显示名称，更接近真实手机</small></span>
          <i :class="{on:appearance.showAppLabels}"><em></em></i>
        </button>
      </section>

      <p class="footnote">所有桌面布局都写入当前世界的本地设置记录，并随数据备份导出；不会清除聊天、角色、记忆或朋友圈数据。</p>

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
.preview-card{display:grid;grid-template-columns:142px 1fr;gap:14px;align-items:center;margin-bottom:14px;padding:14px;border:1px solid rgba(51,78,99,.07);border-radius:20px;background:#fff;box-shadow:0 6px 22px rgba(49,76,97,.055)}.preview-phone{height:250px;padding:8px;border-radius:24px;background:linear-gradient(160deg,#edf8ff,#dceefa);background-size:cover;background-position:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.85),0 7px 18px rgba(54,83,106,.12);overflow:hidden;display:flex;flex-direction:column}.preview-status{display:flex;justify-content:space-between;padding:2px 4px 7px;font-size:7px;font-weight:700;color:#314a5f}.preview-widget{height:48px;margin:1px 3px 8px;padding:6px 8px;border-radius:12px;display:grid;grid-template-columns:1fr auto;gap:1px 6px;align-items:center;color:#355166}.preview-widget.style-frosted{background:rgba(255,255,255,.58)}.preview-widget.style-clear{background:rgba(255,255,255,.25)}.preview-widget.style-solid{background:#f9fcfe}.preview-widget small{font-size:5px;color:#72889a}.preview-widget b{font-size:11px}.preview-widget span{grid-column:1/-1;font-size:5px;color:#8295a3}.preview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px 3px;padding:0 2px}.preview-app{display:grid;justify-items:center;gap:2px;min-width:0}.preview-app span{max-width:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:4.8px;color:#30495d}.preview-dock{margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);place-items:center;padding:5px;border-radius:13px;background:rgba(255,255,255,.48)}.preview-copy small{color:#8b9ba8;font-size:10px}.preview-copy h2{margin:4px 0 7px;font-size:20px;letter-spacing:-.025em}.preview-copy p{margin:0;color:#788a98;font-size:11px;line-height:1.6}
.setting-group{margin-bottom:14px;overflow:hidden;border:1px solid rgba(51,78,99,.07);border-radius:17px;background:#fff;box-shadow:0 4px 16px rgba(49,76,97,.04);scroll-margin-top:10px}.group-title{min-height:58px;padding:12px 14px 9px;border-bottom:1px solid #eef2f5;display:flex;align-items:center;justify-content:space-between;gap:10px}.group-title>div{display:grid;gap:2px}.group-title b{font-size:14px}.group-title small{color:#8e9da9;font-size:10px}.count{font-size:10px;color:#8193a1}.wallpaper-row{display:flex;align-items:center;gap:14px;padding:14px}.wallpaper-preview{width:88px;height:124px;flex:0 0 auto;border:1px solid #dbe4ea;border-radius:17px;background:linear-gradient(160deg,#edf8ff,#dceefa);background-size:cover;background-position:center;color:#7890a2;font-size:11px;box-shadow:0 5px 14px rgba(48,78,101,.1)}.wallpaper-actions{display:grid;gap:8px;flex:1}.primary,.secondary{border:0;border-radius:12px;padding:10px 12px;font-size:11px;font-weight:700}.primary{background:#e6f1f8;color:#557f9f}.secondary{background:#f2f4f6;color:#7e8f9c}.primary:disabled{opacity:.55}.error{margin:-5px 14px 12px;color:#b64f63;font-size:10px}
.widget-style-row,.segmented-row,.toggle-row{min-height:62px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.widget-style-row,.segmented-row{border-bottom:1px solid #eef2f5;font-size:13px}.segmented{display:flex;padding:2px;border-radius:10px;background:#eef3f6}.segmented button{min-width:46px;border:0;border-radius:8px;background:transparent;color:#718594;padding:7px 8px;font-size:10px}.segmented button.active{background:#fff;color:#35546b;box-shadow:0 2px 7px rgba(50,77,98,.12);font-weight:700}.widget-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;padding:12px}.widget-card{position:relative;min-height:116px;padding:12px;border:1px solid #e6edf2;border-radius:16px;background:#f8fbfd;text-align:left;color:#3b5367;display:grid;align-content:start;gap:4px}.widget-card.on{border-color:#b8d8cb;background:#f0faf6}.widget-mark{display:grid;place-items:center;width:48px;height:36px;margin-bottom:4px;border-radius:11px;background:linear-gradient(145deg,#dfeef8,#fff);color:#5e7d94;font-size:15px;font-weight:700}.widget-card b{font-size:12px}.widget-card small{color:#8b9aa5;font-size:8.5px;line-height:1.45}.widget-card em{position:absolute;right:9px;top:9px;font-style:normal;color:#4c8d70;font-size:8px}.place-list{padding:0 12px}.place-row{min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #eef2f5}.place-row:last-child{border-bottom:0}.place-app{display:flex;align-items:center;gap:10px;min-width:0}.place-app>span{display:grid;min-width:0}.place-app b{font-size:12px}.place-app small{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9aa6af;font-size:8px}.add-toggle{flex:0 0 auto;border:0;border-radius:999px;padding:7px 10px;background:#edf2f5;color:#728591;font-size:9px}.add-toggle.on{background:#e2f4eb;color:#168b5c;font-weight:700}.dock-picker,.icon-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 5px;padding:15px 8px 18px}.dock-choice,.icon-choice{display:grid;justify-items:center;gap:6px;padding:0;border:0;background:transparent;color:#3b5367}.dock-choice{position:relative;opacity:.75}.dock-choice.on{opacity:1}.dock-choice.on::after{content:'✓';position:absolute;right:5px;top:-3px;width:17px;height:17px;display:grid;place-items:center;border-radius:50%;background:#23ad72;color:#fff;font-size:9px;border:1px solid #fff}.dock-choice:disabled{opacity:.28}.dock-choice span,.icon-choice span{max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}.icon-choice:active{transform:scale(.96)}
.toggle-row{width:100%;border:0;background:#fff;text-align:left}.toggle-row>span{display:grid;gap:3px}.toggle-row b{font-size:13px}.toggle-row small{color:#8d9ca8;font-size:10px}.toggle-row i{position:relative;width:42px;height:25px;flex:0 0 auto;border-radius:999px;background:#d4dce2;transition:.18s}.toggle-row i em{position:absolute;left:3px;top:3px;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.13);transition:.18s}.toggle-row i.on{background:#6da8d1}.toggle-row i.on em{transform:translateX(17px)}.footnote{margin:8px 6px 0;color:#94a2ad;font-size:9px;line-height:1.55}
@media(max-width:360px){.preview-card{grid-template-columns:124px 1fr}.preview-phone{height:226px}.dock-picker,.icon-grid{gap:13px 3px}.segmented button{min-width:40px}.widget-style-row{align-items:flex-start;flex-direction:column}.place-app small{max-width:105px}}
</style>
