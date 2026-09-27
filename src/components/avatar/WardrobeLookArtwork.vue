<script setup lang="ts">
import { computed } from 'vue'
import type { AvatarGenderStyle, AvatarOutfitCategory } from '../../services/avatarWardrobeService'

import femaleE1 from '../../assets/wardrobe-illustrations/female-e-1.webp'
import femaleE2 from '../../assets/wardrobe-illustrations/female-e-2.webp'
import femaleE3 from '../../assets/wardrobe-illustrations/female-e-3.webp'
import femaleF1 from '../../assets/wardrobe-illustrations/female-f-1.webp'
import femaleF2 from '../../assets/wardrobe-illustrations/female-f-2.webp'
import femaleF3 from '../../assets/wardrobe-illustrations/female-f-3.webp'
import femaleG1 from '../../assets/wardrobe-illustrations/female-g-1.webp'
import femaleG2 from '../../assets/wardrobe-illustrations/female-g-2.webp'
import femaleG3 from '../../assets/wardrobe-illustrations/female-g-3.webp'
import maleE1 from '../../assets/wardrobe-illustrations/male-e-1.webp'
import maleE2 from '../../assets/wardrobe-illustrations/male-e-2.webp'
import maleE3 from '../../assets/wardrobe-illustrations/male-e-3.webp'
import maleF1 from '../../assets/wardrobe-illustrations/male-f-1.webp'
import maleF2 from '../../assets/wardrobe-illustrations/male-f-2.webp'
import maleG1 from '../../assets/wardrobe-illustrations/male-g-1.webp'
import maleG2 from '../../assets/wardrobe-illustrations/male-g-2.webp'
import maleG3 from '../../assets/wardrobe-illustrations/male-g-3.webp'

const props = withDefaults(defineProps<{
  gender: AvatarGenderStyle
  outfitName: string
  category?: AvatarOutfitCategory
  alt?: string
  mode?: 'hero' | 'thumb'
}>(), { category: 'daily', alt: '', mode: 'hero' })

const female: Record<string, string> = {
  '奶油日常': femaleE1,
  '玫瑰约会': femaleE2,
  '居家软绵': femaleE3,
  '甜美花园': femaleE1,
  '复古学院': femaleF1,
  '蓝白浪漫': femaleE2,
  '向日葵田园': femaleE1,
  '书房针织': femaleF3,
  '城市粉雾': femaleE1,
  '夜色酷甜': femaleG1,
  '晚安睡衣': femaleG3,
  '轻正式': femaleF2
}

const male: Record<string, string> = {
  '清爽日常': maleE1,
  '深色约会': maleE2,
  '居家宽松': maleE3,
  '温柔学院': maleF1,
  '晚安睡衣': maleG3,
  '轻正式': maleF2,
  '田园背带': maleG1,
  '阳光户外': maleG1,
  '学院复古': maleF1,
  '城市约会': maleE2,
  '夏日约会': maleG2,
  '周末居家': maleG3
}

const fallbackFemale: Record<AvatarOutfitCategory, string> = { daily: femaleE1, date: femaleG2, home: femaleE3, sleepwear: femaleG3, formal: femaleF2, private: femaleG2 }
const fallbackMale: Record<AvatarOutfitCategory, string> = { daily: maleE1, date: maleE2, home: maleE3, sleepwear: maleG3, formal: maleF2, private: maleE2 }
const source = computed(() => {
  const exact = (props.gender === 'female' ? female : male)[props.outfitName]
  return exact || (props.gender === 'female' ? fallbackFemale : fallbackMale)[props.category]
})
</script>

<template>
  <figure v-if="source" class="look-art" :class="`mode-${props.mode}`">
    <img :src="source" :alt="props.alt || `${props.outfitName} 穿搭预览`" draggable="false" />
  </figure>
</template>

<style scoped>
.look-art{margin:0;overflow:hidden;background:#f8ead0;box-shadow:inset 0 0 0 1px rgba(100,65,41,.18)}
.look-art img{width:100%;height:100%;display:block;object-fit:cover;object-position:center 43%;image-rendering:auto;user-select:none;-webkit-user-drag:none}
.mode-hero{position:absolute;inset:0;border-radius:11px}
.mode-hero::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(255,248,231,.08),transparent 55%,rgba(50,31,22,.13));box-shadow:inset 0 0 0 3px rgba(255,239,199,.66)}
.mode-thumb{width:48px;height:58px;border-radius:8px;border:1px solid #c99a69;box-shadow:0 2px 0 #a7734d}
.mode-thumb img{object-position:center 40%}
</style>
