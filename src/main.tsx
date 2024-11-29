import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import { Notifications } from '@mantine/notifications'
import '@mantine/notifications/styles.css'

// 定义全局类型
declare global {
  interface Window {
    electronAPI: {
      onClipboardChange: (callback: (content: string) => void) => void
      getClipboardHistory: () => Promise<string[]>
      saveToClipboard: (text: string) => Promise<boolean>
      removeFromHistory: (text: string) => Promise<boolean>
    }
  }
}

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <Notifications />
      <App />
    </MantineProvider>
  </React.StrictMode>,
)
