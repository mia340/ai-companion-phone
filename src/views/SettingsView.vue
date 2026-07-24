<script setup lang="ts">
import PhoneFrame from '../components/PhoneFrame.vue'
const sections=[['🎨','外观设置','壁纸、图标、布局与聊天气泡'],['🔤','字体设置','系统字体与字号'],['🤖','API 与模型','供应商、API 地址、模型路由'],['🔐','自主权限','自动执行、事后告知、事前确认、禁止'],['💾','数据与备份','导出、导入、清除与回收站'],['ℹ️','关于','角色由 AI 驱动；当前为 V0 原型']]
</script>
<template><PhoneFrame title="设置" show-back><section class="list-page"><button v-for="item in sections" :key="item[1]" class="setting-row"><span>{{ item[0] }}</span><span><b>{{ item[1] }}</b><small>{{ item[2] }}</small></span><span>›</span></button><div class="ai-notice"><b>AI 身份说明</b><p>本产品中的角色由 AI 模型驱动。心情与“此时在想什么”属于面向用户生成的角色表现，不是模型内部推理。</p></div></section></PhoneFrame></template>
