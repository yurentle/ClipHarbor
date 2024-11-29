import { useEffect, useState } from 'react'
import { ActionIcon, AppShell, Box, Card, Container, Group, ScrollArea, SegmentedControl, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { Copy, File, Heart, Photo, Search, Trash } from 'tabler-icons-react'

// 定义剪贴板项的类型
interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'image' | 'file'
  timestamp: number
  favorite: boolean
}

type CategoryType = 'all' | 'text' | 'image' | 'file' | 'favorite'

function App() {
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
  const filteredHistory = clipboardHistory
    .filter(item => {
      // 先按分类过滤
      if (category === 'all') return true
      if (category === 'favorite') return item.favorite
      return item.type === category
    })
    .filter(item => {
      // 再按搜索词过滤
      if (!searchQuery) return true
      return item.content.toLowerCase().includes(searchQuery.toLowerCase())
    })

  const renderContent = (item: ClipboardItem) => {
    switch (item.type) {
      case 'image':
        return <img src={item.content} alt="Clipboard content" style={{ maxWidth: '100%', maxHeight: '200px' }} />
      case 'file':
        return (
          <Group gap="xs">
            <File size={16} />
            <Text size="sm" style={{ wordBreak: 'break-all' }}>{item.content}</Text>
          </Group>
        )
      default:
        return (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {item.content}
          </Text>
        )
    }
  }
console.log(filteredHistory)
  return (
    <AppShell>
      <Container size="md" py="xl">
        <Stack gap="lg">
          <Group>
            <TextInput
              placeholder="搜索剪贴板历史..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              leftSection={<Search size={16} />}
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
            <Stack gap="md">
              {filteredHistory.map((item) => (
                <Card key={item.id} withBorder shadow="sm" padding="sm">
                  <Group justify="space-between" align="start">
                    <Box style={{ flex: 1 }}>
                      {renderContent(item)}
                    </Box>
                    <Group gap="xs">
                      <Tooltip key={`favorite-${item.id}`} label={item.favorite ? "取消收藏" : "收藏"}>
                        <ActionIcon
                          variant="filled"
                          color={item.favorite ? "red" : "gray"}
                          onClick={() => handleToggleFavorite(item.id)}
                        >
                          <Heart size={16} style={{ fill: item.favorite ? 'white' : 'none' }} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip key={`copy-${item.id}`} label="复制">
                        <ActionIcon variant="light" color="blue" onClick={() => handleCopy(item)}>
                          <Copy size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip key={`delete-${item.id}`} label="删除">
                        <ActionIcon variant="light" color="red" onClick={() => handleRemove(item.id)}>
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
    </AppShell>
  )
}

export default App
