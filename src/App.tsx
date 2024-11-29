import { useEffect, useState } from 'react'
import { ActionIcon, AppShell, Box, Card, Container, Group, ScrollArea, Stack, Text, Title, Tooltip } from '@mantine/core'
import { Copy, Trash } from 'tabler-icons-react'

function App() {
  const [clipboardHistory, setClipboardHistory] = useState<string[]>([])

  useEffect(() => {
    // 获取历史记录
    window.electronAPI.getClipboardHistory().then((history) => {
      setClipboardHistory(history)
    })

    // 监听剪贴板变化
    const unsubscribe = window.electronAPI.onClipboardChange((content) => {
      setClipboardHistory(prev => [content, ...prev.filter(item => item !== content)].slice(0, 50))
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleCopy = async (text: string) => {
    await window.electronAPI.saveToClipboard(text)
  }

  const handleRemove = async (text: string) => {
    try {
      await window.electronAPI.removeFromHistory(text)
      // 状态更新会通过 onClipboardChange 事件处理
    } catch (error) {
      console.error('Failed to remove from history:', error)
    }
  }

  return (
    <AppShell>
      <Container size="md" py="xl">
        <Stack gap="lg">
          {/* <Title order={2}>剪贴板历史</Title> */}
          <ScrollArea h={500}>
            <Stack gap="md">
              {clipboardHistory.map((item, index) => (
                <Card key={index} withBorder shadow="sm" padding="sm">
                  <Group justify="space-between" align="start">
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {item}
                      </Text>
                    </Box>
                    <Group gap="xs">
                      <Tooltip label="复制">
                        <ActionIcon variant="light" color="blue" onClick={() => handleCopy(item)}>
                          <Copy size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="删除">
                        <ActionIcon variant="light" color="red" onClick={() => handleRemove(item)}>
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
