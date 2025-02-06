export interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'image'
  timestamp: number
  favorite: boolean
  metadata?: {
    width?: number
    height?: number
    size?: number
  }
}

export type CategoryType = 'all' | 'text' | 'image' | 'favorite'
export type Period = 'days' | 'months' | 'years' | 'permanent'
