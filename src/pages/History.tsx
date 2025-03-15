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
import { ClipboardItem, CategoryType, Period } from '../types'

// 配置 dayjs
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const ITEMS_PER_PAGE = 50;

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

  // 根据保存时间过滤历史记录
  const filterByRetentionPeriod = (
    items: ClipboardItem[], 
    period: number, 
    unit: Period
  ) => {
    if (unit === 'permanent') return items;
    
    const now = dayjs();
    const cutoffTime = now.subtract(period, unit).valueOf();
    
    return items.filter(item => 
      item.favorite || item.timestamp >= cutoffTime
    );
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

  // 加载设置并获取历史记录
  useEffect(() => {
    console.log('initialize--useEffect');
    const initialize = async () => {
      try {
        // 首先加载设置
        const period = await window.electronAPI.getStoreValue('retentionPeriod') || 30;
        const unit = (await window.electronAPI.getStoreValue('retentionUnit') || 'days') as Period;

        // 然后获取历史记录
        const history = await window.electronAPI.getClipboardHistory();
        console.log('history', history);
        const filteredByTime = filterByRetentionPeriod(history, period, unit);
        setClipboardHistory(filteredByTime);
        // 初始化过滤后的历史记录
        setFilteredHistory(filteredByTime);
        setDisplayedHistory(filteredByTime.slice(0, ITEMS_PER_PAGE));
        setHasMore(filteredByTime.length > ITEMS_PER_PAGE);

        // 设置剪贴板变化监听器
        const unsubscribe = window.electronAPI.onClipboardChange((newItem) => {
          setClipboardHistory(prev => {
            const newHistory = [newItem, ...prev.filter(item => item.content !== newItem.content)];
            const filtered = filterByRetentionPeriod(newHistory, period, unit);
            // 应用当前的搜索和分类过滤
            const finalFiltered = filterHistory(filtered, searchQuery, category);
            setFilteredHistory(finalFiltered);
            setDisplayedHistory(finalFiltered.slice(0, ITEMS_PER_PAGE));
            setHasMore(finalFiltered.length > ITEMS_PER_PAGE);
            return filtered;
          });
        });

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing:', error);
      }
    };
    
    initialize();
  }, []); 

  const handleCopy = async (item: ClipboardItem) => {
    try {
      await window.electronAPI.saveToClipboard(item);
      await window.electronAPI.closeHistoryWindow();
    } catch (error) {
      console.error('Error saving to clipboard:', error);
    }
  }

  const handleRemove = async (id: string) => {
    try {
      const success = await window.electronAPI.removeFromHistory(id);
      if (success) {
        setClipboardHistory(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Error removing from history:', error);
    }
  }

  const handleToggleFavorite = async (id: string) => {
    try {
      const success = await window.electronAPI.toggleFavorite(id);
      if (success) {
        setClipboardHistory(prev => 
          prev.map(item => 
            item.id === id ? { ...item, favorite: !item.favorite } : item
          )
        );
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
    <Container p="xs" 
      style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '10px',
        WebkitAppRegion: 'drag', // 允许拖动窗口
      }}
    >
      <Group justify="space-between" mb="md" style={{ WebkitAppRegion: 'no-drag' }}> {/* 搜索区域不可拖动 */}
        <TextInput
          placeholder="搜索剪贴板历史..."
          leftSection={<Search size={16} />}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ flex: 1 }}
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
              await window.electronAPI.openSettingsWindow();
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
        scrollbars="y"
        // h={500}
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
                    maxWidth: 400
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