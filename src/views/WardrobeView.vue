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
  ACCESSORIES,
  BOTTOM_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  SELF_AVATAR_TARGET_ID,
  SKIN_TONES,
  TOP_STYLES,
  addWardrobeOutfit,
  createAvatarAppearanceProfile,
  defaultGenderStyle,
  deleteActiveWardrobeOutfit,
  ensureWardrobeProfile,
  loadWardrobeState,
  saveWardrobeState,
  setAvatarGenderStyle,
  updateActiveOutfit,
  upsertWardrobeProfile,
  type AvatarAppearanceProfile,
  type AvatarGenderStyle,
  type AvatarOutfit,
  type AvatarOutfitCategory,
  type WardrobeState
} from '../services/avatarWardrobeService'
import type { Character, UserProfile } from '../types/domain'

type EditorTab = 'body' | 'hair' | 'top' | 'bottom' | 'accessory' | 'outfits'

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
const TAB_ITEMS: Array<{ id: EditorTab; label: string; icon: string }> = [
  { id: 'body', label: '人物', icon: '◉' },
  { id: 'hair', label: '头发', icon: '✦' },
  { id: 'top', label: '上装', icon: '▰' },
  { id: 'bottom', label: '下装', icon: '▥' },
  { id: 'accessory', label: '配饰', icon: '◇' },
  { id: 'outfits', label: '套装', icon: '▦' }
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
  wardrobe.value = upsertWardrobeProfile(
    wardrobe.value,
    createAvatarAppearanceProfile(target.id, target.type, defaultGenderStyle(target.gender))
  )
  void persist()
}


function selectTab(tab: EditorTab) {
  activeTab.value = tab
  void nextTick(() => editorScrollEl.value?.scrollTo({ top: 0, behavior: 'auto' }))
}

function changeGender(value: AvatarGenderStyle) { replaceProfile(setAvatarGenderStyle(activeProfile.value, value)) }
function patchProfile(patch: Partial<AvatarAppearanceProfile>) { replaceProfile({ ...activeProfile.value, ...patch }) }
function patchOutfit(patch: Partial<AvatarOutfit>) { replaceProfile(updateActiveOutfit(activeProfile.value, patch)) }
function chooseOutfit(id: string) { patchProfile({ activeOutfitId: id }) }
function newOutfit() { replaceProfile(addWardrobeOutfit(activeProfile.value, `穿搭 ${activeProfile.value.outfits.length + 1}`)) }
function removeOutfit() { replaceProfile(deleteActiveWardrobeOutfit(activeProfile.value)) }
function setCategory(value: string) { if (value in CATEGORY_LABELS) patchOutfit({ category: value as AvatarOutfitCategory }) }

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
  const self = ensureWardrobeProfile(saved, SELF_AVATAR_TARGET_ID, 'self', 'female')
  if (!saved.profiles[SELF_AVATAR_TARGET_ID]) wardrobe.value = upsertWardrobeProfile(saved, self)
  loading.value = false
  if (!saved.profiles[SELF_AVATAR_TARGET_ID]) await persist()
})
</script>

<template>
  <PhoneFrame lock-scroll>
    <main class="wardrobe-app">
      <header class="wardrobe-nav">
        <button aria-label="返回" @click="router.back()">‹</button>
        <div><small>WARDROBE · V1.1</small><b>穿搭</b></div>
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
              <div class="room-window"><i></i><i></i><b></b></div>
              <div class="room-plant"><i></i><b></b></div>
              <div class="room-rug"></div>
              <div class="preview-title"><small>{{ activeTarget?.type === 'self' ? 'MY LOOK' : 'CHARACTER LOOK' }}</small><b>{{ activeTarget?.name }}</b></div>
              <div class="avatar-pedestal">
                <CompanionPixelAvatar :profile="activeProfile" :size="154" animation="idle" active :label="activeTarget?.name" />
              </div>
              <div class="preview-meta">
                <span>{{ activeProfile.genderStyle === 'female' ? '女生版型' : '男生版型' }}</span>
                <strong>{{ activeOutfit.name }}</strong>
                <em>{{ CATEGORY_LABELS[activeOutfit.category] }}</em>
              </div>
            </div>
          </div>

          <div class="editor-pane">
            <nav class="editor-tabs" aria-label="穿搭编辑分类">
              <button v-for="tab in TAB_ITEMS" :key="tab.id" :class="{ active: activeTab === tab.id }" @click="selectTab(tab.id)">
                <span>{{ tab.icon }}</span><b>{{ tab.label }}</b>
              </button>
            </nav>

            <div ref="editorScrollEl" class="editor-scroll">
              <section v-if="activeTab === 'body'" class="editor-section">
                <header><small>BODY</small><h2>人物基础</h2><p>预览一直固定在上面，改一项就能立刻看到。</p></header>
                <div class="section-label">版型</div>
                <div class="segmented"><button :class="{ active: activeProfile.genderStyle === 'female' }" @click="changeGender('female')">女生</button><button :class="{ active: activeProfile.genderStyle === 'male' }" @click="changeGender('male')">男生</button></div>
                <div class="section-label">肤色</div>
                <div class="swatches"><button v-for="tone in SKIN_TONES" :key="tone.id" :class="{ active: activeProfile.skinTone === tone.id }" :style="{ '--swatch': tone.color }" @click="patchProfile({ skinTone: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
              </section>

              <section v-else-if="activeTab === 'hair'" class="editor-section">
                <header><small>HAIR</small><h2>发型与发色</h2><p>更像游戏里的角色创建，而不是一整页表单。</p></header>
                <div class="section-label">发型</div>
                <div class="choice-grid"><button v-for="style in hairStyles" :key="style.id" :class="{ active: activeProfile.hairStyle === style.id }" @click="patchProfile({ hairStyle: style.id })">{{ style.label }}</button></div>
                <div class="section-label">发色</div>
                <div class="swatches"><button v-for="tone in HAIR_COLORS" :key="tone.id" :class="{ active: activeProfile.hairColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchProfile({ hairColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
              </section>

              <section v-else-if="activeTab === 'top'" class="editor-section">
                <header><small>TOP</small><h2>上装</h2><p>切换款式与颜色时，人物不会离开视线。</p></header>
                <div class="section-label">款式</div>
                <div class="choice-grid"><button v-for="style in topStyles" :key="style.id" :class="{ active: activeOutfit.topStyle === style.id }" @click="patchOutfit({ topStyle: style.id })">{{ style.label }}</button></div>
                <div class="section-label">颜色</div>
                <div class="swatches"><button v-for="tone in OUTFIT_COLORS" :key="tone.id" :class="{ active: activeOutfit.topColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchOutfit({ topColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
              </section>

              <section v-else-if="activeTab === 'bottom'" class="editor-section">
                <header><small>BOTTOM</small><h2>下装</h2><p>裤装和裙装共用同一套角色预览。</p></header>
                <div class="section-label">款式</div>
                <div class="choice-grid"><button v-for="style in bottomStyles" :key="style.id" :class="{ active: activeOutfit.bottomStyle === style.id }" @click="patchOutfit({ bottomStyle: style.id })">{{ style.label }}</button></div>
                <div class="section-label">颜色</div>
                <div class="swatches"><button v-for="tone in OUTFIT_COLORS" :key="tone.id" :class="{ active: activeOutfit.bottomColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchOutfit({ bottomColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div>
              </section>

              <section v-else-if="activeTab === 'accessory'" class="editor-section">
                <header><small>ACCESSORY</small><h2>配饰</h2><p>配饰保持简洁，优先保证地图上的角色辨识度。</p></header>
                <div class="choice-grid accessory-grid"><button v-for="item in ACCESSORIES" :key="item.id" :class="{ active: activeOutfit.accessory === item.id }" @click="patchOutfit({ accessory: item.id })">{{ item.label }}</button></div>
              </section>

              <section v-else class="editor-section">
                <header><small>OUTFITS</small><h2>套装</h2><p>一个人可以保存多套衣服，飞行棋和后续小游戏共用当前套装。</p></header>
                <label class="name-field"><span>套装名字</span><input :value="activeOutfit.name" maxlength="24" @change="patchOutfit({ name: ($event.target as HTMLInputElement).value || '我的穿搭' })"></label>
                <div class="outfit-grid">
                  <button v-for="outfit in activeProfile.outfits" :key="outfit.id" :class="{ active: outfit.id === activeProfile.activeOutfitId }" @click="chooseOutfit(outfit.id)"><small>{{ CATEGORY_LABELS[outfit.category] }}</small><b>{{ outfit.name }}</b></button>
                  <button class="add-outfit" @click="newOutfit"><b>＋</b><span>新穿搭</span></button>
                </div>
                <div class="section-label">场景分类</div>
                <div class="choice-grid categories"><button v-for="(label, key) in CATEGORY_LABELS" :key="key" :class="{ active: activeOutfit.category === key }" @click="setCategory(String(key))">{{ label }}</button></div>
                <button v-if="activeProfile.outfits.length > 1" class="delete-outfit" @click="removeOutfit">删除当前套装</button>
              </section>
            </div>
          </div>
        </section>
      </template>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.wardrobe-app{height:100%;overflow:hidden;background:#f5eadf;color:#49382f;padding:7px 10px 10px}.wardrobe-nav{position:relative;z-index:30;height:46px;display:grid;grid-template-columns:34px 1fr 56px;align-items:center}.wardrobe-nav>button{width:30px;height:30px;border:1px solid #dfc8b6;border-radius:9px;background:#fff9ef;color:#6f4e40;font-size:20px;box-shadow:0 2px 0 #c7a98e}.wardrobe-nav>div{text-align:center;display:grid}.wardrobe-nav small{font-size:5px;letter-spacing:.17em;color:#a77a67}.wardrobe-nav b{font:700 11px Georgia,"Songti SC",serif}.wardrobe-nav>span{justify-self:end;font-size:5.8px;color:#a68f83}.wardrobe-nav>span.saved{color:#62815f}.wardrobe-loading{display:grid;place-items:center;height:75%;color:#90786b}.wardrobe-workbench{height:calc(100% - 46px);display:grid;grid-template-rows:minmax(264px,43%) minmax(0,57%);gap:8px;overflow:hidden}.preview-pane{min-height:0;display:grid;grid-template-rows:55px minmax(0,1fr);gap:6px}.target-strip{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:2px 1px}.target-strip::-webkit-scrollbar{display:none}.target-strip button{flex:0 0 54px;border:1px solid #dcc5b2;border-bottom-width:3px;border-radius:11px;background:#fffaf1;padding:5px 3px 4px;color:#6d5044;display:grid;justify-items:center;gap:2px}.target-strip button.active{border-color:#9a5d4f;background:#fff4de;box-shadow:0 0 0 2px rgba(154,93,79,.1)}.target-strip span{font-size:5.6px;max-width:48px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pixel-room{position:relative;overflow:hidden;border:2px solid #b89372;border-bottom-width:5px;border-radius:16px;background:linear-gradient(#d9c0a6 0 56%,#b98258 56% 100%);box-shadow:inset 0 0 0 2px #f7e8d2,0 5px 0 #9a7458}.pixel-room::before{content:'';position:absolute;inset:56% 0 0;background:repeating-linear-gradient(90deg,transparent 0 34px,rgba(90,58,40,.16) 34px 36px),repeating-linear-gradient(0deg,transparent 0 24px,rgba(90,58,40,.12) 24px 26px)}.room-window{position:absolute;left:16px;top:18px;width:70px;height:58px;border:5px solid #8c684e;background:#8fb8c8;box-shadow:inset 0 0 0 3px #d9eadf}.room-window::before,.room-window::after{content:'';position:absolute;background:#8c684e}.room-window::before{left:31px;top:0;width:4px;height:100%}.room-window::after{left:0;top:25px;width:100%;height:4px}.room-window i{position:absolute;width:12px;height:12px;border-radius:50%;background:#f4d68e;top:8px;right:9px}.room-window b{position:absolute;left:6px;right:6px;bottom:7px;height:14px;background:#66865f;clip-path:polygon(0 100%,18% 25%,31% 100%,50% 40%,66% 100%,83% 32%,100% 100%)}.room-plant{position:absolute;right:16px;bottom:24px;width:34px;height:56px}.room-plant::after{content:'';position:absolute;left:9px;bottom:0;width:20px;height:18px;background:#a45e43;border:3px solid #7a4736}.room-plant i,.room-plant b{position:absolute;background:#5f8259;width:14px;height:24px;border-radius:80% 20%}.room-plant i{left:4px;top:11px;transform:rotate(-28deg)}.room-plant b{right:1px;top:3px;transform:rotate(26deg)}.room-rug{position:absolute;left:50%;bottom:11px;width:128px;height:31px;transform:translateX(-50%);border-radius:50%;background:#c96f63;box-shadow:inset 0 0 0 5px #e6a176}.preview-title{position:absolute;left:12px;bottom:10px;z-index:4;display:grid;padding:5px 7px;border-radius:7px;background:rgba(70,49,39,.74);color:#fff8e8}.preview-title small{font-size:4.6px;letter-spacing:.13em;opacity:.72}.preview-title b{font-size:7.5px;margin-top:1px}.avatar-pedestal{position:absolute;left:50%;bottom:10px;z-index:3;transform:translateX(-50%);display:grid;place-items:end center;width:190px;height:190px}.preview-meta{position:absolute;right:9px;top:8px;z-index:4;display:grid;justify-items:end;gap:2px}.preview-meta span,.preview-meta em{font-style:normal;font-size:5px;padding:3px 5px;border-radius:999px;background:rgba(255,249,231,.82);color:#6a4a3d}.preview-meta strong{max-width:90px;font-size:6.5px;padding:4px 6px;border-radius:7px;background:#6e4b3d;color:#fff9e9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.editor-pane{min-height:0;display:grid;grid-template-rows:48px minmax(0,1fr);border:2px solid #c4a384;border-bottom-width:5px;border-radius:15px;background:#fff8ec;overflow:hidden;box-shadow:0 4px 0 #a88163}.editor-tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:2px;padding:5px;background:#e9d2b8;border-bottom:2px solid #c4a384}.editor-tabs button{min-width:0;border:0;border-radius:7px;background:transparent;color:#765949;padding:4px 1px;display:grid;justify-items:center;gap:1px}.editor-tabs button span{font-size:9px;line-height:1}.editor-tabs button b{font-size:5px}.editor-tabs button.active{background:#8d5b4e;color:#fff6e7;box-shadow:inset 0 -2px rgba(0,0,0,.16)}.editor-scroll{min-height:0;overflow:auto;padding:10px 11px 16px;scrollbar-width:thin;scrollbar-color:#b99579 transparent}.editor-section header{margin-bottom:10px}.editor-section header small{font-size:4.8px;letter-spacing:.15em;color:#aa7862}.editor-section h2{margin:2px 0 3px;font:700 14px Georgia,"Songti SC",serif}.editor-section header p{margin:0;color:#9a7b6b;font-size:5.8px;line-height:1.55}.section-label{font-size:6px;font-weight:900;margin:11px 0 6px;color:#6a4b3d}.segmented{display:grid;grid-template-columns:1fr 1fr;gap:5px}.segmented button,.choice-grid button{border:1px solid #d8bfa8;border-bottom-width:3px;border-radius:8px;background:#fffdf7;color:#6e5144;padding:8px 4px;font-size:6px}.segmented button.active,.choice-grid button.active{border-color:#97584e;background:#f0cfae;color:#5d372e;font-weight:900}.choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.accessory-grid{grid-template-columns:repeat(3,1fr)}.swatches{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.swatches button{border:1px solid #d8bfa8;border-bottom-width:3px;border-radius:9px;background:#fffdf7;padding:6px 3px;display:grid;justify-items:center;gap:3px;color:#71584c;font-size:5px}.swatches i{width:22px;height:22px;border-radius:5px;background:var(--swatch);box-shadow:inset 0 0 0 2px rgba(77,53,43,.08)}.swatches button.active{border-color:#97584e;background:#f7dfc6}.swatches button.active i{box-shadow:0 0 0 2px #fff,0 0 0 4px #97584e}.name-field{display:grid;grid-template-columns:60px 1fr;align-items:center;gap:6px;padding:8px;border:1px solid #ddc5ad;border-radius:8px;background:#fffdf7}.name-field span{font-size:5.5px;color:#876c5e}.name-field input{min-width:0;border:0;background:transparent;outline:0;font-size:7px;color:#4d382e}.outfit-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px}.outfit-grid button{min-height:48px;border:1px solid #d8bfa8;border-bottom-width:3px;border-radius:9px;background:#fffdf7;color:#6e5144;padding:7px;display:grid;text-align:left}.outfit-grid button.active{border-color:#8e544b;background:#f0cfae;color:#5e372f}.outfit-grid small{font-size:5px;opacity:.65}.outfit-grid b{font-size:6.5px;margin-top:2px}.outfit-grid .add-outfit{place-items:center;text-align:center;background:#f5e4cf}.outfit-grid .add-outfit b{font-size:16px;line-height:1}.outfit-grid .add-outfit span{font-size:5.5px}.categories{grid-template-columns:repeat(3,1fr)}.delete-outfit{width:100%;margin-top:14px;border:1px solid #d6a89c;border-bottom-width:3px;border-radius:8px;background:#fff0eb;color:#a15347;padding:8px;font-size:6px}@media(max-height:720px){.wardrobe-workbench{grid-template-rows:minmax(230px,40%) minmax(0,60%)}.avatar-pedestal{height:160px}.preview-title{display:none}}@media(prefers-reduced-motion:reduce){.wardrobe-app *{scroll-behavior:auto!important}}
</style>
