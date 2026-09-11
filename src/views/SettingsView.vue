<script setup lang="ts">
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'

const router = useRouter()

interface SettingItem {
  icon: string
  tone: string
  title: string
  description: string
  path?: string
  value?: string
}

interface SettingSection {
  label: string
  items: SettingItem[]
}

const sections: SettingSection[] = [
  {
    label: '体验',
    items: [
      { icon: '◐', tone: 'blue', title: '外观设置', description: '壁纸、图标、布局与聊天气泡' },
      { icon: 'Aa', tone: 'cyan', title: '字体设置', description: '系统字体与字号' }
    ]
  },
  {
    label: '角色与世界',
    items: [
      { icon: '人', tone: 'violet', title: '用户人设 Persona', description: '为不同世界和剧情建立自己的身份', path: '/settings/personas' },
      { icon: '书', tone: 'green', title: '世界书 Lorebook', description: '人物、地点、规则与关键词触发', path: '/world?tab=lorebooks' },
      { icon: '权', tone: 'orange', title: '自主权限', description: '控制角色能自动执行哪些动作' }
    ]
  },
  {
    label: 'AI 与数据',
    items: [
      { icon: 'AI', tone: 'blue', title: 'API 与模型', description: '供应商、模型、图片理解与生成参数', path: '/settings/models' },
      { icon: '↕', tone: 'cyan', title: '数据与备份', description: '导出、导入与跨浏览器迁移', path: '/backup' }
    ]
  },
  {
    label: '关于',
    items: [
      { icon: 'i', tone: 'gray', title: 'AI Companion Phone', description: '本地优先的 AI 陪伴手机', value: '0.5.0-alpha.3.4.1' }
    ]
  }
]

function openSection(path?: string) {
  if (path) router.push(path)
}
</script>

<template>
  <PhoneFrame title="设置" show-back>
    <section class="settings-page">
      <section v-for="section in sections" :key="section.label" class="setting-section">
        <p class="section-label">{{ section.label }}</p>
        <div class="setting-group">
          <button
            v-for="item in section.items"
            :key="item.title"
            class="setting-row"
            type="button"
            :class="{ 'setting-row--static': !item.path }"
            @click="openSection(item.path)"
          >
            <span class="setting-icon" :class="`tone-${item.tone}`">{{ item.icon }}</span>
            <span class="setting-copy">
              <b>{{ item.title }}</b>
              <small>{{ item.description }}</small>
            </span>
            <span v-if="item.value" class="setting-value">{{ item.value }}</span>
            <span v-else-if="item.path" class="row-arrow">›</span>
          </button>
        </div>
      </section>

      <div class="ai-notice">
        <span>AI</span>
        <p>角色由 AI 模型驱动。心情、状态和“此时在想什么”是面向用户的角色表现，不等同于模型内部推理。</p>
      </div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.settings-page {
  min-height: 100%;
  padding: 8px 14px 40px;
  background: #f4f8fb;
}

.setting-section + .setting-section {
  margin-top: 18px;
}

.section-label {
  margin: 0 2px 7px;
  color: #7f91a0;
  font-size: 12px;
}

.setting-group {
  overflow: hidden;
  border: 1px solid rgba(45, 67, 85, .07);
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(47, 76, 101, .035);
}

.setting-row {
  position: relative;
  width: 100%;
  min-height: 62px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 0;
  background: #fff;
  color: inherit;
  text-align: left;
}

.setting-row::after {
  content: '';
  position: absolute;
  left: 58px;
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(45, 67, 85, .08);
}

.setting-row:last-child::after {
  display: none;
}

.setting-row:not(.setting-row--static):active {
  background: #eef4f8;
}

.setting-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: #fff;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: -.02em;
}

.tone-blue { background: #68a9d8; }
.tone-cyan { background: #63b6c9; }
.tone-violet { background: #8f8bd8; }
.tone-green { background: #69b78a; }
.tone-orange { background: #e2a45f; }
.tone-gray { background: #8798a7; }

.setting-copy {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 3px;
}

.setting-copy b {
  color: #253c4f;
  font-size: 15px;
  font-weight: 600;
}

.setting-copy small {
  overflow: hidden;
  color: #8293a1;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-value {
  max-width: 115px;
  color: #9aa8b3;
  font-size: 11px;
  text-align: right;
}

.row-arrow {
  color: #b4c0c9;
  font-size: 24px;
  font-weight: 300;
}

.ai-notice {
  margin: 20px 4px 0;
  padding: 0;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  background: transparent;
  color: #7d8f9f;
}

.ai-notice > span {
  min-width: 26px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: #dcecf7;
  color: #5b8fb4;
  font-size: 10px;
  font-weight: 800;
}

.ai-notice p {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
}
</style>
