<script setup lang="ts">
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'

const router = useRouter()

const sections = [
  {
    icon: '🎨',
    title: '外观设置',
    description: '壁纸、图标、布局与聊天气泡'
  },
  {
    icon: '🔤',
    title: '字体设置',
    description: '系统字体与字号'
  },
  {
    icon: '🎭',
    title: '用户人设 Persona',
    description: '为不同世界和剧情建立自己的身份',
    path: '/settings/personas'
  },
  {
    icon: '📚',
    title: '世界书 Lorebook',
    description: '按关键词触发人物、地点和世界设定',
    path: '/world?tab=lorebooks'
  },
  {
    icon: '🤖',
    title: 'API 与模型',
    description: '供应商、图片理解、模型和生成参数',
    path: '/settings/models'
  },
  {
    icon: '🔐',
    title: '自主权限',
    description: '自动执行、事后告知、事前确认、禁止'
  },
  {
    icon: '💾',
    title: '数据与备份',
    description: '导出、导入与跨浏览器迁移',
    path: '/backup'
  },
  {
    icon: 'ℹ️',
    title: '关于',
    description: '角色由 AI 驱动；当前为 V0.4.1 角色互动原型'
  }
]

function openSection(path?: string) {
  if (path) {
    router.push(path)
  }
}
</script>

<template>
  <PhoneFrame title="设置" show-back>
    <section class="list-page">
      <button
        v-for="item in sections"
        :key="item.title"
        class="setting-row"
        type="button"
        @click="openSection(item.path)"
      >
        <span>{{ item.icon }}</span>

        <span>
          <b>{{ item.title }}</b>
          <small>{{ item.description }}</small>
        </span>

        <span>{{ item.path ? '›' : '·' }}</span>
      </button>

      <div class="ai-notice">
        <b>AI 身份说明</b>
        <p>
          本产品中的角色由 AI 模型驱动。心情与“此时在想什么”属于面向用户生成的角色表现，不是模型内部推理。
        </p>
      </div>
    </section>
  </PhoneFrame>
</template>
