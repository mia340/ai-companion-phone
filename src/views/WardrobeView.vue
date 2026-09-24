<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import CompanionPixelAvatar from '../components/avatar/CompanionPixelAvatar.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import { getOrCreateUserProfile } from '../services/userProfile'
import {
  BOTTOM_STYLES,
  FACEWEAR,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR,
  NECKWEAR,
  OUTFIT_COLORS,
  SELF_AVATAR_TARGET_ID,
  SHOES_STYLES,
  SKIN_TONES,
  TOP_STYLES,
  addWardrobeOutfit,
  chooseDailyOutfit,
  createAvatarAppearanceProfile,
  defaultGenderStyle,
  deleteActiveWardrobeOutfit,
  ensureWardrobeProfile,
  loadWardrobeState,
  normalizeCustomColor,
  rememberCustomColor,
  saveWardrobeState,
  setAvatarGenderStyle,
  setDailyMode,
  updateActiveOutfit,
  upsertWardrobeProfile,
  type AvatarAppearanceProfile,
  type AvatarDailyMode,
  type AvatarGenderStyle,
  type AvatarOutfit,
  type AvatarOutfitCategory,
  type WardrobeState
} from '../services/avatarWardrobeService'
import type { Character, UserProfile } from '../types/domain'

type EditorTab = 'body' | 'hair' | 'top' | 'bottom' | 'accessory' | 'outfits' | 'daily'

const router = useRouter()
const worldId = ref('world-default')
const characters = ref<Character[]>([])
const selfProfile = ref<UserProfile>()
const wardrobe = ref<WardrobeState>({ version: 1, profiles: {} })
const activeTargetId = ref(SELF_AVATAR_TARGET_ID)
const activeTab = ref<EditorTab>('hair')
const loading = ref(true)
const saving = ref(false)
const savedPulse = ref(false)
const editorScrollEl = ref<HTMLElement>()
const colorDraft = ref('#B95C7B')
let persistQueued = false

const targets = computed(() => [
  { id: SELF_AVATAR_TARGET_ID, type: 'self' as const, name: selfProfile.value?.name || '我', avatar: selfProfile.value?.avatar || '🙂', gender: undefined },
  ...characters.value.map(character => ({ id: character.id, type: 'character' as const, name: character.name, avatar: character.avatar, gender: character.gender }))
])
const activeTarget = computed(() => targets.value.find(row => row.id === activeTargetId.value) || targets.value[0])
const activeProfile = computed<AvatarAppearanceProfile>(() => {
  const target = activeTarget.value
  if (!target) return createAvatarAppearanceProfile(SELF_AVATAR_TARGET_ID, 'self', 'female')
  return ensureWardrobeProfile(wardrobe.value, target.id, target.type, defaultGenderStyle(target.gender))
})
const activeOutfit = computed<AvatarOutfit>(() => activeProfile.value.outfits.find(row => row.id === activeProfile.value.activeOutfitId) || activeProfile.value.outfits[0]!)
const hairStyles = computed(() => HAIR_STYLES[activeProfile.value.genderStyle])
const topStyles = computed(() => TOP_STYLES[activeProfile.value.genderStyle])
const bottomStyles = computed(() => BOTTOM_STYLES[activeProfile.value.genderStyle])

const CATEGORY_LABELS: Record<AvatarOutfitCategory, string> = {
  daily: '日常', home: '居家', date: '约会', sleepwear: '睡衣', formal: '正式', private: '私房'
}
const DAILY_LABELS: Record<AvatarDailyMode, { title: string; desc: string }> = {
  auto: { title: 'TA 自己决定', desc: '角色每天从自己的衣橱里换一套；同一天全 App 共用。' },
  ask: { title: '先问我', desc: '保留自动换装意图，但需要你确认后才切换。' },
  manual: { title: '只由我换', desc: '不自动变化，保持你最后选中的套装。' }
}
const TAB_ITEMS: Array<{ id: EditorTab; label: string; icon: string }> = [
  { id: 'body', label: '人物', icon: '◉' },
  { id: 'hair', label: '发型', icon: '✦' },
  { id: 'top', label: '上装', icon: '▰' },
  { id: 'bottom', label: '下装', icon: '▥' },
  { id: 'accessory', label: '配饰', icon: '◇' },
  { id: 'outfits', label: '套装', icon: '▦' },
  { id: 'daily', label: '每日', icon: '☀' }
]

function replaceProfile(profile: AvatarAppearanceProfile) {
  wardrobe.value = upsertWardrobeProfile(wardrobe.value, profile)
  void persist()
}

async function persist() {
  if (saving.value) {
    persistQueued = true
    return
  }
  saving.value = true
  try {
    wardrobe.value = await saveWardrobeState(worldId.value, wardrobe.value)
    savedPulse.value = true
    window.setTimeout(() => { savedPulse.value = false }, 900)
  } finally {
    saving.value = false
    if (persistQueued) {
      persistQueued = false
      void persist()
    }
  }
}

function chooseTarget(id: string) {
  activeTargetId.value = id
  selectTab('hair')
  const target = targets.value.find(row => row.id === id)
  if (!target || wardrobe.value.profiles[id]) return
  wardrobe.value = upsertWardrobeProfile(wardrobe.value, createAvatarAppearanceProfile(target.id, target.type, defaultGenderStyle(target.gender)))
  void persist()
}

function selectTab(tab: EditorTab) {
  activeTab.value = tab
  void nextTick(() => editorScrollEl.value?.scrollTo({ top: 0, behavior: 'auto' }))
}

function changeGender(value: AvatarGenderStyle) { replaceProfile(setAvatarGenderStyle(activeProfile.value, value)) }
function patchProfile(patch: Partial<AvatarAppearanceProfile>) { replaceProfile({ ...activeProfile.value, ...patch }) }
function patchOutfit(patch: Partial<AvatarOutfit>) { replaceProfile(updateActiveOutfit(activeProfile.value, patch)) }
function chooseOutfit(id: string) { patchProfile({ activeOutfitId: id, dailyOutfitId: id }) }
function newOutfit() { replaceProfile(addWardrobeOutfit(activeProfile.value, `穿搭 ${activeProfile.value.outfits.length + 1}`)) }
function removeOutfit() { replaceProfile(deleteActiveWardrobeOutfit(activeProfile.value)) }
function setCategory(value: string) { if (value in CATEGORY_LABELS) patchOutfit({ category: value as AvatarOutfitCategory }) }
function changeDailyMode(mode: AvatarDailyMode) { replaceProfile(setDailyMode(activeProfile.value, mode)) }
function changeDailyModeKey(mode: string | number) {
  if (mode === 'auto' || mode === 'ask' || mode === 'manual') changeDailyMode(mode)
}

function applyCustomColor(target: 'hair' | 'top' | 'bottom' | 'shoes') {
  const normalized = normalizeCustomColor(colorDraft.value)
  if (!normalized) return
  const remembered = rememberCustomColor(activeProfile.value, normalized)
  if (target === 'hair') replaceProfile({ ...remembered, hairColor: normalized })
  else replaceProfile(updateActiveOutfit(remembered, { [`${target}Color`]: normalized } as Partial<AvatarOutfit>))
}

function useSavedColor(target: 'hair' | 'top' | 'bottom' | 'shoes', color: string) {
  colorDraft.value = color
  if (target === 'hair') patchProfile({ hairColor: color })
  else patchOutfit({ [`${target}Color`]: color } as Partial<AvatarOutfit>)
}

function dateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function pickTodayNow() {
  const updated = setDailyMode(activeProfile.value, 'auto')
  replaceProfile(chooseDailyOutfit({ ...updated, dailyOutfitDate: undefined, dailyOutfitId: undefined }, dateKey()))
}

onMounted(async () => {
  worldId.value = await getActiveWorldId()
  const [rows, me, saved] = await Promise.all([
    db.characters.where('worldId').equals(worldId.value).toArray(),
    getOrCreateUserProfile(),
    loadWardrobeState(worldId.value)
  ])
  characters.value = rows.length ? rows : await db.characters.toArray()
  selfProfile.value = me
  wardrobe.value = saved

  const allTargets = [
    { id: SELF_AVATAR_TARGET_ID, type: 'self' as const, gender: undefined },
    ...characters.value.map(character => ({ id: character.id, type: 'character' as const, gender: character.gender }))
  ]
  let next = saved
  let changed = false
  for (const target of allTargets) {
    if (!next.profiles[target.id]) {
      next = upsertWardrobeProfile(next, createAvatarAppearanceProfile(target.id, target.type, defaultGenderStyle(target.gender)))
      changed = true
    }
  }
  wardrobe.value = next
  loading.value = false
  if (changed) await persist()
})
</script>

<template>
  <PhoneFrame lock-scroll>
    <main class="wardrobe-app">
      <header class="wardrobe-nav">
        <button aria-label="返回" @click="router.back()">‹</button>
        <div><small>WARDROBE · V1.2</small><b>穿搭</b></div>
        <span :class="{ saved: savedPulse }">{{ saving ? '保存中' : savedPulse ? '已保存' : '自动保存' }}</span>
      </header>

      <section v-if="loading" class="wardrobe-loading">正在打开衣橱…</section>
      <template v-else>
        <section class="wardrobe-workbench">
          <div class="preview-pane">
            <div class="target-strip" aria-label="选择角色">
              <button v-for="target in targets" :key="target.id" :class="{ active: target.id === activeTargetId }" @click="chooseTarget(target.id)">
                <CharacterAvatar :avatar="target.avatar" :name="target.name" :size="31" />
                <span>{{ target.id === 'self' ? '我' : target.name }}</span>
              </button>
            </div>

            <div class="pixel-room">
              <div class="room-sky"><i></i><b></b></div>
              <div class="room-shelf"><i></i><i></i><i></i></div>
              <div class="room-plant"><i></i><b></b></div>
              <div class="room-rug"></div>
              <div class="preview-title"><small>{{ activeTarget?.type === 'self' ? 'MY LOOK' : 'CHARACTER LOOK' }}</small><b>{{ activeTarget?.name }}</b></div>
              <div class="avatar-pedestal">
                <CompanionPixelAvatar :profile="activeProfile" :size="168" animation="idle" active :label="activeTarget?.name" />
              </div>
              <div class="preview-meta">
                <span>{{ activeProfile.genderStyle === 'female' ? '女生版型' : '男生版型' }}</span>
                <strong>{{ activeOutfit.name }}</strong>
                <em>{{ CATEGORY_LABELS[activeOutfit.category] }}</em>
              </div>
            </div>
          </div>

          <div class="editor-pane">
            <nav class="editor-tabs" aria-label="穿搭分类">
              <button v-for="tab in TAB_ITEMS" :key="tab.id" :class="{ active: activeTab === tab.id }" @click="selectTab(tab.id)"><span>{{ tab.icon }}</span><b>{{ tab.label }}</b></button>
            </nav>

            <div ref="editorScrollEl" class="editor-scroll">
              <section v-if="activeTab === 'body'" class="editor-section">
                <header><small>CHARACTER</small><h2>人物基础</h2><p>版型、肤色和眼睛只影响像素形象，不改角色设定与 Memory。</p></header>
                <div class="section-label">版型</div>
                <div class="segmented"><button :class="{ active: activeProfile.genderStyle === 'female' }" @click="changeGender('female')">女生</button><button :class="{ active: activeProfile.genderStyle === 'male' }" @click="changeGender('male')">男生</button></div>
                <div class="section-label">肤色</div>
                <div class="swatches"><button v-for="tone in SKIN_TONES" :key="tone.id" :class="{ active: activeProfile.skinTone === tone.id }" :style="{ '--swatch': tone.color }" @click="patchProfile({ skinTone: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
              </section>

              <section v-else-if="activeTab === 'hair'" class="editor-section">
                <header><small>HAIR</small><h2>发型与发色</h2><p>发型按前发 / 侧发 / 后发分层，长发不会再盖住整张脸。</p></header>
                <div class="choice-grid"><button v-for="style in hairStyles" :key="style.id" :class="{ active: activeProfile.hairStyle === style.id }" @click="patchProfile({ hairStyle: style.id })">{{ style.label }}</button></div>
                <div class="section-label">发色预设</div>
                <div class="swatches"><button v-for="tone in HAIR_COLORS" :key="tone.id" :class="{ active: activeProfile.hairColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchProfile({ hairColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
                <div class="color-lab">
                  <label><span>自由选色</span><input v-model="colorDraft" type="color"></label>
                  <label><span>HEX</span><input v-model="colorDraft" maxlength="7" placeholder="#6A4A3D"></label>
                  <button @click="applyCustomColor('hair')">应用并收藏</button>
                </div>
                <div v-if="activeProfile.customColors?.length" class="saved-colors"><button v-for="color in activeProfile.customColors" :key="color" :style="{ '--swatch': color }" @click="useSavedColor('hair', color)"><i></i></button></div>
              </section>

              <section v-else-if="activeTab === 'top'" class="editor-section">
                <header><small>TOP</small><h2>上装</h2><p>先把版型做清楚，再自由调颜色；不同款式在地图缩小后也能认出来。</p></header>
                <div class="choice-grid"><button v-for="style in topStyles" :key="style.id" :class="{ active: activeOutfit.topStyle === style.id }" @click="patchOutfit({ topStyle: style.id })">{{ style.label }}</button></div>
                <div class="section-label">颜色预设</div>
                <div class="swatches"><button v-for="tone in OUTFIT_COLORS" :key="tone.id" :class="{ active: activeOutfit.topColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchOutfit({ topColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
                <div class="color-lab"><label><span>自由选色</span><input v-model="colorDraft" type="color"></label><label><span>HEX</span><input v-model="colorDraft" maxlength="7"></label><button @click="applyCustomColor('top')">应用并收藏</button></div>
                <div v-if="activeProfile.customColors?.length" class="saved-colors"><button v-for="color in activeProfile.customColors" :key="color" :style="{ '--swatch': color }" @click="useSavedColor('top', color)"><i></i></button></div>
              </section>

              <section v-else-if="activeTab === 'bottom'" class="editor-section">
                <header><small>BOTTOM</small><h2>下装</h2><p>裙装、裤装和鞋履分开选择，配色可以独立调整。</p></header>
                <div class="choice-grid"><button v-for="style in bottomStyles" :key="style.id" :class="{ active: activeOutfit.bottomStyle === style.id }" @click="patchOutfit({ bottomStyle: style.id })">{{ style.label }}</button></div>
                <div class="section-label">下装颜色</div>
                <div class="swatches"><button v-for="tone in OUTFIT_COLORS" :key="tone.id" :class="{ active: activeOutfit.bottomColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchOutfit({ bottomColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
                <div class="color-lab"><label><span>自由选色</span><input v-model="colorDraft" type="color"></label><label><span>HEX</span><input v-model="colorDraft" maxlength="7"></label><button @click="applyCustomColor('bottom')">应用并收藏</button></div>
                <div class="section-label">鞋履</div>
                <div class="choice-grid"><button v-for="style in SHOES_STYLES" :key="style.id" :class="{ active: activeOutfit.shoesStyle === style.id }" @click="patchOutfit({ shoesStyle: style.id })">{{ style.label }}</button></div>
                <div class="swatches compact"><button v-for="tone in OUTFIT_COLORS" :key="tone.id" :class="{ active: activeOutfit.shoesColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchOutfit({ shoesColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
              </section>

              <section v-else-if="activeTab === 'accessory'" class="editor-section">
                <header><small>ACCESSORY</small><h2>配饰分层</h2><p>头饰、脸部与颈部可以同时搭，不再只能三选一。</p></header>
                <div class="section-label">头饰</div>
                <div class="choice-grid"><button v-for="item in HEADWEAR" :key="item.id" :class="{ active: (activeOutfit.headwear || 'none') === item.id }" @click="patchOutfit({ headwear: item.id })">{{ item.label }}</button></div>
                <div class="section-label">脸部</div>
                <div class="choice-grid"><button v-for="item in FACEWEAR" :key="item.id" :class="{ active: (activeOutfit.facewear || 'none') === item.id }" @click="patchOutfit({ facewear: item.id })">{{ item.label }}</button></div>
                <div class="section-label">颈部</div>
                <div class="choice-grid"><button v-for="item in NECKWEAR" :key="item.id" :class="{ active: (activeOutfit.neckwear || 'none') === item.id }" @click="patchOutfit({ neckwear: item.id })">{{ item.label }}</button></div>
              </section>

              <section v-else-if="activeTab === 'outfits'" class="editor-section">
                <header><small>OUTFITS</small><h2>套装衣橱</h2><p>每个角色默认带一组基础套装，也可以继续保存自己的搭配。</p></header>
                <label class="name-field"><span>套装名字</span><input :value="activeOutfit.name" maxlength="24" @change="patchOutfit({ name: ($event.target as HTMLInputElement).value || '我的穿搭' })"></label>
                <div class="outfit-grid">
                  <button v-for="outfit in activeProfile.outfits" :key="outfit.id" :class="{ active: outfit.id === activeProfile.activeOutfitId }" @click="chooseOutfit(outfit.id)"><small>{{ CATEGORY_LABELS[outfit.category] }}</small><b>{{ outfit.name }}</b></button>
                  <button class="add-outfit" @click="newOutfit"><b>＋</b><span>复制当前穿搭</span></button>
                </div>
                <div class="section-label">场景分类</div>
                <div class="choice-grid categories"><button v-for="(label, key) in CATEGORY_LABELS" :key="key" :class="{ active: activeOutfit.category === key }" @click="setCategory(String(key))">{{ label }}</button></div>
                <button v-if="activeProfile.outfits.length > 1" class="delete-outfit" @click="removeOutfit">删除当前自定义套装</button>
              </section>

              <section v-else class="editor-section daily-section">
                <header><small>DAILY LOOK</small><h2>每日自主换装</h2><p>角色可以每天自己从衣橱里选一套；同一天飞行棋和后续小游戏会使用同一造型。</p></header>
                <div class="daily-modes">
                  <button v-for="(meta, mode) in DAILY_LABELS" :key="mode" :class="{ active: (activeProfile.dailyMode || (activeTarget?.type === 'character' ? 'auto' : 'manual')) === mode }" @click="changeDailyModeKey(mode)"><b>{{ meta.title }}</b><span>{{ meta.desc }}</span></button>
                </div>
                <button class="today-pick" @click="pickTodayNow">今天重新搭一套</button>
                <div class="daily-summary"><small>今天的造型</small><b>{{ activeOutfit.name }}</b><span v-if="activeProfile.dailyOutfitDate">已记录 {{ activeProfile.dailyOutfitDate }}</span><span v-else>尚未自动选择</span></div>
                <div v-if="activeProfile.outfitHistory?.length" class="history-list"><small>最近穿过</small><div v-for="row in [...(activeProfile.outfitHistory || [])].reverse().slice(0, 7)" :key="`${row.date}-${row.outfitId}`"><span>{{ row.date }}</span><b>{{ activeProfile.outfits.find(outfit => outfit.id === row.outfitId)?.name || '已删除套装' }}</b></div></div>
              </section>
            </div>
          </div>
        </section>
      </template>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.wardrobe-app{height:100%;overflow:hidden;background:#eee1ca;color:#49352b;padding:7px 10px 9px}.wardrobe-nav{position:relative;z-index:30;height:44px;display:grid;grid-template-columns:34px 1fr 58px;align-items:center}.wardrobe-nav>button{width:30px;height:30px;border:1px solid #c89f72;border-radius:8px;background:#fff4dd;color:#6d4737;font-size:20px;box-shadow:0 3px 0 #ad7f55}.wardrobe-nav>div{text-align:center;display:grid}.wardrobe-nav small{font-size:5px;letter-spacing:.17em;color:#9d6b50}.wardrobe-nav b{font:700 11px Georgia,"Songti SC",serif}.wardrobe-nav>span{justify-self:end;font-size:5.8px;color:#967f70}.wardrobe-nav>span.saved{color:#5d815f}.wardrobe-loading{display:grid;place-items:center;height:75%;color:#90786b}.wardrobe-workbench{height:calc(100% - 44px);display:grid;grid-template-rows:minmax(272px,43%) minmax(0,57%);gap:7px;overflow:hidden}.preview-pane{min-height:0;display:grid;grid-template-rows:55px minmax(0,1fr);gap:5px}.target-strip{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:2px 1px}.target-strip::-webkit-scrollbar{display:none}.target-strip button{flex:0 0 55px;border:1px solid #cda97f;border-bottom-width:3px;border-radius:10px;background:#fff7e8;padding:5px 3px 4px;color:#674b3f;display:grid;justify-items:center;gap:2px}.target-strip button.active{border-color:#915544;background:#fff0cc;box-shadow:0 0 0 2px rgba(145,85,68,.1)}.target-strip span{font-size:5.6px;max-width:48px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pixel-room{position:relative;overflow:hidden;border:3px solid #9b6d43;border-radius:15px;background:linear-gradient(#e7c995 0 63%,#b87446 63% 100%);box-shadow:inset 0 0 0 3px #f8e7bd,0 4px 0 #7d5437}.pixel-room::before{content:'';position:absolute;inset:63% 0 0;background:repeating-linear-gradient(90deg,transparent 0 30px,rgba(72,42,26,.17) 30px 32px),repeating-linear-gradient(0deg,transparent 0 18px,rgba(72,42,26,.12) 18px 20px)}.room-sky{position:absolute;left:13px;top:15px;width:74px;height:58px;border:6px solid #855936;background:linear-gradient(#66b6dd 0 64%,#6f9b62 64%);box-shadow:inset 0 0 0 3px #efd6a0}.room-sky::before,.room-sky::after{content:'';position:absolute;background:#855936}.room-sky::before{left:31px;top:0;width:4px;height:100%}.room-sky::after{left:0;top:25px;width:100%;height:4px}.room-sky i{position:absolute;width:11px;height:11px;border-radius:50%;background:#f5d77d;top:7px;right:8px}.room-sky b{position:absolute;left:5px;right:5px;bottom:5px;height:15px;background:#4d7952;clip-path:polygon(0 100%,18% 30%,32% 100%,50% 44%,68% 100%,85% 28%,100% 100%)}.room-shelf{position:absolute;right:12px;top:20px;width:50px;height:43px;border-bottom:4px solid #8b5d39}.room-shelf i{position:absolute;bottom:4px;width:10px;border:2px solid #80523a;background:#c98455}.room-shelf i:nth-child(1){left:4px;height:18px}.room-shelf i:nth-child(2){left:20px;height:27px;background:#8aa06f}.room-shelf i:nth-child(3){right:3px;height:14px;background:#bb6f68}.room-plant{position:absolute;right:18px;bottom:19px;width:34px;height:54px}.room-plant::after{content:'';position:absolute;left:9px;bottom:0;width:20px;height:18px;background:#9c573e;border:3px solid #76432f}.room-plant i,.room-plant b{position:absolute;background:#5b8253;width:13px;height:23px;border-radius:80% 20%}.room-plant i{left:3px;top:10px;transform:rotate(-28deg)}.room-plant b{right:1px;top:2px;transform:rotate(26deg)}.room-rug{position:absolute;left:50%;bottom:9px;width:132px;height:29px;transform:translateX(-50%);border-radius:50%;background:#bd6e57;box-shadow:inset 0 0 0 5px #e3a268}.preview-title{position:absolute;left:10px;bottom:9px;z-index:4;display:grid;padding:5px 7px;border-radius:6px;background:rgba(74,48,34,.78);color:#fff3d8}.preview-title small{font-size:4.4px;letter-spacing:.13em;opacity:.74}.preview-title b{font-size:7.2px;margin-top:1px}.avatar-pedestal{position:absolute;left:50%;bottom:4px;z-index:3;transform:translateX(-50%);display:grid;place-items:end center;width:210px;height:202px}.preview-meta{position:absolute;right:8px;top:7px;z-index:4;display:grid;justify-items:end;gap:2px}.preview-meta span,.preview-meta em{font-style:normal;font-size:5px;padding:3px 5px;border-radius:999px;background:rgba(255,246,219,.88);color:#654637}.preview-meta strong{max-width:96px;font-size:6.5px;padding:4px 6px;border-radius:6px;background:#684637;color:#fff4df;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.editor-pane{min-height:0;display:grid;grid-template-rows:47px minmax(0,1fr);border:2px solid #b9885d;border-bottom-width:5px;border-radius:14px;background:#fff5df;overflow:hidden;box-shadow:0 4px 0 #8e6041}.editor-tabs{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;padding:5px;background:#dec09a;border-bottom:2px solid #b9885d}.editor-tabs button{min-width:0;border:0;border-radius:6px;background:transparent;color:#72503d;padding:4px 0;display:grid;justify-items:center;gap:1px}.editor-tabs button span{font-size:8px;line-height:1}.editor-tabs button b{font-size:4.7px}.editor-tabs button.active{background:#885748;color:#fff2d8;box-shadow:inset 0 -2px rgba(0,0,0,.16)}.editor-scroll{min-height:0;overflow:auto;padding:10px 11px 18px;scrollbar-width:thin;scrollbar-color:#ae8467 transparent}.editor-section header{margin-bottom:10px}.editor-section header small{font-size:4.8px;letter-spacing:.15em;color:#a16d50}.editor-section h2{margin:2px 0 3px;font:700 14px Georgia,"Songti SC",serif}.editor-section header p{margin:0;color:#927260;font-size:5.8px;line-height:1.55}.section-label{font-size:6px;font-weight:900;margin:11px 0 6px;color:#634432}.segmented{display:grid;grid-template-columns:1fr 1fr;gap:5px}.segmented button,.choice-grid button{border:1px solid #cfab84;border-bottom-width:3px;border-radius:7px;background:#fffaf0;color:#684c3e;padding:8px 4px;font-size:6px}.segmented button.active,.choice-grid button.active{border-color:#905446;background:#edcda6;color:#563328;font-weight:900}.choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.swatches{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.swatches.compact{margin-top:7px}.swatches button{border:1px solid #d0ac85;border-bottom-width:3px;border-radius:8px;background:#fffaf0;padding:5px 2px;display:grid;justify-items:center;gap:3px;color:#6b5144;font-size:4.9px}.swatches i{width:22px;height:22px;border-radius:4px;background:var(--swatch);box-shadow:inset 0 0 0 2px rgba(67,46,35,.08)}.swatches button.active{border-color:#905446;background:#f7ddba}.swatches button.active i{box-shadow:0 0 0 2px #fff,0 0 0 4px #905446}.color-lab{margin-top:9px;display:grid;grid-template-columns:72px 1fr 74px;gap:5px;align-items:end}.color-lab label{display:grid;gap:3px;font-size:5px;color:#75594b}.color-lab input{height:30px;min-width:0;border:1px solid #d0ac85;border-radius:7px;background:#fffaf0;padding:3px 6px;color:#543b30}.color-lab input[type=color]{padding:2px}.color-lab button{height:30px;border:1px solid #986051;border-bottom-width:3px;border-radius:7px;background:#8c5849;color:#fff2db;font-size:5.4px}.saved-colors{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.saved-colors button{width:28px;height:28px;border:1px solid #cda983;border-bottom-width:3px;border-radius:7px;background:#fffaf0;padding:3px}.saved-colors i{display:block;width:100%;height:100%;border-radius:4px;background:var(--swatch)}.name-field{display:grid;grid-template-columns:60px 1fr;align-items:center;gap:6px;padding:8px;border:1px solid #d5b18b;border-radius:8px;background:#fffaf0}.name-field span{font-size:5.5px;color:#7d6253}.name-field input{min-width:0;border:0;background:transparent;outline:0;font-size:7px;color:#4d382e}.outfit-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px}.outfit-grid button{min-height:47px;border:1px solid #d0ac85;border-bottom-width:3px;border-radius:8px;background:#fffaf0;color:#66493a;padding:7px;display:grid;text-align:left}.outfit-grid button.active{border-color:#8e5446;background:#edcda6;color:#553027}.outfit-grid small{font-size:5px;opacity:.65}.outfit-grid b{font-size:6.5px;margin-top:2px}.outfit-grid .add-outfit{place-items:center;text-align:center;background:#f4e0bf}.outfit-grid .add-outfit b{font-size:15px;line-height:1}.outfit-grid .add-outfit span{font-size:5.3px}.categories{grid-template-columns:repeat(3,1fr)}.delete-outfit,.today-pick{width:100%;margin-top:12px;border:1px solid #c79b77;border-bottom-width:3px;border-radius:8px;background:#f8dfc5;color:#7a4739;padding:8px;font-size:6px}.delete-outfit{background:#fff0e6;color:#a15347}.daily-modes{display:grid;gap:7px}.daily-modes button{border:1px solid #d0ac85;border-bottom-width:3px;border-radius:9px;background:#fffaf0;color:#63483a;padding:9px;text-align:left;display:grid;gap:3px}.daily-modes button.active{border-color:#8e5446;background:#edcda6}.daily-modes b{font-size:7px}.daily-modes span{font-size:5.5px;line-height:1.5;color:#8c6e5c}.daily-summary{margin-top:10px;border:1px solid #d0ac85;border-radius:9px;background:#fffaf0;padding:9px;display:grid;gap:2px}.daily-summary small,.history-list>small{font-size:5px;color:#9a725c}.daily-summary b{font-size:8px}.daily-summary span{font-size:5.5px;color:#806354}.history-list{margin-top:10px;display:grid;gap:4px}.history-list>div{display:grid;grid-template-columns:82px 1fr;gap:6px;padding:6px 8px;border-radius:7px;background:#f5e3ca}.history-list span{font-size:5.2px;color:#8b6d5b}.history-list b{font-size:5.8px}@media(max-height:720px){.wardrobe-workbench{grid-template-rows:minmax(235px,40%) minmax(0,60%)}.avatar-pedestal{height:166px}.preview-title{display:none}}@media(prefers-reduced-motion:reduce){.wardrobe-app *{scroll-behavior:auto!important}}
</style>
