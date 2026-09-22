import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ai-companion-phone/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      manifest: {
        name: '虚拟手机 · AI 陪伴世界',
        short_name: '陪伴世界',
        description: '多角色 AI 陪伴与独立世界模拟 PWA',
        theme_color: '#26345f',
        background_color: '#1d2b55',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/ai-companion-phone/',
        scope: '/ai-companion-phone/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
