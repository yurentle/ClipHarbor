import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'fs'

function copyIcons() {
  const srcDir = resolve('resources/icons')
  const destDir = resolve('dist/renderer/icons')
  
  try {
    mkdirSync(destDir, { recursive: true })
    copyFileSync(
      resolve(srcDir, 'logo_tray_Template@2x.png'),
      resolve(destDir, 'logo_tray_Template@2x.png')
    )
    copyFileSync(
      resolve(srcDir, 'logo_dock.png'),
      resolve(destDir, 'logo_dock.png')
    )
    console.log('Icons copied successfully')
  } catch (error) {
    console.error('Error copying icons:', error)
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@types': resolve('src/types')
      }
    },
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: {
          main: resolve('src/main/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload')
      }
    },
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: {
          preload: resolve('src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@types': resolve('src/types')
      }
    },
    plugins: [
      react(),
      {
        name: 'copy-icons',
        buildEnd() {
          copyIcons()
        }
      }
    ],
    build: {
      outDir: 'dist/renderer'
    },
    server: {
      port: 5173,
      strictPort: true,
      host: true
    }
  }
}) 