import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'web-app-video-review',
      fileName: 'web-app-video-review'
    },
    rollupOptions: {
      external: ['vue', 'vue3-gettext', '@opencloud-eu/web-pkg'],
      output: {
        globals: {
          vue: 'Vue',
          'vue3-gettext': 'vue3Gettext',
          '@opencloud-eu/web-pkg': 'webPkg'
        }
      }
    }
  }
})
