import { useEffect, useState, useRef } from 'react'
import { 
  ActionIcon,
  Card, 
  Container, 
  Group,
  SegmentedControl, 
  Stack, 
  Text, 
  TextInput, 
  Tooltip, 
  Image,
  ScrollArea
} from '@mantine/core'
import { Copy, Heart, Search, Trash, Settings } from 'tabler-icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import './history.css'
import { ClipboardItem, CategoryType, Period } from '@types/clipboard'

// 配置 dayjs
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const ITEMS_PER_PAGE = 50;

// 添加 filterByRetentionPeriod 函数
const filterByRetentionPeriod = (items: ClipboardItem[], period: number, unit: string): ClipboardItem[] => {
  if (period <= 0) return items; // 如果保留期限为0或负数，返回所有记录
  
  const now = dayjs();
  const cutoffDate = now.subtract(period, unit as dayjs.ManipulateType);
  
  return items.filter(item => {
    // 收藏的项目不受保留期限限制
    if (item.favorite) return true;
    
    const itemDate = dayjs(item.timestamp);
    return itemDate.isAfter(cutoffDate);
  });
};

function History() {
  const viewport = useRef<HTMLDivElement>(null);
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardItem[]>([])
  const [filteredHistory, setFilteredHistory] = useState<ClipboardItem[]>([])
  const [displayedHistory, setDisplayedHistory] = useState<ClipboardItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState<CategoryType>('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  // 加载更多
  const loadMore = () => {
    const nextPage = page + 1;
    const start = (nextPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const newItems = filteredHistory.slice(start, end);
    
    setDisplayedHistory(prev => [...prev, ...newItems]);
    setPage(nextPage);
    setHasMore(end < filteredHistory.length);
  };

  const handleScroll = (position: {x: number, y: number}) => {
    const { scrollTop, scrollHeight, clientHeight } = viewport.current!;
    // console.log('onscroll', position, {scrollHeight, scrollTop, clientHeight});
    if (scrollHeight - scrollTop - clientHeight < 50) {
      console.log('onreatchbottom');
      if (!hasMore) return;
      loadMore();
    }
  };

  // 过滤历史记录的函数
  const filterHistory = (history: ClipboardItem[], query: string, cat: CategoryType) => {
    let filtered = history;

    // 应用搜索过滤
    if (query) {
      filtered = filtered.filter(item => {
        if (item.type === 'text') {
          return item.content.toLowerCase().includes(query.toLowerCase());
        }
        return false;
      });
    }

    // 应用分类过滤
    if (cat !== 'all') {
      if (cat === 'favorite') {
        filtered = filtered.filter(item => item.favorite);
      } else {
        filtered = filtered.filter(item => item.type === cat);
      }
    }

    return filtered;
  };

  // 更新过滤结果和分页
  const updateFilteredResults = (filtered: ClipboardItem[]) => {
    setFilteredHistory(filtered);
    setPage(1);
    setDisplayedHistory(filtered.slice(0, ITEMS_PER_PAGE));
    setHasMore(filtered.length > ITEMS_PER_PAGE);
  };

  // 处理搜索变化
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    updateFilteredResults(filterHistory(clipboardHistory, query, category));
  };

  // 处理分类变化
  const handleCategoryChange = (cat: CategoryType) => {
    setCategory(cat);
    updateFilteredResults(filterHistory(clipboardHistory, searchQuery, cat));
  };

  // 修改 useEffect 中的初始化逻辑
  useEffect(() => {
    const initialize = async () => {
      try {
        const [history, settings] = await Promise.all([
          window.electronAPI.store.get('clipboardHistory'),
          window.electronAPI.store.get('settings')
        ]);
        
        const initialHistory = history || [];
        // 先按保留期限过滤
        const filteredByPeriod = filterByRetentionPeriod(
          initialHistory,
          settings.retentionPeriod,
          settings.retentionUnit
        );
        
        setClipboardHistory(filteredByPeriod);
        
        // 然后按搜索和分类过滤
        const filtered = filterHistory(filteredByPeriod, searchQuery, category);
        setFilteredHistory(filtered);
        setDisplayedHistory(filtered.slice(0, ITEMS_PER_PAGE));
        setHasMore(filtered.length > ITEMS_PER_PAGE);

        // 监听 store 变化
        const unsubscribe = window.electronAPI.store.onDidChange((data) => {
          if (data.key === 'clipboardHistory' && Array.isArray(data.newValue)) {
            console.log('Clipboard history updated:', data.newValue.length);
            // 同样先按保留期限过滤
            const filteredByPeriod = filterByRetentionPeriod(
              data.newValue,
              settings.retentionPeriod,
              settings.retentionUnit
            );
            
            setClipboardHistory(filteredByPeriod);
            // 然后按搜索和分类过滤
            const filtered = filterHistory(filteredByPeriod, searchQuery, category);
            setFilteredHistory(filtered);
            setDisplayedHistory(filtered.slice(0, ITEMS_PER_PAGE));
            setHasMore(filtered.length > ITEMS_PER_PAGE);
          }
        });

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing:', error);
      }
    };

    initialize();
  }, [searchQuery, category]);

  const handleCopy = async (item: ClipboardItem) => {
    try {
      await window.electronAPI.clipboard.saveToClipboard(item);
      await window.electronAPI.window.closeHistoryWindow();
    } catch (error) {
      console.error('Error saving to clipboard:', error);
    }
  }

  const handleRemove = async (id: string) => {
    console.log('Starting delete operation for id:', id);
    try {
      const success = await window.electronAPI.clipboard.removeFromHistory(id);
      console.log('removeFromHistory result:', success);
      
      if (success) {
        console.log('Updating states after successful deletion');
        setClipboardHistory(prev => {
          console.log('Previous history length:', prev.length);
          const newHistory = prev.filter(item => item.id !== id);
          // 更新过滤后的历史记录
          const filtered = filterHistory(newHistory, searchQuery, category);
          setFilteredHistory(filtered);
          // 更新显示的历史记录
          setDisplayedHistory(filtered.slice(0, ITEMS_PER_PAGE));
          setHasMore(filtered.length > ITEMS_PER_PAGE);
          return newHistory;
        });
      }
    } catch (error) {
      console.error('Error removing from history:', error);
    }
  }

  const handleToggleFavorite = async (id: string) => {
    console.log('Starting toggle favorite for id:', id);
    try {
      const success = await window.electronAPI.clipboard.toggleFavorite(id);
      console.log('toggleFavorite result:', success);
      
      if (success) {
        console.log('Updating states after successful toggle');
        setClipboardHistory(prev => {
          console.log('Previous history length:', prev.length);
          const newHistory = prev.map(item => 
            item.id === id ? { ...item, favorite: !item.favorite } : item
          );
          // 更新过滤后的历史记录
          const filtered = filterHistory(newHistory, searchQuery, category);
          setFilteredHistory(filtered);
          // 更新显示的历史记录
          setDisplayedHistory(filtered.slice(0, ITEMS_PER_PAGE));
          setHasMore(filtered.length > ITEMS_PER_PAGE);
          return newHistory;
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  const handleDoubleClick = async (item: ClipboardItem) => {
    await handleCopy(item);
  }

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
            </Group>
            <Text size="xs" c="dimmed">
              {timeAgo} · 图片 · {item.metadata?.width}x{item.metadata?.height} · {formatBytes(item.metadata?.size || 0)}
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

  // 修改 handleBlur 函数
  const handleBlur = async () => {
    try {
      // 检查 devtools 是否打开
      const isDevToolsOpened = await window.electronAPI.window.isDevToolsOpened();
      if (!isDevToolsOpened) {
        await window.electronAPI.window.closeHistoryWindow();
      }
    } catch (error) {
      console.error('Error handling window blur:', error);
    }
  };

  // 修改 ESC 键处理函数
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      window.electronAPI.window.closeHistoryWindow();
    }
  };

  // 添加键盘事件监听
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, []); // 移除之前的 blur 监听器，合并到这个 useEffect 中

  return (
    <Container
      style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '10px',
        outline: 'none',
        padding: '0'
      }}
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          window.electronAPI.window.closeHistoryWindow();
        }
      }}
    >
      {/* 添加一个div，用于设置拖动区 */}
      <Group py="xs" style={{ WebkitAppRegion: 'drag', cursor: 'move' }} />
      <Group
        justify="space-between"
        px="sm"
        pb="xs"
      >
        <TextInput
          placeholder="搜索剪贴板历史"
          leftSection={<Search size={16} />}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ flex: 1, paddingLeft: '4px' }}
        />
        <SegmentedControl
          value={category}
          onChange={(value) => handleCategoryChange(value as CategoryType)}
          data={[
            { label: '全部', value: 'all' },
            { label: '文本', value: 'text' },
            { label: '图片', value: 'image' },
            { label: '收藏', value: 'favorite' },
          ]}
        />
        <ActionIcon
          variant="light"
          color="gray"
          onClick={async () => {
            console.log('History: Clicking settings button'); // 添加调试日志
            try {
              await window.electronAPI.window.openSettingsWindow();
            } catch (error) {
              console.error('Error opening settings window:', error);
            }
          }}
        >
          <Settings size={16} />
        </ActionIcon>
      </Group>
      <ScrollArea 
        type="always"
        px='sm'
        scrollbars="y"
        viewportRef={viewport}
        onScrollPositionChange={handleScroll}
        style={{ 
          width: '100%',
          WebkitAppRegion: 'no-drag'
        }}
      >
        {displayedHistory.length === 0 ? (
          <Text c="dimmed" ta="center" pt="xl">没有找到相关记录</Text>
        ) : (
          displayedHistory.map((item) => (
            <Card
              key={item.id}
              shadow="sm"
              padding="md"
              radius="md"
              mb={'md'}
              withBorder
              onDoubleClick={() => handleDoubleClick(item)}
              className="history-card"
              styles={{
                root: {
                  overflow: 'visible'
                }
              }}
            >
              <Group 
                justify="space-between" 
                align="start" 
                style={{ height: '100%' }}
              >
                <div
                  style={{ 
                    flex: 1,
                  }}
                >
                  {renderContent(item)}
                </div>
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
      </ScrollArea>
    </Container>
  )
}

export default History