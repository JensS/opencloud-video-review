import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/**
 * Custom plugin to inline CSS into the JS bundle.
 * OpenCloud external apps are loaded as a single JS file —
 * separate CSS files won't be loaded automatically.
 */
function cssInjectPlugin(): Plugin {
  return {
    name: 'css-inject',
    enforce: 'post',
    generateBundle(_, bundle) {
      // Collect all CSS
      const cssChunks: string[] = []
      for (const [key, chunk] of Object.entries(bundle)) {
        if (key.endsWith('.css') && chunk.type === 'asset') {
          cssChunks.push(chunk.source as string)
          delete bundle[key]
        }
      }

      if (cssChunks.length === 0) return

      // Inject CSS into JS bundle
      const cssCode = cssChunks.join('\n').replace(/`/g, '\\`').replace(/\\/g, '\\\\')
      const injection = `(function(){var s=document.createElement('style');s.textContent=\`${cssChunks.join('\n').replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`;document.head.appendChild(s)})();\n`

      for (const [, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          chunk.code = injection + chunk.code
          break
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [vue(), cssInjectPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'web-app-video-review',
      // Must use .js — OpenCloud has no MIME mapping for .cjs
      fileName: () => 'web-app-video-review.js',
      formats: ['umd']
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: ['vue', 'vue3-gettext', '@opencloud-eu/web-pkg'],
      output: {
        globals: {
          vue: 'Vue',
          'vue3-gettext': 'vue3Gettext',
          '@opencloud-eu/web-pkg': 'webPkg'
        },
        inlineDynamicImports: true
      }
    }
  }
})
