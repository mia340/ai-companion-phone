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
</script>

<template>
  <span class="avatar-wrap" :class="classes" :style="{ '--avatar-size': `${props.size}px` }" :aria-label="props.label || '像素角色'">
    <svg class="pixel-avatar" viewBox="0 0 48 64" role="img" shape-rendering="crispEdges" aria-hidden="true">
      <ellipse cx="24" cy="60" rx="12" ry="2" fill="rgba(44,34,34,.18)" />

      <!-- back hair: narrow silhouette, always behind face/body -->
      <g class="hair-back" :fill="look.hairColor">
        <path v-if="['long','waves'].includes(look.hairStyle)" d="M12 10h24v6h3v23h-4v8h-5V28H18v19h-5v-8H9V16h3z" />
        <path v-else-if="look.hairStyle === 'bob'" d="M11 11h26v7h2v16h-4v6h-5V27H18v13h-5v-6H9V18h2z" />
        <path v-else-if="look.hairStyle === 'ponytail'" d="M11 10h26v8h2v14h-5V26H14v7H9V18h2z" />
        <path v-if="look.hairStyle === 'ponytail'" d="M36 16h6v5h2v13h-6v-4h-3z" />
        <path v-if="look.hairStyle === 'twin'" d="M9 15H5v5H3v13h7v-4h3V18zm30 0h4v5h2v13h-7v-4h-3V18z" />
        <path v-if="look.hairStyle === 'braid'" d="M34 22h5v6h2v6h-2v6h-4v6h-4v-5h2v-6h-2v-6h3z" />
        <path v-if="look.hairStyle === 'long' && look.genderStyle === 'male'" d="M12 10h24v7h3v19h-5v10h-5V27H19v19h-5V36H9V17h3z" />
      </g>
      <path v-if="['long','waves','bob','ponytail','twin','braid'].includes(look.hairStyle)" :fill="hairShadow" d="M10 18h3v20h3v8h-3v-6H9V20h1zm25 0h3v20h-3v8h-3v-8h3z" opacity=".55" />

      <!-- legs first, torso overlaps naturally -->
      <g class="legs">
        <template v-if="['skirt','pleated','midi'].includes(look.bottomStyle) || ['dress','party'].includes(look.topStyle)">
          <path v-if="look.bottomStyle !== 'midi' && !['dress','party'].includes(look.topStyle)" :fill="look.bottomColor" d="M15 39h18l3 9H12z" />
          <path v-if="look.bottomStyle === 'midi'" :fill="look.bottomColor" d="M14 39h20l2 13H12z" />
          <path v-if="look.bottomStyle === 'pleated'" :fill="bottomShadow" d="M16 40h2l-2 8h-2zm6 0h2v9h-2zm6 0h2l2 8h-2z" opacity=".62" />
          <rect x="16" :y="look.bottomStyle === 'midi' ? 50 : 47" width="6" :height="look.bottomStyle === 'midi' ? 7 : 10" :fill="look.skinTone" />
          <rect x="26" :y="look.bottomStyle === 'midi' ? 50 : 47" width="6" :height="look.bottomStyle === 'midi' ? 7 : 10" :fill="look.skinTone" />
        </template>
        <template v-else>
          <path v-if="look.bottomStyle === 'wide'" :fill="look.bottomColor" d="M13 39h22v18h-9V45h-4v12h-9z" />
          <template v-else>
            <rect x="14" y="39" width="9" height="18" :fill="look.bottomColor" />
            <rect x="25" y="39" width="9" height="18" :fill="look.bottomColor" />
            <rect x="22" y="39" width="4" height="4" :fill="bottomShadow" opacity=".58" />
          </template>
          <rect v-if="look.bottomStyle === 'shorts'" x="14" y="48" width="9" height="9" :fill="look.skinTone" />
          <rect v-if="look.bottomStyle === 'shorts'" x="25" y="48" width="9" height="9" :fill="look.skinTone" />
          <path v-if="look.bottomStyle === 'jeans'" d="M16 41h5v2h-5zm11 0h5v2h-5z" :fill="bottomShadow" opacity=".7" />
          <path v-if="look.bottomStyle === 'cargo'" d="M15 45h5v4h-5zm13 0h5v4h-5z" :fill="bottomShadow" opacity=".75" />
          <path v-if="look.bottomStyle === 'formal'" d="M23 40h2v17h-2z" :fill="bottomShadow" opacity=".7" />
        </template>
        <!-- shoes -->
        <g class="shoes" :fill="look.shoesColor">
          <path v-if="look.shoesStyle === 'boots'" d="M14 52h9v8h-10v-4h1zm11 0h9v4h1v4H25z" />
          <path v-else-if="look.shoesStyle === 'maryjane'" d="M14 56h10v4H13v-3h1zm10 0h10v1h1v3H24z" />
          <path v-else-if="look.shoesStyle === 'slippers'" d="M13 57h11v3H12v-2h1zm11 0h11v1h1v2H24z" />
          <path v-else d="M13 56h11v4H12v-3h1zm11 0h11v1h1v3H24z" />
        </g>
        <rect x="14" y="59" width="10" height="1" :fill="shoeShadow" opacity=".7" />
        <rect x="25" y="59" width="10" height="1" :fill="shoeShadow" opacity=".7" />
      </g>

      <!-- torso -->
      <g class="torso">
        <path v-if="look.genderStyle === 'female'" :fill="look.topColor" d="M15 29h18l2 14H13z" />
        <path v-else :fill="look.topColor" d="M13 29h22v14H13z" />
        <path v-if="look.topStyle === 'dress'" :fill="look.topColor" d="M14 29h20l3 22H11z" />
        <path v-if="look.topStyle === 'party'" :fill="look.topColor" d="M15 28h18l4 22H11z" />
        <path v-if="look.topStyle === 'party'" :fill="topLight" d="M17 29h14v4H17z" opacity=".55" />
        <path v-if="['blouse','shirt'].includes(look.topStyle)" :fill="topLight" d="M18 29h12v3H18z" opacity=".65" />
        <path v-if="look.topStyle === 'cardigan'" d="M23 29h2v14h-2z" fill="#f9ead5" opacity=".82" />
        <path v-if="look.topStyle === 'hoodie'" :fill="topShadow" d="M18 29h12l-2-3h-8z" />
        <path v-if="look.topStyle === 'sailor'" d="M18 29l6 6 6-6h-3l-3 3-3-3z" fill="#f5f0e8" />
        <path v-if="look.topStyle === 'turtleneck'" :fill="look.topColor" d="M20 26h8v5h-8z" />
        <path v-if="look.topStyle === 'varsity'" :fill="topShadow" d="M13 30h5v12h-5zm17 0h5v12h-5z" />
        <path v-if="look.topStyle === 'formal'" d="M17 29h14v14H17zm6 0h2v14h-2z" :fill="look.topColor" />
        <path v-if="look.topStyle === 'formal'" d="M24 31l-3-3h6z" fill="#f4eee4" />
        <path v-if="look.topStyle === 'vest'" :fill="topShadow" d="M16 29h16v14H16z" />
        <path v-if="look.topStyle === 'polo'" d="M20 29h8v4h-8z" :fill="topLight" opacity=".65" />
        <path v-if="['cami','tank'].includes(look.topStyle)" d="M15 29h4v6h-4zm14 0h4v6h-4z" :fill="look.skinTone" />
        <rect class="arm arm-left" x="9" y="30" width="5" height="13" rx="1" :fill="look.skinTone" />
        <rect class="arm arm-right" x="34" y="30" width="5" height="13" rx="1" :fill="look.skinTone" />
        <rect x="9" y="39" width="5" height="4" :fill="skinShadow" opacity=".22" />
        <rect x="34" y="39" width="5" height="4" :fill="skinShadow" opacity=".22" />
        <path v-if="['tee','sweater','hoodie','cardigan','varsity','jacket','formal'].includes(look.topStyle)" :fill="look.topColor" d="M10 29h5v8h-5zm23 0h5v8h-5z" />
        <path v-if="look.topStyle === 'jacket'" d="M23 29h2v14h-2z" :fill="topLight" opacity=".7" />
      </g>

      <!-- neck and face -->
      <rect x="21" y="26" width="6" height="5" :fill="look.skinTone" />
      <rect x="12" y="13" width="24" height="16" :fill="look.skinTone" />
      <rect x="10" y="17" width="3" height="7" :fill="look.skinTone" />
      <rect x="35" y="17" width="3" height="7" :fill="look.skinTone" />
      <rect x="13" y="25" width="22" height="4" :fill="skinShadow" opacity=".13" />

      <!-- front hair -->
      <g class="hair-front" :fill="look.hairColor">
        <path v-if="look.hairStyle === 'long'" d="M11 9h26v6h-3v5h-4v-5h-5v4h-4v-4h-6v6h-4z" />
        <path v-else-if="look.hairStyle === 'waves'" d="M11 9h26v6h-3v4h-4v-3h-4v5h-4v-4h-4v3h-3v-5h-4z" />
        <path v-else-if="look.hairStyle === 'bob'" d="M11 10h26v6h-3v5h-4v-4h-5v3h-4v-3h-6v5h-4z" />
        <path v-else-if="look.hairStyle === 'ponytail'" d="M11 9h26v6h-4v5h-4v-4h-5v4h-4v-4h-5v5h-4z" />
        <path v-else-if="look.hairStyle === 'twin'" d="M11 9h26v6h-4v4h-4v-3h-5v4h-4v-4h-5v4h-4z" />
        <path v-else-if="look.hairStyle === 'braid'" d="M11 9h26v6h-4v5h-5v-4h-4v4h-4v-4h-5v5h-4z" />
        <path v-else-if="['short','crop'].includes(look.hairStyle)" d="M11 9h26v7h-4v3h-4v-3h-5v4h-4v-4h-5v3h-4z" />
        <path v-else-if="look.hairStyle === 'side'" d="M11 9h26v7h-3v3H24v4h-4v-6h-5v3h-4z" />
        <path v-else-if="look.hairStyle === 'soft'" d="M11 9h26v7h-4v3h-4v-2h-4v4h-4v-3h-4v2h-3v-4h-3z" />
        <path v-else-if="look.hairStyle === 'messy'" d="M11 11h4V7h4v3h4V6h4v4h5V8h4v8h-3v3h-4v-2h-4v4h-4v-4h-5v3h-5z" />
        <path v-else-if="look.hairStyle === 'buzz'" d="M13 10h22v7H13z" />
      </g>
      <path v-if="look.hairStyle !== 'buzz'" :fill="hairLight" d="M15 10h11v2H15z" opacity=".36" />
      <path v-if="look.hairStyle !== 'buzz'" :fill="hairShadow" d="M11 14h3v8h-3zm23 0h3v8h-3z" opacity=".58" />

      <!-- face: tighter proportions than V1.1 -->
      <template v-if="look.eyeStyle === 'soft'">
        <rect x="17" y="19" width="3" height="3" fill="#2d2630" />
        <rect x="28" y="19" width="3" height="3" fill="#2d2630" />
        <rect x="18" y="19" width="1" height="1" fill="#fff5ec" />
        <rect x="29" y="19" width="1" height="1" fill="#fff5ec" />
      </template>
      <template v-else>
        <rect x="17" y="19" width="3" height="4" fill="#2d2630" />
        <rect x="28" y="19" width="3" height="4" fill="#2d2630" />
      </template>
      <rect x="14" y="23" width="4" height="2" fill="#dc8f92" opacity=".55" />
      <rect x="30" y="23" width="4" height="2" fill="#dc8f92" opacity=".55" />
      <path d="M22 24h4v1h-1v1h-2v-1h-1z" fill="#925360" />

      <!-- neckwear -->
      <g v-if="look.neckwear === 'necklace'" fill="#e3bd67"><rect x="23" y="31" width="2" height="3" /><rect x="22" y="33" width="4" height="2" /></g>
      <g v-if="look.neckwear === 'choker'" :fill="topShadow"><rect x="20" y="28" width="8" height="2" /></g>
      <g v-if="look.neckwear === 'scarf'" :fill="look.topColor"><rect x="18" y="27" width="12" height="4" /><rect x="27" y="30" width="4" height="8" /></g>
      <g v-if="look.neckwear === 'bowtie'" :fill="topShadow"><path d="M24 31l-5-3v6zm0 0l5-3v6z" /><rect x="23" y="30" width="2" height="2" /></g>

      <!-- facewear -->
      <g v-if="look.facewear === 'glasses' || look.facewear === 'square-glasses'" fill="none" stroke="#51434a" stroke-width="1">
        <rect x="14" y="17" width="9" height="7" :rx="look.facewear === 'glasses' ? 3 : 0" />
        <rect x="25" y="17" width="9" height="7" :rx="look.facewear === 'glasses' ? 3 : 0" />
        <path d="M23 20h2" />
      </g>
      <g v-if="look.facewear === 'hairpin'" fill="#f0c761"><rect x="32" y="13" width="5" height="2" /><rect x="34" y="12" width="1" height="4" /></g>

      <!-- headwear on top of hair -->
      <g v-if="look.headwear === 'ribbon'" :fill="look.topColor"><path d="M33 10l5-4v5l-5 2zm0 0l5 4V9l-5-2z" /><rect x="31" y="9" width="3" height="3" /></g>
      <g v-if="look.headwear === 'headband'" :fill="look.topColor"><path d="M12 12h24v3H12z" /></g>
      <g v-if="look.headwear === 'flower'" fill="#f5d66a"><rect x="33" y="9" width="3" height="3" /><rect x="32" y="10" width="5" height="1" /><rect x="34" y="8" width="1" height="5" /></g>
      <g v-if="look.headwear === 'beret'" :fill="look.topColor"><path d="M14 7h20v3h4v6H10v-5h4z" /><rect x="25" y="5" width="4" height="2" :fill="topShadow" /></g>
      <g v-if="look.headwear === 'cap'" :fill="look.topColor"><path d="M12 7h24v8H12z" /><path d="M28 14h12v3H28z" :fill="topShadow" /></g>
      <g v-if="look.headwear === 'strawhat'" fill="#c99d4e"><path d="M10 7h28v3h5v4H5v-4h5z" /><rect x="15" y="4" width="18" height="5" /><rect x="16" y="9" width="16" height="2" fill="#8f5d43" /></g>
      <g v-if="look.headwear === 'witch'" fill="#393344"><path d="M21 2h9l5 11H13z" /><path d="M7 12h34v5H7z" /><rect x="17" y="11" width="15" height="2" fill="#8f5d8c" /></g>
    </svg>
  </span>
</template>

<style scoped>
.avatar-wrap{--avatar-size:64px;display:inline-grid;place-items:center;width:var(--avatar-size);height:calc(var(--avatar-size)*1.34);transform-origin:center bottom;filter:drop-shadow(0 calc(var(--avatar-size)*.05) calc(var(--avatar-size)*.035) rgba(42,31,35,.17))}.pixel-avatar{width:100%;height:100%;overflow:visible;image-rendering:pixelated}.active{filter:drop-shadow(0 0 calc(var(--avatar-size)*.08) rgba(255,234,160,.88)) drop-shadow(0 calc(var(--avatar-size)*.05) calc(var(--avatar-size)*.035) rgba(42,31,35,.17))}.anim-idle{animation:avatarBreath 2.1s steps(2,end) infinite}.anim-walk{animation:avatarWalk .34s steps(2,end) infinite}.anim-walk .legs{animation:legBob .34s steps(2,end) infinite}.anim-rollDice .arm-right{transform-origin:36px 31px;animation:avatarThrow .55s steps(3,end) infinite}.anim-closeDistance{animation:avatarLean 1s ease-in-out infinite}.anim-hug .arm-left{transform-origin:11px 31px;transform:rotate(-38deg) translate(-1px,1px)}.anim-hug .arm-right{transform-origin:37px 31px;transform:rotate(38deg) translate(1px,1px)}.anim-kiss{animation:avatarLean .78s ease-in-out infinite}@keyframes avatarBreath{50%{transform:translateY(-1px)}}@keyframes avatarWalk{25%{transform:translateY(-2px) rotate(-1deg)}75%{transform:translateY(-1px) rotate(1deg)}}@keyframes legBob{50%{transform:translateY(1px)}}@keyframes avatarThrow{0%,100%{transform:none}50%{transform:rotate(-45deg) translate(-2px,-2px)}}@keyframes avatarLean{50%{transform:translateX(2px) rotate(1deg)}}@media(prefers-reduced-motion:reduce){.avatar-wrap,.avatar-wrap *{animation:none!important}}
</style>
