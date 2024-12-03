import { useEffect, useState } from 'react'
import { ActionIcon, Box, Card, Container, Group, ScrollArea, SegmentedControl, Stack, Text, TextInput, Tooltip, Image } from '@mantine/core'
import { Copy, Heart, Search, Trash, Folder } from 'tabler-icons-react'
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
    await window.electronAPI.closeHistoryWindow()
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

  const handleDoubleClick = async (item: ClipboardItem) => {
    await handleCopy(item)
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
    
    switch (item.type) {
      case 'text':
        return (
          <Stack gap="xs">
            <Text lineClamp={3} size="sm">
              {item.content}
            </Text>
            <Text size="xs" c="dimmed">
              {timeAgo} · 文本
            </Text>
          </Stack>
        )
      case 'image':
        return (
          <Stack gap="xs">
            <Group align="center">
              <Image 
                src={item.content} 
                alt="Clipboard Image" 
                width={80} 
                height={80} 
                fit="contain" 
                style={{ 
                  borderRadius: '8px', 
                  border: '1px solid var(--mantine-color-gray-2)' 
                }}
              />
              <Stack gap="xs">
                <Text size="xs">
                  {item.metadata?.width}x{item.metadata?.height}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatBytes(item.metadata?.size || 0)}
                </Text>
              </Stack>
            </Group>
            <Text size="xs" c="dimmed">
              {timeAgo} · 图片
            </Text>
          </Stack>
        )
      case 'file':
        return (
          <Stack gap="xs">
            <Group>
              <Folder size={24} />
              <Text lineClamp={2} size="sm">
                {item.content.split(',').map(path => 
                  path.split('/').pop()
                ).join(', ')}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {timeAgo} · 文件 · {item.content.split(',').length} 个
            </Text>
          </Stack>
        )
      default:
        return <Text>未知类型</Text>
    }
  }

  // 辅助函数：格式化文件大小
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Container p="xs" style={{ 
      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '10px',
      WebkitAppRegion: 'drag', // 允许拖动窗口
    }}>
      <Group justify="space-between" mb="md" style={{ WebkitAppRegion: 'no-drag' }}> {/* 搜索区域不可拖动 */}
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
      <Stack 
        gap="xs" 
        style={{ 
          flex: 1, 
          overflowY: 'auto',
          WebkitAppRegion: 'no-drag',
          paddingRight: '8px' // 为滚动条留出空间
        }}
      >
        {filteredHistory.length === 0 ? (
          <Text c="dimmed" ta="center" pt="xl">没有找到相关记录</Text>
        ) : (
          filteredHistory.map((item) => (
            <Card
              key={item.id}
              withBorder
              shadow="sm"
              padding="sm"
              className="card-hover"
              onDoubleClick={() => handleDoubleClick(item)}
              style={{ 
                cursor: 'pointer', 
                width: '100%',
                minHeight: '80px', // 增加最小高度
              }}
            >
              <Group justify="space-between" align="start" style={{ height: '100%' }}>
                <Box 
                  style={{ 
                    flex: 1, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}
                >
                  {renderContent(item)}
                </Box>
                <Group gap="xs" align="start">
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
          ))
        )}
      </Stack>
    </Container>
  )
}

export default History