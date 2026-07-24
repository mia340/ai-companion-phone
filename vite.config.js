import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg'],
            manifest: {
                name: '虚拟手机 · AI 陪伴世界',
                short_name: '陪伴世界',
                description: '多角色 AI 陪伴与独立世界模拟 PWA',
                theme_color: '#f7bfd6',
                background_color: '#fff5fa',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                icons: [
                    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
                ]
            }
        })
    ]
});
