import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

// 复制图标文件到 dist 目录
function copyIcons() {
  const srcDir = resolve(__dirname, 'public/icons')
  const destDir = resolve(__dirname, 'dist/icons')
  
  try {
    mkdirSync(destDir, { recursive: true })
    copyFileSync(
      resolve(srcDir, 'logo_tray_Template@2x.png'),
      resolve(destDir, 'logo_tray_Template@2x.png')
    )
  } catch (error) {
    console.error('Error copying icons:', error)
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      entry: [
        'electron/main.ts',
        'electron/preload.ts'
      ]
    }),
    {
      name: 'copy-icons',
      buildEnd() {
        copyIcons()
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
    },
  },
})
