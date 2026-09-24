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
  size: 58,
  animation: 'idle',
  active: false,
  label: ''
})

const look = computed(() => resolveAvatarLook(props.profile))
const cssVars = computed(() => ({
  '--avatar-size': `${props.size}px`,
  '--skin': look.value.skinTone,
  '--hair': look.value.hairColor,
  '--top': look.value.topColor,
  '--bottom': look.value.bottomColor,
  '--shoe': look.value.shoesColor
}))
</script>

<template>
  <span
    class="companion-pixel-avatar"
    :class="[`gender-${look.genderStyle}`, `hair-${look.hairStyle}`, `top-${look.topStyle}`, `bottom-${look.bottomStyle}`, `accessory-${look.accessory}`, `anim-${props.animation}`, { active: props.active }]"
    :style="cssVars"
    :aria-label="props.label || '像素角色'"
  >
    <span class="avatar-shadow"></span>
    <span class="avatar-legs"><i></i><i></i></span>
    <span class="avatar-shoes"><i></i><i></i></span>
    <span class="avatar-body"><i class="arm left"></i><i class="arm right"></i><b class="necklace-dot"></b></span>
    <span class="avatar-head">
      <i class="ear left"></i><i class="ear right"></i>
      <b class="eye left"></b><b class="eye right"></b><b class="mouth"></b>
    </span>
    <span class="avatar-hair"><i></i><b></b></span>
    <span v-if="look.accessory === 'glasses'" class="avatar-glasses"><i></i><i></i></span>
    <span v-if="look.accessory === 'earrings'" class="avatar-earrings">· ·</span>
    <span v-if="look.accessory === 'cap'" class="avatar-cap"></span>
    <span v-if="look.accessory === 'ribbon'" class="avatar-ribbon">◆</span>
  </span>
</template>

<style scoped>
.companion-pixel-avatar{position:relative;display:inline-block;width:var(--avatar-size);height:calc(var(--avatar-size)*1.28);image-rendering:pixelated;filter:drop-shadow(0 calc(var(--avatar-size)*.08) calc(var(--avatar-size)*.08) rgba(44,31,40,.2));transform-origin:center bottom}.companion-pixel-avatar>*{position:absolute;box-sizing:border-box}.avatar-shadow{left:18%;right:18%;bottom:1%;height:8%;border-radius:50%;background:rgba(45,31,37,.18);filter:blur(.5px)}.avatar-head{z-index:6;left:28%;top:16%;width:44%;height:35%;border-radius:42% 42% 46% 46%;background:var(--skin);box-shadow:inset 0 -2px rgba(110,67,62,.08)}.avatar-hair{z-index:7;left:22%;top:8%;width:56%;height:31%;border-radius:48% 48% 30% 30%;background:var(--hair);clip-path:polygon(7% 18%,24% 2%,76% 2%,96% 20%,92% 69%,80% 54%,72% 37%,60% 51%,47% 35%,35% 51%,22% 35%,13% 65%)}.avatar-hair i,.avatar-hair b{display:none}.hair-long .avatar-hair{height:55%;clip-path:polygon(8% 10%,27% 0,77% 2%,95% 17%,94% 88%,79% 100%,78% 46%,65% 32%,52% 45%,39% 32%,26% 49%,24% 100%,7% 85%)}.hair-waves .avatar-hair{height:56%;clip-path:polygon(7% 12%,26% 0,75% 1%,96% 18%,90% 96%,77% 82%,68% 97%,58% 79%,46% 97%,34% 80%,23% 97%,8% 84%)}.hair-bob .avatar-hair{height:43%;clip-path:polygon(7% 13%,27% 0,78% 2%,96% 20%,92% 85%,78% 100%,76% 49%,61% 35%,49% 49%,34% 34%,22% 54%,20% 100%,5% 80%)}.hair-ponytail .avatar-hair{height:40%}.hair-ponytail .avatar-hair::after{content:'';position:absolute;right:-30%;top:18%;width:38%;height:54%;border-radius:20% 60% 60% 20%;background:var(--hair)}.hair-short .avatar-hair,.hair-crop .avatar-hair{height:26%}.hair-side .avatar-hair{height:30%;clip-path:polygon(5% 28%,26% 0,83% 4%,97% 30%,79% 47%,57% 24%,34% 43%,13% 72%)}.hair-soft .avatar-hair{height:34%;clip-path:polygon(4% 23%,24% 1%,77% 2%,98% 25%,91% 67%,75% 48%,61% 64%,48% 43%,34% 61%,17% 45%)}.hair-buzz .avatar-hair{height:18%;border-radius:48% 48% 18% 18%;clip-path:none}.eye{top:48%;width:8%;height:6%;border-radius:50%;background:#3e3036}.eye.left{left:24%}.eye.right{right:24%}.mouth{left:43%;bottom:18%;width:14%;height:4%;border-radius:0 0 8px 8px;background:#a05d68}.ear{top:48%;width:9%;height:18%;border-radius:50%;background:var(--skin)}.ear.left{left:-6%}.ear.right{right:-6%}.avatar-body{z-index:4;left:24%;top:48%;width:52%;height:30%;border-radius:25% 25% 12% 12%;background:var(--top);box-shadow:inset 0 -3px rgba(43,30,39,.08)}.gender-male .avatar-body{left:20%;width:60%;border-radius:18% 18% 10% 10%}.top-cami .avatar-body,.top-tank .avatar-body{left:29%;width:42%}.top-dress .avatar-body{height:39%;clip-path:polygon(14% 0,86% 0,100% 100%,0 100%)}.top-jacket .avatar-body{box-shadow:inset 3px 0 rgba(255,255,255,.18),inset -3px 0 rgba(0,0,0,.08)}.arm{position:absolute;top:8%;width:18%;height:70%;border-radius:999px;background:var(--skin)}.arm.left{left:-15%;transform:rotate(7deg)}.arm.right{right:-15%;transform:rotate(-7deg)}.avatar-legs{z-index:3;left:31%;top:75%;width:38%;height:18%;display:flex;justify-content:space-between}.avatar-legs i{position:relative;width:38%;height:100%;border-radius:0 0 4px 4px;background:var(--bottom)}.bottom-skirt .avatar-legs,.bottom-pleated .avatar-legs{left:27%;width:46%;top:73%}.bottom-skirt .avatar-legs::before,.bottom-pleated .avatar-legs::before{content:'';position:absolute;left:-12%;right:-12%;top:-28%;height:55%;background:var(--bottom);clip-path:polygon(18% 0,82% 0,100% 100%,0 100%)}.bottom-shorts .avatar-legs{top:74%;height:16%}.avatar-shoes{z-index:4;left:28%;bottom:5%;width:44%;height:10%;display:flex;justify-content:space-between}.avatar-shoes i{width:43%;height:72%;border-radius:45% 45% 25% 25%;background:var(--shoe);box-shadow:0 2px rgba(45,30,36,.12)}.avatar-glasses{z-index:9;left:31%;top:32%;width:38%;height:12%;display:flex;justify-content:space-between}.avatar-glasses i{width:40%;height:100%;border:1.5px solid #554650;border-radius:3px}.avatar-glasses::after{content:'';position:absolute;left:40%;right:40%;top:45%;height:1px;background:#554650}.avatar-earrings{z-index:9;left:24%;right:24%;top:43%;font-size:calc(var(--avatar-size)*.12);color:#d6a45e;text-align:justify}.avatar-cap{z-index:9;left:18%;top:5%;width:65%;height:18%;border-radius:60% 60% 16% 16%;background:var(--top)}.avatar-cap::after{content:'';position:absolute;right:-18%;bottom:-15%;width:45%;height:28%;background:var(--top);border-radius:2px}.avatar-ribbon{z-index:10;right:10%;top:9%;font-size:calc(var(--avatar-size)*.18);color:var(--top)}.accessory-necklace .necklace-dot{position:absolute;z-index:5;left:46%;top:4%;width:8%;height:9%;border-radius:50%;background:#e7ca8c}.active{filter:drop-shadow(0 0 calc(var(--avatar-size)*.12) rgba(255,245,196,.95)) drop-shadow(0 calc(var(--avatar-size)*.08) calc(var(--avatar-size)*.08) rgba(44,31,40,.2))}.anim-idle{animation:avatarBreath 2.4s ease-in-out infinite}.anim-walk{animation:avatarWalk .32s steps(2,end) infinite}.anim-rollDice .arm.right{animation:avatarThrow .55s ease-in-out infinite}.anim-closeDistance{animation:avatarLean 1s ease-in-out infinite}.anim-hug .arm{height:85%}.anim-kiss{animation:avatarLean .85s ease-in-out infinite}@keyframes avatarBreath{50%{transform:translateY(-1.5%)}}@keyframes avatarWalk{25%{transform:translateY(-4%) rotate(-1deg)}75%{transform:translateY(-1%) rotate(1deg)}}@keyframes avatarThrow{50%{transform:rotate(-48deg) translateY(-18%)}}@keyframes avatarLean{50%{transform:translateX(4%) rotate(1deg)}}@media(prefers-reduced-motion:reduce){.companion-pixel-avatar{animation:none!important}.anim-rollDice .arm.right{animation:none!important}}
</style>
