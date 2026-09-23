<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  avatar?: string
  variant?: 'user' | 'partner'
  moving?: boolean
  active?: boolean
}>(), {
  avatar: '',
  variant: 'partner',
  moving: false,
  active: false
})
</script>

<template>
  <div class="sprite-wrap" :class="[`sprite-${props.variant}`, { moving: props.moving, active: props.active }]" :title="props.name">
    <div class="pixel-person" aria-hidden="true">
      <div class="pixel-shadow"></div>
      <div class="pixel-hair"></div>
      <div class="pixel-head">
        <img v-if="props.avatar" :src="props.avatar" alt="" />
        <span v-else>•‿•</span>
      </div>
      <div class="pixel-body"><i></i><i></i></div>
      <div class="pixel-legs"><i></i><i></i></div>
    </div>
    <span class="sprite-name">{{ props.name }}</span>
  </div>
</template>

<style scoped>
.sprite-wrap{position:relative;width:34px;height:48px;display:grid;place-items:center;filter:drop-shadow(0 4px 4px rgba(62,34,48,.22));transform:translate(-50%,-72%);transition:filter .2s ease}.pixel-person{position:relative;width:24px;height:34px;image-rendering:pixelated;transform-origin:center bottom}.sprite-wrap.moving .pixel-person{animation:pixelWalk .24s steps(2,end) infinite}.sprite-wrap.active .pixel-person{filter:drop-shadow(0 0 5px rgba(255,255,255,.9))}.pixel-shadow{position:absolute;left:4px;bottom:0;width:17px;height:4px;background:rgba(70,42,55,.2);border-radius:50%}.pixel-hair{position:absolute;z-index:4;left:5px;top:1px;width:15px;height:12px;background:#4d3542;box-shadow:-2px 2px #4d3542,2px 2px #4d3542}.pixel-head{position:absolute;z-index:5;left:6px;top:4px;width:13px;height:13px;overflow:hidden;border:2px solid #f4cbb9;background:#f6d2c2;display:grid;place-items:center;font-size:5px;line-height:1}.pixel-head img{width:100%;height:100%;object-fit:cover;image-rendering:auto}.pixel-body{position:absolute;z-index:3;left:5px;top:17px;width:15px;height:10px;background:#9d4e70;box-shadow:-3px 2px #f1c6d5,3px 2px #f1c6d5}.sprite-user .pixel-body{background:#c27a94}.pixel-body i{position:absolute;top:1px;width:3px;height:8px;background:#efb9a7}.pixel-body i:first-child{left:-3px}.pixel-body i:last-child{right:-3px}.pixel-legs{position:absolute;z-index:2;left:7px;top:27px;display:flex;gap:3px}.pixel-legs i{width:4px;height:6px;background:#694355;box-shadow:0 2px #4f3541}.sprite-name{position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);white-space:nowrap;padding:1px 4px;border:1px solid rgba(82,43,60,.12);border-radius:999px;background:rgba(255,250,250,.92);color:#6d4052;font-size:5px;font-weight:800}.sprite-wrap.active .sprite-name{background:#7d3152;color:#fff;border-color:#7d3152}@keyframes pixelWalk{0%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-2px) rotate(1deg)}100%{transform:translateY(0) rotate(-1deg)}}@media(prefers-reduced-motion:reduce){.sprite-wrap.moving .pixel-person{animation:none}}
</style>
