<script setup lang="ts">
import { computed } from 'vue'
import { resolveAvatarLook, type AvatarAnimation, type AvatarAppearanceProfile } from '../../services/avatarWardrobeService'

const props = withDefaults(defineProps<{
  profile?: AvatarAppearanceProfile
  size?: number
  animation?: AvatarAnimation
  active?: boolean
  label?: string
}>(), {
  size: 64,
  animation: 'idle',
  active: false,
  label: ''
})

const look = computed(() => resolveAvatarLook(props.profile))
const classes = computed(() => [
  `gender-${look.value.genderStyle}`,
  `hair-${look.value.hairStyle}`,
  `top-${look.value.topStyle}`,
  `bottom-${look.value.bottomStyle}`,
  `shoes-${look.value.shoesStyle}`,
  `headwear-${look.value.headwear}`,
  `facewear-${look.value.facewear}`,
  `neckwear-${look.value.neckwear}`,
  `carrywear-${look.value.carrywear}`,
  `legwear-${look.value.legwear}`,
  `pattern-${look.value.pattern}`,
  `anim-${props.animation}`,
  { active: props.active }
])

const shift = (hex: string, amount: number) => {
  const raw = hex.replace('#', '')
  const n = Number.parseInt(raw, 16)
  if (!Number.isFinite(n) || raw.length !== 6) return hex
  const clamp = (value: number) => Math.max(0, Math.min(255, value))
  const r = clamp((n >> 16) + amount)
  const g = clamp(((n >> 8) & 255) + amount)
  const b = clamp((n & 255) + amount)
  return `rgb(${r}, ${g}, ${b})`
}
const darker = (hex: string, amount = 22) => shift(hex, -amount)
const lighter = (hex: string, amount = 22) => shift(hex, amount)

const skinShadow = computed(() => darker(look.value.skinTone, 16))
const hairShadow = computed(() => darker(look.value.hairColor, 24))
const hairLight = computed(() => lighter(look.value.hairColor, 18))
const topShadow = computed(() => darker(look.value.topColor, 24))
const topLight = computed(() => lighter(look.value.topColor, 18))
const bottomShadow = computed(() => darker(look.value.bottomColor, 22))
const shoeShadow = computed(() => darker(look.value.shoesColor, 22))
const accentShadow = computed(() => darker(look.value.accentColor, 20))
</script>

<template>
  <span class="avatar-wrap" :class="classes" :style="{ '--avatar-size': `${props.size}px` }" :aria-label="props.label || '像素角色'">
    <svg class="pixel-avatar" viewBox="0 0 64 80" role="img" shape-rendering="crispEdges" aria-hidden="true">
      <ellipse cx="32" cy="76" rx="15" ry="2.5" fill="rgba(44,34,34,.18)" />

      <!-- back carried items -->
      <g v-if="look.carrywear === 'backpack'" :fill="accentShadow" class="carry-back">
        <rect x="43" y="39" width="10" height="18" rx="2"/><rect x="45" y="36" width="6" height="5"/><rect x="52" y="43" width="3" height="10"/>
      </g>

      <!-- back hair -->
      <g class="hair-back" :fill="look.hairColor">
        <path v-if="['long','waves','halfup'].includes(look.hairStyle)" d="M18 8h28v3h5v6h3v23h-3v12h-6V30H19v22h-6V40h-3V17h3v-6h5z" />
        <path v-else-if="look.hairStyle === 'bob'" d="M17 9h30v4h5v6h2v18h-5v7h-6V31H21v13h-6v-7h-5V19h2v-6h5z" />
        <path v-else-if="look.hairStyle === 'ponytail'" d="M17 8h30v5h5v20h-5v5h-4V29H21v9h-4v-5h-5V13h5z" />
        <path v-if="look.hairStyle === 'ponytail'" d="M47 14h8v4h3v18h-7v-5h-4z" />
        <path v-if="look.hairStyle === 'twin'" d="M13 17H8v4H5v17h9v-5h3V21zm38 0h5v4h3v17h-9v-5h-3V21z" />
        <path v-if="look.hairStyle === 'braid'" d="M46 25h6v5h3v7h-2v7h-4v7h-5v-5h2v-7h-2v-7h2z" />
        <path v-if="look.hairStyle === 'halfup'" d="M24 7h16v4h-4v3h-8v-3h-4z" :fill="hairShadow" />
        <path v-if="look.hairStyle === 'long' && look.genderStyle === 'male'" d="M17 9h30v5h5v22h-5v12h-6V30H23v18h-6V36h-5V14h5z" />
      </g>
      <path v-if="['long','waves','halfup','bob','ponytail','twin','braid'].includes(look.hairStyle)" :fill="hairShadow" d="M12 20h4v22h3v8h-5v-6h-4V22h2zm36 0h4v22h-4v8h-5v-8h3V20z" opacity=".48" />

      <!-- legs / lower garment -->
      <g class="legs">
        <template v-if="['skirt','pleated','plaid-skirt','denim-skirt','midi'].includes(look.bottomStyle) || ['dress','party'].includes(look.topStyle)">
          <path v-if="look.bottomStyle !== 'midi' && !['dress','party'].includes(look.topStyle)" :fill="look.bottomColor" d="M21 50h22l3 11H18z" />
          <path v-if="look.bottomStyle === 'midi' && !['dress','party'].includes(look.topStyle)" :fill="look.bottomColor" d="M20 49h24l3 17H17z" />
          <path v-if="look.bottomStyle === 'pleated' || look.bottomStyle === 'plaid-skirt'" :fill="bottomShadow" d="M22 51h3l-2 10h-3zm7 0h3v11h-3zm7 0h3l3 10h-3z" opacity=".55" />
          <rect v-if="look.bottomStyle === 'denim-skirt'" x="22" y="52" width="20" height="2" :fill="bottomShadow" opacity=".72" />
          <rect x="23" :y="look.bottomStyle === 'midi' ? 64 : 60" width="7" :height="look.bottomStyle === 'midi' ? 7 : 10" :fill="look.skinTone" />
          <rect x="34" :y="look.bottomStyle === 'midi' ? 64 : 60" width="7" :height="look.bottomStyle === 'midi' ? 7 : 10" :fill="look.skinTone" />
        </template>
        <template v-else>
          <path v-if="['wide','lounge','plaid-lounge'].includes(look.bottomStyle)" :fill="look.bottomColor" d="M19 50h26v21H34V58h-4v13H19z" />
          <template v-else>
            <rect x="20" y="50" width="11" height="21" :fill="look.bottomColor" />
            <rect x="33" y="50" width="11" height="21" :fill="look.bottomColor" />
            <rect x="30" y="50" width="4" height="5" :fill="bottomShadow" opacity=".48" />
          </template>
          <rect v-if="['shorts','overall-shorts'].includes(look.bottomStyle)" x="20" y="59" width="11" height="12" :fill="look.skinTone" />
          <rect v-if="['shorts','overall-shorts'].includes(look.bottomStyle)" x="33" y="59" width="11" height="12" :fill="look.skinTone" />
          <path v-if="look.bottomStyle === 'jeans'" d="M22 52h7v2h-7zm13 0h7v2h-7z" :fill="bottomShadow" opacity=".7" />
          <path v-if="look.bottomStyle === 'cargo'" d="M21 56h7v5h-7zm15 0h7v5h-7z" :fill="bottomShadow" opacity=".7" />
          <path v-if="look.bottomStyle === 'formal' || look.bottomStyle === 'chinos'" d="M31 51h2v20h-2z" :fill="bottomShadow" opacity=".65" />
        </template>

        <!-- legwear -->
        <g :fill="look.accentColor">
          <rect v-if="look.legwear === 'ankle-socks'" x="22" y="67" width="9" height="3"/><rect v-if="look.legwear === 'ankle-socks'" x="33" y="67" width="9" height="3"/>
          <rect v-if="look.legwear === 'knee-socks'" x="22" y="61" width="9" height="9"/><rect v-if="look.legwear === 'knee-socks'" x="33" y="61" width="9" height="9"/>
          <rect v-if="look.legwear === 'ruffle-socks'" x="22" y="65" width="9" height="5"/><rect v-if="look.legwear === 'ruffle-socks'" x="33" y="65" width="9" height="5"/>
          <rect v-if="look.legwear === 'tights'" x="22" y="59" width="9" height="11"/><rect v-if="look.legwear === 'tights'" x="33" y="59" width="9" height="11"/>
        </g>
        <path v-if="look.legwear === 'ruffle-socks'" d="M21 65h11v2H21zm11 0h11v2H32z" :fill="accentShadow" />

        <!-- shoes -->
        <g class="shoes" :fill="look.shoesColor">
          <path v-if="look.shoesStyle === 'boots' || look.shoesStyle === 'hiking'" d="M20 65h11v10H18v-5h2zm13 0h11v5h2v5H33z" />
          <path v-else-if="look.shoesStyle === 'platform'" d="M19 67h13v8H17v-5h2zm13 0h13v3h2v5H32z" />
          <path v-else-if="look.shoesStyle === 'maryjane'" d="M20 70h12v5H18v-4h2zm12 0h12v1h2v4H32z" />
          <path v-else-if="look.shoesStyle === 'slippers' || look.shoesStyle === 'fuzzy'" d="M18 71h14v4H17v-3h1zm14 0h14v1h1v3H32z" />
          <path v-else d="M19 70h13v5H17v-4h2zm13 0h13v1h2v4H32z" />
        </g>
        <rect x="19" y="74" width="13" height="1" :fill="shoeShadow" opacity=".7"/><rect x="33" y="74" width="13" height="1" :fill="shoeShadow" opacity=".7"/>
        <path v-if="look.shoesStyle === 'hiking'" d="M21 67h8v1h-8zm14 0h8v1h-8z" :fill="topLight" opacity=".8"/>
        <path v-if="look.shoesStyle === 'fuzzy'" d="M20 70h4v2h-4zm17 0h4v2h-4z" :fill="look.accentColor" opacity=".8"/>
      </g>

      <!-- torso and arms -->
      <g class="torso">
        <path v-if="look.genderStyle === 'female'" :fill="look.topColor" d="M21 39h22l2 14H19z" />
        <path v-else :fill="look.topColor" d="M19 39h26v15H19z" />
        <path v-if="look.topStyle === 'dress'" :fill="look.topColor" d="M20 39h24l4 26H16z" />
        <path v-if="look.topStyle === 'party'" :fill="look.topColor" d="M20 38h24l5 27H15z" />
        <path v-if="look.topStyle === 'cropped-jacket'" :fill="look.topColor" d="M18 39h28v11H18z" />
        <path v-if="look.topStyle === 'puff-blouse'" :fill="look.topColor" d="M20 39h24v15H20z" />
        <path v-if="look.topStyle === 'academy-blouse'" :fill="look.topColor" d="M20 39h24v15H20z" />
        <path v-if="['overshirt','field-jacket'].includes(look.topStyle)" :fill="look.topColor" d="M18 39h28v16H18z" />
        <path v-if="look.topStyle === 'soft-cardigan' || look.topStyle === 'lace-cardigan'" :fill="look.topColor" d="M19 39h26v15H19z" />
        <path v-if="look.topStyle === 'hoodie'" :fill="topShadow" d="M24 38h16l-3-5H27z" />
        <path v-if="look.topStyle === 'sailor'" d="M22 39l10 9 10-9h-5l-5 5-5-5z" :fill="look.accentColor" />
        <path v-if="look.topStyle === 'academy-vest' || look.topStyle === 'vest'" :fill="topShadow" d="M22 39h20v15H22z" />
        <path v-if="look.topStyle === 'formal'" :fill="look.topColor" d="M20 39h24v15H20z" />
        <path v-if="look.topStyle === 'formal'" d="M32 41l-4-4h8z" :fill="look.accentColor" />
        <path v-if="look.topStyle === 'cardigan' || look.topStyle === 'soft-cardigan' || look.topStyle === 'lace-cardigan'" d="M31 39h2v15h-2z" :fill="look.accentColor" opacity=".85" />
        <path v-if="look.topStyle === 'jacket' || look.topStyle === 'overshirt' || look.topStyle === 'field-jacket' || look.topStyle === 'cropped-jacket'" d="M31 39h2v15h-2z" :fill="topLight" opacity=".6" />
        <path v-if="look.topStyle === 'polo'" d="M27 39h10v5H27z" :fill="topLight" opacity=".65" />
        <path v-if="['cami','tank'].includes(look.topStyle)" d="M20 39h5v7h-5zm19 0h5v7h-5z" :fill="look.skinTone" />

        <!-- sleeves / hands -->
        <rect class="arm arm-left" x="13" y="41" width="6" height="14" rx="1" :fill="look.skinTone" />
        <rect class="arm arm-right" x="45" y="41" width="6" height="14" rx="1" :fill="look.skinTone" />
        <path v-if="['tee','sweater','hoodie','cardigan','soft-cardigan','lace-cardigan','varsity','jacket','field-jacket','overshirt','formal','puff-blouse','academy-blouse','shirt','blouse'].includes(look.topStyle)" :fill="look.topColor" d="M13 39h8v10h-8zm30 0h8v10h-8z" />
        <path v-if="look.topStyle === 'puff-blouse'" :fill="topLight" d="M12 40h9v6h-9zm31 0h9v6h-9z" opacity=".85" />
        <rect x="13" y="52" width="6" height="3" :fill="skinShadow" opacity=".18"/><rect x="45" y="52" width="6" height="3" :fill="skinShadow" opacity=".18"/>
      </g>

      <!-- garment details and patterns -->
      <g class="garment-details">
        <path v-if="look.topStyle === 'blouse' || look.topStyle === 'shirt' || look.topStyle === 'academy-blouse'" d="M25 39h14v3H25z" :fill="topLight" opacity=".7" />
        <path v-if="look.topStyle === 'academy-blouse'" d="M25 40l7 6 7-6h-4l-3 3-3-3z" :fill="look.accentColor" />
        <path v-if="look.topStyle === 'varsity'" d="M19 40h6v13h-6zm20 0h6v13h-6z" :fill="look.accentColor" opacity=".8" />
        <path v-if="look.topStyle === 'field-jacket'" d="M21 43h7v5h-7zm15 0h7v5h-7z" :fill="topShadow" opacity=".7" />
        <path v-if="look.topStyle === 'party'" d="M24 40h16v4H24z" :fill="look.accentColor" opacity=".85" />
        <path v-if="look.topStyle === 'dress'" d="M22 39h20v3H22z" :fill="look.accentColor" opacity=".75" />
        <path v-if="look.bottomStyle === 'overall-shorts'" d="M24 42h4v10h8V42h4v14H24z" :fill="look.bottomColor" />
        <template v-if="look.pattern === 'stripe'">
          <rect x="22" y="44" width="20" height="2" :fill="look.accentColor" opacity=".7"/><rect x="21" y="50" width="22" height="2" :fill="look.accentColor" opacity=".55"/>
        </template>
        <template v-if="look.pattern === 'plaid'">
          <path d="M20 52h25v2H20zm0 6h25v2H20z" :fill="look.accentColor" opacity=".55"/><path d="M25 50h2v13h-2zm8 0h2v13h-2zm8 0h2v13h-2z" :fill="look.accentColor" opacity=".4"/>
        </template>
        <template v-if="look.pattern === 'floral'">
          <g :fill="look.accentColor" opacity=".88"><rect x="24" y="45" width="2" height="2"/><rect x="37" y="48" width="2" height="2"/><rect x="29" y="54" width="2" height="2"/></g>
        </template>
        <template v-if="look.pattern === 'dots'">
          <g :fill="look.accentColor" opacity=".7"><rect x="25" y="44" width="2" height="2"/><rect x="34" y="46" width="2" height="2"/><rect x="40" y="51" width="2" height="2"/></g>
        </template>
      </g>

      <!-- neck and face base -->
      <rect x="28" y="34" width="8" height="7" :fill="look.skinTone" />
      <path :fill="look.skinTone" d="M20 14h24v2h5v5h3v13h-3v5h-5v3H20v-3h-5v-5h-3V21h3v-5h5z" />
      <rect x="13" y="24" width="3" height="7" :fill="look.skinTone"/><rect x="48" y="24" width="3" height="7" :fill="look.skinTone"/>
      <path d="M20 39h24v3H20z" :fill="skinShadow" opacity=".12" />

      <!-- front hair -->
      <g class="hair-front" :fill="look.hairColor">
        <path v-if="look.hairStyle === 'long'" d="M16 10h32v4h4v7h-5v4h-5v-6h-6v5h-5v-5h-7v7h-5v-5h-5v-7h2z" />
        <path v-else-if="look.hairStyle === 'waves' || look.hairStyle === 'halfup'" d="M16 10h32v4h4v6h-5v5h-5v-4h-5v6h-5v-5h-5v4h-5v-5h-6v-7h2z" />
        <path v-else-if="look.hairStyle === 'bob'" d="M16 11h32v4h4v6h-5v5h-5v-4h-6v5h-5v-4h-7v5h-5v-7h-5v-6h2z" />
        <path v-else-if="look.hairStyle === 'ponytail'" d="M16 10h32v4h4v7h-6v5h-5v-5h-6v5h-5v-5h-6v6h-5v-6h-5v-7h2z" />
        <path v-else-if="look.hairStyle === 'twin'" d="M16 10h32v4h4v6h-5v5h-5v-4h-6v5h-5v-5h-6v5h-5v-6h-6v-6h2z" />
        <path v-else-if="look.hairStyle === 'braid'" d="M16 10h32v4h4v7h-5v5h-6v-5h-5v5h-5v-5h-6v6h-5v-6h-6v-7h2z" />
        <path v-else-if="['short','crop'].includes(look.hairStyle)" d="M16 10h32v4h4v7h-6v4h-5v-4h-6v5h-5v-5h-6v4h-5v-5h-5v-6h2z" />
        <path v-else-if="look.hairStyle === 'side'" d="M16 10h32v4h4v7h-5v3H34v6h-5v-8h-6v5h-5v-7h-4v-6h2z" />
        <path v-else-if="look.hairStyle === 'soft'" d="M16 10h32v4h4v7h-6v4h-5v-3h-5v5h-5v-4h-5v3h-5v-5h-7v-7h2z" />
        <path v-else-if="look.hairStyle === 'messy' || look.hairStyle === 'layered'" d="M15 13h4V8h5v4h4V7h5v4h6V8h5v4h5v-3h4v7h3v6h-5v4h-5v-4h-5v5h-5v-5h-6v5h-5v-5h-5v4h-5z" />
        <path v-else-if="look.hairStyle === 'buzz'" d="M19 11h26v4h4v8H15v-8h4z" />
      </g>
      <path v-if="look.hairStyle !== 'buzz'" :fill="hairLight" d="M21 11h15v2H21z" opacity=".34" />
      <path v-if="look.hairStyle !== 'buzz'" :fill="hairShadow" d="M15 16h3v10h-3zm31 0h3v10h-3z" opacity=".5" />

      <!-- face -->
      <template v-if="look.eyeStyle === 'soft'">
        <rect x="23" y="27" width="4" height="4" fill="#342a31"/><rect x="37" y="27" width="4" height="4" fill="#342a31"/>
        <rect x="24" y="27" width="1" height="1" fill="#fff7ef"/><rect x="38" y="27" width="1" height="1" fill="#fff7ef"/>
      </template>
      <template v-else-if="look.eyeStyle === 'bright'">
        <rect x="22" y="26" width="5" height="5" fill="#342a31"/><rect x="37" y="26" width="5" height="5" fill="#342a31"/>
        <rect x="23" y="26" width="2" height="2" fill="#fff7ef"/><rect x="38" y="26" width="2" height="2" fill="#fff7ef"/>
      </template>
      <template v-else>
        <path d="M22 29h5v2h-5zm15 0h5v2h-5z" fill="#342a31"/><rect x="23" y="28" width="4" height="1" fill="#342a31"/><rect x="37" y="28" width="4" height="1" fill="#342a31"/>
      </template>
      <rect x="18" y="32" width="5" height="2" fill="#df9092" opacity=".5"/><rect x="41" y="32" width="5" height="2" fill="#df9092" opacity=".5"/>
      <path d="M29 33h6v1h-1v2h-4v-2h-1z" fill="#9b5b63" />

      <!-- neckwear -->
      <g v-if="look.neckwear === 'necklace'" fill="#d7b15c"><rect x="31" y="41" width="2" height="4"/><rect x="30" y="44" width="4" height="2"/></g>
      <g v-if="look.neckwear === 'choker'" :fill="accentShadow"><rect x="27" y="38" width="10" height="2"/></g>
      <g v-if="look.neckwear === 'scarf'" :fill="look.accentColor"><rect x="24" y="37" width="16" height="5"/><rect x="37" y="40" width="4" height="10"/></g>
      <g v-if="look.neckwear === 'bandana'" :fill="look.accentColor"><path d="M24 38h16l-8 8z"/><rect x="29" y="37" width="6" height="2"/></g>
      <g v-if="look.neckwear === 'bowtie' || look.neckwear === 'ribbon-tie'" :fill="look.accentColor"><path d="M32 42l-7-4v8zm0 0l7-4v8z"/><rect x="30" y="40" width="4" height="4"/><path v-if="look.neckwear === 'ribbon-tie'" d="M30 44h4v8h-2z"/></g>

      <!-- facewear -->
      <g v-if="look.facewear === 'glasses' || look.facewear === 'square-glasses'" fill="none" stroke="#55464c" stroke-width="1">
        <rect x="19" y="24" width="12" height="9" :rx="look.facewear === 'glasses' ? 4 : 0"/><rect x="33" y="24" width="12" height="9" :rx="look.facewear === 'glasses' ? 4 : 0"/><path d="M31 28h2"/>
      </g>
      <g v-if="look.facewear === 'hairpin'" fill="#f1c25f"><rect x="44" y="17" width="7" height="2"/><rect x="47" y="15" width="1" height="6"/></g>
      <g v-if="look.facewear === 'earrings'" fill="#e5c36d"><rect x="14" y="30" width="2" height="4"/><rect x="48" y="30" width="2" height="4"/></g>
      <g v-if="look.facewear === 'headphones'" fill="#d7d2cc"><rect x="12" y="21" width="4" height="12"/><rect x="48" y="21" width="4" height="12"/><path d="M16 18h32v3H16z" :fill="accentShadow"/></g>

      <!-- headwear -->
      <g v-if="look.headwear === 'ribbon'" :fill="look.accentColor"><path d="M46 13l7-5v6l-6 3zm0 0l7 5v-6l-6-2z"/><rect x="43" y="12" width="4" height="4"/></g>
      <g v-if="look.headwear === 'wide-ribbon'" :fill="look.accentColor"><path d="M43 11l9-7v8l-7 4zm0 0l9 7V9l-7-3z"/><rect x="40" y="10" width="5" height="5"/></g>
      <g v-if="look.headwear === 'headband'" :fill="look.accentColor"><path d="M17 14h30v3H17z"/></g>
      <g v-if="look.headwear === 'flower' || look.headwear === 'flower-crown'" fill="#f2d264"><rect x="45" y="11" width="4" height="4"/><rect x="44" y="12" width="6" height="2"/><rect x="46" y="10" width="2" height="6"/></g>
      <g v-if="look.headwear === 'flower-crown'" fill="#f0e8c8"><rect x="22" y="10" width="4" height="3"/><rect x="31" y="8" width="4" height="3"/><rect x="39" y="10" width="4" height="3"/></g>
      <g v-if="look.headwear === 'beret' || look.headwear === 'newsboy'" :fill="look.accentColor"><path d="M19 7h27v3h5v8H14v-6h5z"/><rect x="34" y="5" width="5" height="2" :fill="accentShadow"/></g>
      <g v-if="look.headwear === 'newsboy'" :fill="accentShadow"><path d="M40 16h14v3H40z"/></g>
      <g v-if="look.headwear === 'cap'" :fill="look.accentColor"><path d="M17 7h30v9H17z"/><path d="M36 15h17v3H36z" :fill="accentShadow"/></g>
      <g v-if="look.headwear === 'beanie'" :fill="look.accentColor"><path d="M19 6h26v4h4v8H15v-8h4z"/><rect x="16" y="15" width="32" height="4" :fill="accentShadow"/></g>
      <g v-if="look.headwear === 'strawhat'" fill="#caa052"><path d="M13 7h38v4h7v5H6v-5h7z"/><rect x="20" y="3" width="24" height="6"/><rect x="20" y="11" width="24" height="2" :fill="look.accentColor"/></g>
      <g v-if="look.headwear === 'witch'" fill="#3a3445"><path d="M27 1h12l7 14H17z"/><path d="M9 14h46v5H9z"/><rect x="23" y="13" width="20" height="2" :fill="look.accentColor"/></g>

      <!-- carried front items -->
      <g class="carry-front">
        <g v-if="look.carrywear === 'satchel'" :fill="accentShadow"><path d="M22 39h3l18 25h-3z"/><rect x="40" y="54" width="12" height="12" rx="1"/><rect x="42" y="56" width="8" height="2" :fill="look.accentColor"/></g>
        <g v-if="look.carrywear === 'mini-bag'" :fill="accentShadow"><rect x="43" y="58" width="10" height="9" rx="1"/><path d="M45 58v-4h6v4" fill="none" :stroke="accentShadow" stroke-width="2"/></g>
        <g v-if="look.carrywear === 'camera'" :fill="accentShadow"><rect x="25" y="48" width="14" height="9"/><rect x="30" y="50" width="5" height="5" :fill="look.accentColor"/><path d="M27 48l3-4h4l3 4" fill="none" :stroke="accentShadow" stroke-width="2"/></g>
        <g v-if="look.carrywear === 'book'" :fill="look.accentColor"><rect x="13" y="48" width="9" height="13"/><rect x="15" y="50" width="5" height="1" :fill="accentShadow"/></g>
        <g v-if="look.carrywear === 'bouquet'"><path d="M14 51l8 15" stroke="#5f7f54" stroke-width="2"/><g fill="#f2df7b"><rect x="10" y="47" width="4" height="4"/><rect x="15" y="45" width="4" height="4"/><rect x="18" y="49" width="4" height="4"/></g></g>
        <g v-if="look.carrywear === 'mug'" :fill="look.accentColor"><rect x="45" y="49" width="8" height="8"/><path d="M53 51h3v4h-3" fill="none" :stroke="accentShadow" stroke-width="2"/></g>
      </g>
    </svg>
  </span>
</template>

<style scoped>
.avatar-wrap{--avatar-size:64px;display:inline-grid;place-items:center;width:var(--avatar-size);height:calc(var(--avatar-size)*1.25);transform-origin:center bottom;filter:drop-shadow(0 calc(var(--avatar-size)*.05) calc(var(--avatar-size)*.035) rgba(42,31,35,.17))}.pixel-avatar{width:100%;height:100%;overflow:visible;image-rendering:pixelated}.active{filter:drop-shadow(0 0 calc(var(--avatar-size)*.08) rgba(255,234,160,.88)) drop-shadow(0 calc(var(--avatar-size)*.05) calc(var(--avatar-size)*.035) rgba(42,31,35,.17))}.anim-idle{animation:avatarBreath 2.1s steps(2,end) infinite}.anim-walk{animation:avatarWalk .34s steps(2,end) infinite}.anim-walk .legs{animation:legBob .34s steps(2,end) infinite}.anim-rollDice .arm-right{transform-origin:48px 43px;animation:avatarThrow .55s steps(3,end) infinite}.anim-closeDistance{animation:avatarLean 1s ease-in-out infinite}.anim-hug .arm-left{transform-origin:16px 43px;transform:rotate(-34deg) translate(-1px,1px)}.anim-hug .arm-right{transform-origin:48px 43px;transform:rotate(34deg) translate(1px,1px)}.anim-kiss{animation:avatarLean .78s ease-in-out infinite}@keyframes avatarBreath{50%{transform:translateY(-1px)}}@keyframes avatarWalk{25%{transform:translateY(-2px) rotate(-1deg)}75%{transform:translateY(-1px) rotate(1deg)}}@keyframes legBob{50%{transform:translateY(1px)}}@keyframes avatarThrow{0%,100%{transform:none}50%{transform:rotate(-45deg) translate(-2px,-2px)}}@keyframes avatarLean{50%{transform:translateX(2px) rotate(1deg)}}@media(prefers-reduced-motion:reduce){.avatar-wrap,.avatar-wrap *{animation:none!important}}
</style>
