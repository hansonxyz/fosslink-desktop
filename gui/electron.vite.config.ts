import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __DEV_BUILD__: JSON.stringify(process.env.DEV_BUILD === '1'),
      // Tell ws library to skip native bufferutil/utf-8-validate addons.
      // Vite stubs optional peer deps as empty objects, causing runtime crashes.
      'process.env.WS_NO_BUFFER_UTIL': JSON.stringify('1'),
      'process.env.WS_NO_UTF_8_VALIDATE': JSON.stringify('1')
    },
    resolve: {
      alias: {
        '@daemon': resolve(__dirname, '../src')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [svelte()]
  }
})
