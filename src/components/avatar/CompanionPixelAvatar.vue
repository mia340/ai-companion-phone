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
  `accessory-${look.value.accessory}`,
  `anim-${props.animation}`,
  { active: props.active }
])

const darker = (hex: string, amount = 24) => {
  const raw = hex.replace('#', '')
  const n = Number.parseInt(raw, 16)
  if (!Number.isFinite(n)) return hex
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 255) - amount)
  const b = Math.max(0, (n & 255) - amount)
  return `rgb(${r}, ${g}, ${b})`
}

const skinShadow = computed(() => darker(look.value.skinTone, 18))
const hairShadow = computed(() => darker(look.value.hairColor, 28))
const topShadow = computed(() => darker(look.value.topColor, 26))
const bottomShadow = computed(() => darker(look.value.bottomColor, 26))
</script>

<template>
  <span class="avatar-wrap" :class="classes" :style="{ '--avatar-size': `${props.size}px` }" :aria-label="props.label || '像素角色'">
    <svg class="pixel-avatar" viewBox="0 0 64 82" role="img" shape-rendering="crispEdges" aria-hidden="true">
      <ellipse cx="32" cy="76" rx="17" ry="3.3" fill="rgba(53,42,49,.16)" />

      <!-- back hair: built from simple blocky shapes so the face always stays visible -->
      <g :fill="look.hairColor">
        <path v-if="look.hairStyle === 'waves' || (look.hairStyle === 'long' && look.genderStyle === 'female')" d="M16 17h32v27h-5v10h-7V31h-8v23h-7V44h-5z" />
        <path v-else-if="look.hairStyle === 'bob'" d="M17 17h30v26h-6v6h-5V31h-8v18h-5v-6h-6z" />
        <path v-else-if="look.hairStyle === 'ponytail'" d="M17 17h30v20h-4v7h-4V31H21v13h-4z" />
        <rect v-if="look.hairStyle === 'ponytail'" x="47" y="21" width="8" height="20" rx="2" />
        <path v-if="look.hairStyle === 'long' && look.genderStyle === 'male'" d="M17 17h30v25h-5v9h-6V31h-8v20h-6v-9h-5z" />
      </g>

      <!-- legs and shoes -->
      <g class="legs">
        <template v-if="['skirt','pleated'].includes(look.bottomStyle)">
          <path :fill="look.bottomColor" d="M21 51h22l4 12H17z" />
          <path v-if="look.bottomStyle === 'pleated'" :fill="bottomShadow" d="M24 52h2l-2 10h-3zm8 0h2v11h-2zm8 0h2l3 10h-3z" opacity=".58" />
          <rect x="22" y="62" width="7" height="8" :fill="look.skinTone" />
          <rect x="35" y="62" width="7" height="8" :fill="look.skinTone" />
        </template>
        <template v-else>
          <rect x="20" y="52" width="10" height="18" :fill="look.bottomColor" />
          <rect x="34" y="52" width="10" height="18" :fill="look.bottomColor" />
          <rect x="27" y="52" width="10" height="4" :fill="bottomShadow" opacity=".42" />
          <rect v-if="look.bottomStyle === 'shorts'" x="20" y="62" width="10" height="8" :fill="look.skinTone" />
          <rect v-if="look.bottomStyle === 'shorts'" x="34" y="62" width="10" height="8" :fill="look.skinTone" />
        </template>
        <rect x="18" y="69" width="13" height="6" rx="2" :fill="look.shoesColor" />
        <rect x="33" y="69" width="13" height="6" rx="2" :fill="look.shoesColor" />
        <rect x="19" y="73" width="12" height="2" :fill="darker(look.shoesColor, 22)" opacity=".6" />
        <rect x="34" y="73" width="12" height="2" :fill="darker(look.shoesColor, 22)" opacity=".6" />
      </g>

      <!-- torso and arms -->
      <g class="torso">
        <rect v-if="look.genderStyle === 'female'" x="19" y="37" width="26" height="18" rx="4" :fill="look.topColor" />
        <rect v-else x="17" y="37" width="30" height="18" rx="3" :fill="look.topColor" />
        <rect x="21" y="51" width="22" height="4" :fill="topShadow" opacity=".42" />
        <rect v-if="look.topStyle === 'jacket'" x="31" y="37" width="2" height="18" fill="rgba(255,255,255,.35)" />
        <rect v-if="['cami','tank'].includes(look.topStyle)" x="18" y="38" width="5" height="8" :fill="look.skinTone" />
        <rect v-if="['cami','tank'].includes(look.topStyle)" x="41" y="38" width="5" height="8" :fill="look.skinTone" />
        <path v-if="look.topStyle === 'dress'" :fill="look.topColor" d="M20 37h24l5 25H15z" />
        <rect class="arm arm-left" x="13" y="39" width="7" height="17" rx="3" :fill="look.skinTone" />
        <rect class="arm arm-right" x="44" y="39" width="7" height="17" rx="3" :fill="look.skinTone" />
        <rect x="14" y="51" width="6" height="5" rx="2" :fill="skinShadow" opacity=".25" />
        <rect x="44" y="51" width="6" height="5" rx="2" :fill="skinShadow" opacity=".25" />
      </g>

      <!-- ears + face -->
      <rect x="13" y="23" width="5" height="10" rx="2" :fill="look.skinTone" />
      <rect x="46" y="23" width="5" height="10" rx="2" :fill="look.skinTone" />
      <rect x="17" y="15" width="30" height="25" rx="7" :fill="look.skinTone" />
      <rect x="18" y="34" width="28" height="5" :fill="skinShadow" opacity=".16" />

      <!-- front hair -->
      <g :fill="look.hairColor">
        <path v-if="look.hairStyle === 'long'" d="M16 15h32v9h-4v5h-4v-6h-7v5h-5v-5h-7v7h-5z" />
        <path v-else-if="look.hairStyle === 'waves'" d="M16 15h32v8h-4v4h-4v-4h-5v6h-5v-5h-5v4h-4v-5h-5z" />
        <path v-else-if="look.hairStyle === 'bob'" d="M16 15h32v8h-4v5h-5v-5h-5v4h-5v-4h-8v6h-5z" />
        <path v-else-if="look.hairStyle === 'ponytail'" d="M16 15h32v8h-5v5h-5v-5h-5v4h-6v-4h-6v6h-5z" />
        <path v-else-if="['short','crop'].includes(look.hairStyle)" d="M16 15h32v8h-5v3h-4v-3h-6v4h-5v-4h-7v3h-5z" />
        <path v-else-if="look.hairStyle === 'side'" d="M16 15h32v8h-5v3H31v4h-5v-6h-5v3h-5z" />
        <path v-else-if="look.hairStyle === 'soft'" d="M16 15h32v8h-4v4h-5v-3h-5v5h-5v-4h-5v3h-4v-4h-4z" />
        <path v-else-if="look.hairStyle === 'buzz'" d="M18 15h28v7H18z" />
      </g>
      <rect x="19" y="16" width="26" height="3" :fill="hairShadow" opacity=".22" />

      <!-- face -->
      <rect x="23" y="27" width="3" height="4" rx="1" fill="#382d33" />
      <rect x="38" y="27" width="3" height="4" rx="1" fill="#382d33" />
      <rect x="22" y="32" width="5" height="2" rx="1" fill="#e69aa4" opacity=".52" />
      <rect x="37" y="32" width="5" height="2" rx="1" fill="#e69aa4" opacity=".52" />
      <path d="M29 34h6v2h-1v1h-4v-1h-1z" fill="#965562" />

      <!-- accessories -->
      <g v-if="look.accessory === 'glasses'" fill="none" stroke="#54454c" stroke-width="1.5">
        <rect x="20" y="25" width="9" height="8" rx="2" />
        <rect x="35" y="25" width="9" height="8" rx="2" />
        <path d="M29 28h6" />
      </g>
      <g v-if="look.accessory === 'earrings'" fill="#d5aa5a">
        <rect x="14" y="31" width="2" height="4" />
        <rect x="48" y="31" width="2" height="4" />
      </g>
      <g v-if="look.accessory === 'necklace'" fill="#e5c57c">
        <rect x="30" y="40" width="4" height="4" rx="1" />
      </g>
      <g v-if="look.accessory === 'cap'">
        <path :fill="look.topColor" d="M17 12h30v8H17z" />
        <path :fill="topShadow" d="M39 19h14v4H39z" />
      </g>
      <g v-if="look.accessory === 'ribbon'" :fill="look.topColor">
        <path d="M45 16l6-4v6l-6 3z" />
        <path d="M45 16l6 4v-6l-6-3z" />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.avatar-wrap{--avatar-size:64px;display:inline-grid;place-items:center;width:var(--avatar-size);height:calc(var(--avatar-size)*1.28);transform-origin:center bottom;filter:drop-shadow(0 calc(var(--avatar-size)*.055) calc(var(--avatar-size)*.04) rgba(45,35,40,.18))}.pixel-avatar{width:100%;height:100%;overflow:visible;image-rendering:pixelated}.active{filter:drop-shadow(0 0 calc(var(--avatar-size)*.09) rgba(255,243,184,.9)) drop-shadow(0 calc(var(--avatar-size)*.055) calc(var(--avatar-size)*.04) rgba(45,35,40,.18))}.anim-idle{animation:avatarBreath 2.1s steps(2,end) infinite}.anim-walk{animation:avatarWalk .36s steps(2,end) infinite}.anim-walk .legs{animation:legBob .36s steps(2,end) infinite}.anim-rollDice .arm-right{transform-origin:47px 41px;animation:avatarThrow .55s steps(3,end) infinite}.anim-closeDistance{animation:avatarLean 1s ease-in-out infinite}.anim-hug .arm-left{transform-origin:16px 40px;transform:rotate(-42deg) translate(-1px,1px)}.anim-hug .arm-right{transform-origin:48px 40px;transform:rotate(42deg) translate(1px,1px)}.anim-kiss{animation:avatarLean .78s ease-in-out infinite}@keyframes avatarBreath{50%{transform:translateY(-1px)}}@keyframes avatarWalk{25%{transform:translateY(-2px) rotate(-1deg)}75%{transform:translateY(-1px) rotate(1deg)}}@keyframes legBob{50%{transform:translateY(1px)}}@keyframes avatarThrow{0%,100%{transform:none}50%{transform:rotate(-48deg) translate(-3px,-3px)}}@keyframes avatarLean{50%{transform:translateX(2px) rotate(1deg)}}@media(prefers-reduced-motion:reduce){.avatar-wrap,.avatar-wrap *{animation:none!important}}
</style>
