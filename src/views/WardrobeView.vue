<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

const router = useRouter()
const worldId = ref('world-default')
const characters = ref<Character[]>([])
const selfProfile = ref<UserProfile>()
const wardrobe = ref<WardrobeState>({ version: 1, profiles: {} })
const activeTargetId = ref(SELF_AVATAR_TARGET_ID)
const loading = ref(true)
const saving = ref(false)
const savedPulse = ref(false)

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

function replaceProfile(profile: AvatarAppearanceProfile) {
  wardrobe.value = upsertWardrobeProfile(wardrobe.value, profile)
  void persist()
}

async function persist() {
  if (saving.value) return
  saving.value = true
  try {
    wardrobe.value = await saveWardrobeState(worldId.value, wardrobe.value)
    savedPulse.value = true
    window.setTimeout(() => { savedPulse.value = false }, 900)
  } finally {
    saving.value = false
  }
}

function chooseTarget(id: string) {
  activeTargetId.value = id
  const target = targets.value.find(row => row.id === id)
  if (!target || wardrobe.value.profiles[id]) return
  wardrobe.value = upsertWardrobeProfile(
    wardrobe.value,
    createAvatarAppearanceProfile(target.id, target.type, defaultGenderStyle(target.gender))
  )
  void persist()
}

function changeGender(value: AvatarGenderStyle) {
  replaceProfile(setAvatarGenderStyle(activeProfile.value, value))
}

function patchProfile(patch: Partial<AvatarAppearanceProfile>) {
  replaceProfile({ ...activeProfile.value, ...patch })
}

function patchOutfit(patch: Partial<AvatarOutfit>) {
  replaceProfile(updateActiveOutfit(activeProfile.value, patch))
}

function chooseOutfit(id: string) {
  patchProfile({ activeOutfitId: id })
}

function newOutfit() {
  replaceProfile(addWardrobeOutfit(activeProfile.value, `穿搭 ${activeProfile.value.outfits.length + 1}`))
}

function removeOutfit() {
  replaceProfile(deleteActiveWardrobeOutfit(activeProfile.value))
}

function setCategory(value: string) {
  if (!(value in CATEGORY_LABELS)) return
  patchOutfit({ category: value as AvatarOutfitCategory })
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
  const self = ensureWardrobeProfile(saved, SELF_AVATAR_TARGET_ID, 'self', 'female')
  if (!saved.profiles[SELF_AVATAR_TARGET_ID]) wardrobe.value = upsertWardrobeProfile(saved, self)
  loading.value = false
  if (!saved.profiles[SELF_AVATAR_TARGET_ID]) await persist()
})
</script>

<template>
  <PhoneFrame>
    <main class="wardrobe-app">
      <header class="wardrobe-nav">
        <button aria-label="返回" @click="router.back()">‹</button>
        <div><small>COMPANION WARDROBE · V1</small><b>穿搭</b></div>
        <span :class="{ saved: savedPulse }">{{ saving ? '保存中' : savedPulse ? '已保存' : '自动保存' }}</span>
      </header>

      <section v-if="loading" class="wardrobe-loading">正在打开衣橱…</section>
      <template v-else>
        <section class="target-strip">
          <button v-for="target in targets" :key="target.id" :class="{ active: target.id === activeTargetId }" @click="chooseTarget(target.id)">
            <CharacterAvatar :avatar="target.avatar" :name="target.name" :size="38" />
            <span>{{ target.id === 'self' ? '我' : target.name }}</span>
          </button>
        </section>

        <section class="studio-card">
          <div class="studio-copy">
            <span>{{ activeTarget?.type === 'self' ? 'MY LOOK' : 'CHARACTER LOOK' }}</span>
            <h1>{{ activeTarget?.name }}</h1>
            <p>这一套形象会给心跳飞行棋和后续支持小人的小游戏共用。角色人设和 Memory 不会因为换衣服改变。</p>
          </div>
          <div class="avatar-stage">
            <div class="stage-glow"></div>
            <CompanionPixelAvatar :profile="activeProfile" :size="112" animation="idle" active :label="activeTarget?.name" />
            <div class="stage-floor"></div>
          </div>
        </section>

        <section class="gender-card">
          <div><b>版型</b><small>男女两套 Q 版骨架，穿搭选项会跟着切换</small></div>
          <nav><button :class="{ active: activeProfile.genderStyle === 'female' }" @click="changeGender('female')">女生</button><button :class="{ active: activeProfile.genderStyle === 'male' }" @click="changeGender('male')">男生</button></nav>
        </section>

        <section class="outfit-row">
          <button v-for="outfit in activeProfile.outfits" :key="outfit.id" :class="{ active: outfit.id === activeProfile.activeOutfitId }" @click="chooseOutfit(outfit.id)">
            <span>{{ CATEGORY_LABELS[outfit.category] }}</span><b>{{ outfit.name }}</b>
          </button>
          <button class="add-outfit" @click="newOutfit">＋<b>新穿搭</b></button>
        </section>

        <section class="editor-card">
          <header><div><small>LOOK EDITOR</small><b>设计这一套</b></div><button v-if="activeProfile.outfits.length > 1" @click="removeOutfit">删除套装</button></header>

          <label class="name-field"><span>套装名字</span><input :value="activeOutfit.name" maxlength="24" @change="patchOutfit({ name: ($event.target as HTMLInputElement).value || '我的穿搭' })"></label>

          <div class="option-block"><b>肤色</b><div class="swatches"><button v-for="tone in SKIN_TONES" :key="tone.id" :title="tone.label" :class="{ active: activeProfile.skinTone === tone.id }" :style="{ '--swatch': tone.color }" @click="patchProfile({ skinTone: tone.id })"><i></i><span>{{ tone.label }}</span></button></div></div>
          <div class="option-block"><b>发型</b><div class="choice-grid"><button v-for="style in hairStyles" :key="style.id" :class="{ active: activeProfile.hairStyle === style.id }" @click="patchProfile({ hairStyle: style.id })">{{ style.label }}</button></div></div>
          <div class="option-block"><b>发色</b><div class="swatches"><button v-for="tone in HAIR_COLORS" :key="tone.id" :title="tone.label" :class="{ active: activeProfile.hairColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchProfile({ hairColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div></div>
          <div class="option-block"><b>上装</b><div class="choice-grid"><button v-for="style in topStyles" :key="style.id" :class="{ active: activeOutfit.topStyle === style.id }" @click="patchOutfit({ topStyle: style.id })">{{ style.label }}</button></div></div>
          <div class="option-block"><b>上装颜色</b><div class="swatches compact"><button v-for="tone in OUTFIT_COLORS" :key="tone.id" :title="tone.label" :class="{ active: activeOutfit.topColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchOutfit({ topColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div></div>
          <div class="option-block"><b>下装</b><div class="choice-grid"><button v-for="style in bottomStyles" :key="style.id" :class="{ active: activeOutfit.bottomStyle === style.id }" @click="patchOutfit({ bottomStyle: style.id })">{{ style.label }}</button></div></div>
          <div class="option-block"><b>下装颜色</b><div class="swatches compact"><button v-for="tone in OUTFIT_COLORS" :key="tone.id" :title="tone.label" :class="{ active: activeOutfit.bottomColor === tone.id }" :style="{ '--swatch': tone.color }" @click="patchOutfit({ bottomColor: tone.id })"><i></i><span>{{ tone.label }}</span></button></div></div>
          <div class="option-block"><b>配饰</b><div class="choice-grid"><button v-for="item in ACCESSORIES" :key="item.id" :class="{ active: activeOutfit.accessory === item.id }" @click="patchOutfit({ accessory: item.id })">{{ item.label }}</button></div></div>
          <div class="option-block"><b>场景分类</b><div class="choice-grid categories"><button v-for="(label, key) in CATEGORY_LABELS" :key="key" :class="{ active: activeOutfit.category === key }" @click="setCategory(String(key))">{{ label }}</button></div></div>
        </section>

        <section class="reuse-note"><span>✦</span><div><b>一套形象，多处复用</b><small>心跳飞行棋先接入这套 Avatar Runtime；以后房间、散步、约会和其他小游戏都可以直接读取同一角色的当前穿搭。</small></div></section>
      </template>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.wardrobe-app{min-height:100%;height:100%;overflow:auto;background:radial-gradient(90% 42% at 50% -5%,#f9e3ee,transparent 70%),linear-gradient(180deg,#fffaf8,#f8f0f4);color:#4b2d39;padding:8px 14px 26px;scrollbar-width:none}.wardrobe-app::-webkit-scrollbar{display:none}.wardrobe-nav{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:36px 1fr 54px;align-items:center;min-height:52px;background:linear-gradient(180deg,rgba(255,250,248,.96) 65%,transparent)}.wardrobe-nav>button{width:31px;height:31px;border:1px solid rgba(96,51,68,.08);border-radius:50%;background:#fff;color:#704255;font-size:20px}.wardrobe-nav>div{text-align:center;display:grid}.wardrobe-nav small{font-size:5px;letter-spacing:.18em;color:#bc8299}.wardrobe-nav b{font:600 11px Georgia,"Songti SC",serif}.wardrobe-nav>span{justify-self:end;font-size:5.8px;color:#aa8b97}.wardrobe-nav>span.saved{color:#7e9d76}.wardrobe-loading{display:grid;place-items:center;height:70%;color:#9a7885}.target-strip{display:flex;gap:9px;overflow:auto;padding:5px 1px 10px;scrollbar-width:none}.target-strip::-webkit-scrollbar{display:none}.target-strip button{flex:0 0 64px;border:1px solid transparent;border-radius:16px;background:rgba(255,255,255,.65);padding:7px 4px 6px;color:#765061;display:grid;justify-items:center;gap:3px}.target-strip button.active{border-color:#c989a1;background:#fff;box-shadow:0 9px 20px rgba(115,52,77,.1)}.target-strip span{font-size:6.4px;max-width:56px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.studio-card{position:relative;display:grid;grid-template-columns:1.05fr .95fr;min-height:225px;border:1px solid rgba(113,56,77,.08);border-radius:28px;background:linear-gradient(145deg,#fff,#f6e8ef);overflow:hidden;box-shadow:0 18px 50px rgba(92,49,66,.11)}.studio-copy{padding:22px 0 20px 20px;align-self:center}.studio-copy>span{font-size:5.5px;letter-spacing:.18em;color:#b87590}.studio-copy h1{margin:7px 0 9px;font:500 27px Georgia,"Songti SC",serif}.studio-copy p{margin:0;color:#90727e;font-size:7px;line-height:1.75}.avatar-stage{position:relative;display:grid;place-items:center;min-width:0}.stage-glow{position:absolute;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,#fff8d8 0,rgba(248,210,224,.5) 42%,transparent 70%)}.stage-floor{position:absolute;left:16%;right:16%;bottom:22px;height:17px;border-radius:50%;background:rgba(104,57,74,.11);filter:blur(5px)}.gender-card{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:11px 12px;border-radius:18px;background:#fff;border:1px solid rgba(113,56,77,.08)}.gender-card>div{display:grid}.gender-card b{font-size:8px}.gender-card small{font-size:5.8px;color:#a0808d;margin-top:2px}.gender-card nav{display:flex;padding:3px;border-radius:12px;background:#f4e8ed}.gender-card button{border:0;border-radius:9px;background:transparent;color:#8b6473;padding:7px 10px;font-size:6.5px;font-weight:800}.gender-card button.active{background:#7e3654;color:#fff}.outfit-row{display:flex;gap:7px;overflow:auto;padding:10px 0 3px;scrollbar-width:none}.outfit-row::-webkit-scrollbar{display:none}.outfit-row button{flex:0 0 92px;display:grid;text-align:left;border:1px solid rgba(113,56,77,.08);border-radius:15px;background:#fff;padding:9px;color:#755061}.outfit-row button.active{background:#7e3654;color:#fff;border-color:#7e3654}.outfit-row span{font-size:5.3px;opacity:.65}.outfit-row b{font-size:7px;margin-top:2px}.outfit-row .add-outfit{place-items:center;text-align:center;background:#f5e9ee;color:#8e5d70}.outfit-row .add-outfit:first-letter{font-size:16px}.editor-card{margin-top:10px;padding:13px;border:1px solid rgba(113,56,77,.08);border-radius:22px;background:rgba(255,255,255,.84)}.editor-card>header{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.editor-card>header>div{display:grid}.editor-card>header small{font-size:5px;letter-spacing:.16em;color:#b2768e}.editor-card>header b{font-size:10px;margin-top:2px}.editor-card>header button{border:0;border-radius:10px;background:#f7e8ec;color:#a2506b;padding:6px 8px;font-size:5.8px}.name-field{display:grid;grid-template-columns:62px 1fr;align-items:center;gap:7px;margin-bottom:10px;padding:7px 8px;border-radius:12px;background:#faf3f6}.name-field span{font-size:6px;color:#8b6c78}.name-field input{min-width:0;border:0;background:transparent;outline:none;color:#583945;font:7px inherit}.option-block{margin-top:12px}.option-block>b{display:block;margin-bottom:6px;font-size:7px}.choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.choice-grid button{border:1px solid rgba(105,58,75,.09);border-radius:10px;background:#f8f1f4;color:#7f5b69;padding:8px 4px;font-size:6px}.choice-grid button.active{border-color:#b96a89;background:#f3dce5;color:#7d3152;font-weight:900}.choice-grid.categories{grid-template-columns:repeat(3,1fr)}.swatches{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.swatches button{border:1px solid rgba(105,58,75,.08);border-radius:11px;background:#fff;padding:6px 3px;display:grid;justify-items:center;gap:3px;color:#80616d;font-size:5px}.swatches i{width:22px;height:22px;border-radius:50%;background:var(--swatch);box-shadow:inset 0 0 0 1px rgba(65,40,48,.08)}.swatches button.active{border-color:#b86685;background:#fdf3f7}.swatches button.active i{box-shadow:0 0 0 3px rgba(185,102,133,.18),inset 0 0 0 1px rgba(65,40,48,.08)}.swatches.compact{grid-template-columns:repeat(4,1fr)}.reuse-note{display:grid;grid-template-columns:32px 1fr;gap:9px;align-items:center;margin:12px 0 0;padding:11px;border-radius:18px;background:linear-gradient(135deg,#4c3b57,#755269);color:#fff}.reuse-note>span{width:32px;height:32px;border-radius:12px;background:rgba(255,255,255,.12);display:grid;place-items:center}.reuse-note>div{display:grid}.reuse-note b{font-size:7px}.reuse-note small{font-size:5.5px;line-height:1.55;color:#e4d6df;margin-top:2px}
</style>
