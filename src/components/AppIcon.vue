<script setup lang="ts">
import type { HomeAppKey } from '../services/appCustomizationService'

const props = withDefaults(defineProps<{
  icon: HomeAppKey
  customImage?: string
  size?: number
  tones?: [string, string]
}>(), {
  size: 62,
  tones: () => ['#79b7ee', '#a8d8f7']
})
</script>

<template>
  <span
    class="app-icon-tile"
    :style="{
      width: `${props.size}px`,
      height: `${props.size}px`,
      '--icon-a': props.tones[0],
      '--icon-b': props.tones[1]
    }"
  >
    <img v-if="props.customImage" :src="props.customImage" alt="" class="custom-icon-image">

    <svg v-else class="app-icon-svg" viewBox="0 0 64 64" aria-hidden="true">
      <g v-if="props.icon === 'chat'">
        <path d="M14 17.5c0-4.1 3.3-7.5 7.5-7.5h21c4.1 0 7.5 3.4 7.5 7.5v13c0 4.1-3.4 7.5-7.5 7.5H31l-9.5 8v-8h0A7.5 7.5 0 0 1 14 30.5v-13Z" fill="rgba(255,255,255,.94)"/>
        <path d="M20 25h20M20 31h12" stroke="var(--icon-a)" stroke-width="3" stroke-linecap="round" opacity=".65"/>
        <path d="m47 13 1.3 3.7L52 18l-3.7 1.3L47 23l-1.3-3.7L42 18l3.7-1.3L47 13Z" fill="white"/>
      </g>
      <g v-else-if="props.icon === 'contacts'">
        <circle cx="25" cy="23" r="7" fill="rgba(255,255,255,.95)"/>
        <circle cx="43" cy="25" r="6" fill="rgba(255,255,255,.78)"/>
        <path d="M12 48c1.8-8.1 6.3-12 13-12s11.2 3.9 13 12" fill="rgba(255,255,255,.95)"/>
        <path d="M34 48c1.2-5.8 4.4-8.7 9.4-8.7 4.4 0 7.3 2.5 8.6 7.2" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" opacity=".8"/>
      </g>
      <g v-else-if="props.icon === 'moments'">
        <circle cx="32" cy="32" r="7" fill="white"/>
        <path d="M32 10c6 7 6 12 0 16-6-4-6-9 0-16Zm22 22c-7 6-12 6-16 0 4-6 9-6 16 0ZM32 54c-6-7-6-12 0-16 6 4 6 9 0 16ZM10 32c7-6 12-6 16 0-4 6-9 6-16 0Z" fill="rgba(255,255,255,.92)"/>
        <circle cx="32" cy="32" r="19" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/>
      </g>
      <g v-else-if="props.icon === 'diary'">
        <rect x="17" y="11" width="32" height="43" rx="6" fill="rgba(255,255,255,.95)"/>
        <path d="M25 11v43" stroke="var(--icon-a)" stroke-width="3" opacity=".55"/>
        <path d="M32 22h11M32 29h11M32 36h8" stroke="var(--icon-a)" stroke-width="3" stroke-linecap="round" opacity=".65"/>
        <path d="M38 11v13l-4-2.8-4 2.8V11" fill="var(--icon-a)" opacity=".8"/>
      </g>
      <g v-else-if="props.icon === 'music'">
        <path d="M39 14v27.5c0 6-4.4 10.5-10.2 10.5-4.8 0-8.3-2.7-8.3-6.7 0-4.4 4.1-7.3 9-7.3 2.2 0 4.3.5 6 1.5V18l17-4v24" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="27" cy="45" r="6" fill="white"/>
        <circle cx="46" cy="40" r="6" fill="rgba(255,255,255,.8)"/>
      </g>
      <g v-else-if="props.icon === 'wallet'">
        <rect x="10" y="18" width="44" height="31" rx="8" fill="rgba(255,255,255,.94)"/>
        <path d="M13 24h35c3.3 0 6 2.7 6 6v12H42c-5 0-9-4-9-9s4-9 9-9h12" fill="var(--icon-a)" opacity=".45"/>
        <circle cx="42" cy="33" r="3" fill="white"/>
      </g>
      <g v-else-if="props.icon === 'turtle-soup'">
        <path d="M15 34c1.6-11.2 8-17 17-17s15.4 5.8 17 17H15Z" fill="rgba(255,255,255,.9)"/>
        <path d="M20 31c4-4 7-5 12-5s8 1 12 5" fill="none" stroke="var(--icon-a)" stroke-width="3" stroke-linecap="round"/>
        <path d="M18 36c2.4 8.3 7.1 12 14 12s11.6-3.7 14-12" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>
        <path d="M14 35h36" stroke="white" stroke-width="3" stroke-linecap="round" opacity=".8"/>
        <path d="M48 19c4-3 7-1 6 3" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
      </g>
      <g v-else-if="props.icon === 'profile'">
        <circle cx="32" cy="23" r="10" fill="rgba(255,255,255,.95)"/>
        <path d="M14 53c1.6-11.2 7.7-17 18-17s16.4 5.8 18 17" fill="rgba(255,255,255,.95)"/>
        <path d="M23 24c3 2.6 7.6 2.6 11 0" fill="none" stroke="var(--icon-a)" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
      </g>
      <g v-else-if="props.icon === 'memory'">
        <path d="M21 18c-5 0-8 3.7-8 8.2 0 2.5 1 4.6 2.7 6.1-1.3 1.5-2 3.4-2 5.5 0 5.4 3.8 8.7 8.9 8.7h3.5v4h12v-4h3.5c5.1 0 8.9-3.3 8.9-8.7 0-2.1-.7-4-2-5.5 1.7-1.5 2.7-3.6 2.7-6.1C50.3 21.7 47 18 42 18c-2.7 0-5 .9-6.5 2.6C34 18.9 31.7 18 29 18h-8Z" fill="rgba(255,255,255,.94)"/>
        <path d="M25 29h14M25 36h14" stroke="var(--icon-a)" stroke-width="3" stroke-linecap="round" opacity=".62"/>
      </g>
      <g v-else-if="props.icon === 'world'">
        <circle cx="32" cy="32" r="21" fill="rgba(255,255,255,.92)"/>
        <path d="M11 32h42M32 11c7 6.4 10 13.4 10 21s-3 14.6-10 21c-7-6.4-10-13.4-10-21s3-14.6 10-21Z" fill="none" stroke="var(--icon-a)" stroke-width="2.8" opacity=".65"/>
        <path d="M18 20c4 2.8 9 4.2 14 4.2S42 22.8 46 20M18 44c4-2.8 9-4.2 14-4.2S42 41.2 46 44" fill="none" stroke="var(--icon-a)" stroke-width="2.4" opacity=".5"/>
      </g>
      <g v-else-if="props.icon === 'backup'">
        <rect x="13" y="14" width="38" height="38" rx="9" fill="rgba(255,255,255,.92)"/>
        <path d="M32 22v18M25 33l7 7 7-7" fill="none" stroke="var(--icon-a)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 45h20" stroke="var(--icon-a)" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      </g>
      <g v-else-if="props.icon === 'settings'">
        <path d="m32 11 4 5.2 6.4-.7 2.6 5.8 6 2.3-1 6.3 4.2 4.8-4.2 4.8 1 6.3-6 2.3-2.6 5.8-6.4-.7-4 5.2-4-5.2-6.4.7-2.6-5.8-6-2.3 1-6.3L10 34.7l4.2-4.8-1-6.3 6-2.3 2.6-5.8 6.4.7L32 11Z" fill="rgba(255,255,255,.92)"/>
        <circle cx="32" cy="34.7" r="8" fill="var(--icon-a)" opacity=".65"/>
        <circle cx="32" cy="34.7" r="3" fill="white"/>
      </g>
      <g v-else>
        <circle cx="32" cy="28" r="10" fill="rgba(255,255,255,.95)"/>
        <path d="M13 53c2-10 8.2-15 19-15s17 5 19 15" fill="rgba(255,255,255,.92)"/>
        <path d="M32 10v10M27 15h10" stroke="var(--icon-a)" stroke-width="3.5" stroke-linecap="round" opacity=".72"/>
      </g>
    </svg>

    <span class="icon-glass"></span>
  </span>
</template>

<style scoped>
.app-icon-tile {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 20px;
  background: linear-gradient(145deg, var(--icon-a), var(--icon-b));
  box-shadow:
    0 12px 22px rgba(52, 86, 112, .14),
    inset 0 1px 0 rgba(255,255,255,.72),
    inset 0 -1px 0 rgba(45,76,104,.08);
  isolation: isolate;
}
.app-icon-tile::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(90% 70% at 28% 12%, rgba(255,255,255,.58), transparent 55%);
  pointer-events: none;
}
.icon-glass {
  position: absolute;
  inset: 1px;
  border: 1px solid rgba(255,255,255,.42);
  border-radius: 19px;
  pointer-events: none;
}
.custom-icon-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  z-index: 1;
}
.app-icon-svg {
  position: relative;
  z-index: 2;
  width: 76%;
  height: 76%;
  filter: drop-shadow(0 2px 3px rgba(41,64,84,.12));
}
</style>
