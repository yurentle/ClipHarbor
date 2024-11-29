import { create } from 'zustand'

interface ClipboardState {
  clipboardHistory: string[]
  addClipboardItem: (content: string) => void
  removeClipboardItem: (content: string) => void
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  clipboardHistory: [],
  addClipboardItem: (content: string) =>
    set((state) => ({
      clipboardHistory: [content, ...state.clipboardHistory.filter((item) => item !== content)].slice(0, 50),
    })),
  removeClipboardItem: (content: string) =>
    set((state) => ({
      clipboardHistory: state.clipboardHistory.filter((item) => item !== content),
    })),
}))
