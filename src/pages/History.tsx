import { useEffect, useState } from 'react'
import { ActionIcon, Box, Card, Container, Group, ScrollArea, SegmentedControl, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { Copy, Heart, Search, Trash } from 'tabler-icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

// 配置 dayjs
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// 定义剪贴板项的类型
interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'image' | 'file'
  timestamp: number
  favorite: boolean
  metadata?: {
    width?: number
    height?: number
    size?: number
  }
}

type CategoryType = 'all' | 'text' | 'image' | 'file' | 'favorite'

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

function History() {
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState<CategoryType>('all')

  useEffect(() => {
    // 获取历史记录
    window.electronAPI.getClipboardHistory().then((history) => {
      setClipboardHistory(history)
    })

    // 监听剪贴板变化
    const unsubscribe = window.electronAPI.onClipboardChange((content) => {
      setClipboardHistory(prev => [content, ...prev.filter(item => item.content !== content.content)].slice(0, 50))
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleCopy = async (item: ClipboardItem) => {
    await window.electronAPI.saveToClipboard(item)
  }

  const handleRemove = async (id: string) => {
    try {
      await window.electronAPI.removeFromHistory(id)
      setClipboardHistory(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error('Failed to remove from history:', error)
    }
  }

  const handleToggleFavorite = async (id: string) => {
    try {
      await window.electronAPI.toggleFavorite(id)
      setClipboardHistory(prev => prev.map(item =>
        item.id === id ? { ...item, favorite: !item.favorite } : item
      ))
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }

  // 过滤历史记录
  const filteredHistory = clipboardHistory.filter(item => {
    const matchesCategory = category === 'all' || 
                          (category === 'favorite' && item.favorite) || 
                          category === item.type
    const matchesSearch = item.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const renderContent = (item: ClipboardItem) => {
    const timeAgo = dayjs(item.timestamp).fromNow()
    const contentInfo = () => {
      switch (item.type) {
        case 'text':
          return `${item.content.length} 个字符`
        case 'image':
          if (item.metadata?.width && item.metadata?.height && item.metadata?.size) {
            return `${item.metadata.width}x${item.metadata.height} · ${formatFileSize(item.metadata.size)}`
          }
          return '图片'
        case 'file':
          if (item.metadata?.size) {
            return formatFileSize(item.metadata.size)
          }
          return '文件'
      }
    }

    switch (item.type) {
      case 'image':
        return (
          <Box>
            <img src={item.content} alt="Clipboard content" style={{ maxWidth: '100%', maxHeight: '200px' }} />
            <Text size="xs" c="dimmed" mt={4}>
              {timeAgo} · {contentInfo()}
            </Text>
          </Box>
        )
      case 'file':
        return (
          <Box>
            <Group gap="xs">
              <Text size="sm" style={{ wordBreak: 'break-all' }}>{item.content}</Text>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {timeAgo} · {contentInfo()}
            </Text>
          </Box>
        )
      default:
        return (
          <Box>
            <ScrollArea style={{ maxHeight: 200 }}>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {item.content}
              </Text>
            </ScrollArea>
            <Text size="xs" c="dimmed" mt={4}>
              {timeAgo} · {contentInfo()}
            </Text>
          </Box>
        )
    }
  }

  return (
    <Container p="xs" style={{ 
      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
      minHeight: '100vh',
      borderRadius: '10px',
      WebkitAppRegion: 'drag', // 允许拖动窗口
    }}>
      <Stack gap="md">
        <Group justify="space-between" style={{ WebkitAppRegion: 'no-drag' }}> {/* 搜索区域不可拖动 */}
          <TextInput
            placeholder="搜索剪贴板历史..."
            leftSection={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <SegmentedControl
            value={category}
            onChange={(value) => setCategory(value as CategoryType)}
            data={[
              { label: '全部', value: 'all' },
              { label: '文本', value: 'text' },
              { label: '图片', value: 'image' },
              { label: '文件', value: 'file' },
              { label: '收藏', value: 'favorite' },
            ]}
          />
        </Group>
        <ScrollArea h={500}>
          <Stack gap="md" pt={4}>
            {filteredHistory.map((item) => (
              <Card
                key={item.id}
                withBorder
                shadow="sm"
                padding="sm"
                className="card-hover"
                onDoubleClick={() => handleCopy(item)}
                style={{ cursor: 'pointer' }}
              >
                <Group justify="space-between" align="start">
                  <Box style={{ flex: 1 }}>
                    {renderContent(item)}
                  </Box>
                  <Group gap="xs">
                    <Tooltip label={item.favorite ? "取消收藏" : "收藏"}>
                      <ActionIcon
                        variant={item.favorite ? "filled" : "light"}
                        color={item.favorite ? "red" : "gray"}
                        onClick={() => handleToggleFavorite(item.id)}
                        className="action-icon-hover"
                      >
                        <Heart size={16} style={{ fill: item.favorite ? 'white' : 'none' }} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="复制">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => handleCopy(item)}
                        className="action-icon-hover"
                      >
                        <Copy size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="删除">
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleRemove(item.id)}
                        className="action-icon-hover"
                      >
                        <Trash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Container>
  )
}

export default History