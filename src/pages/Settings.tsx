import { useState, useEffect, useRef } from 'react';
import { 
  Tabs,
  Text,
  Stack,
  TextInput,
  NumberInput,
  Button,
  Group,
  useMantineTheme,
  Select,
  Code,
  Loader
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Keyboard, 
  InfoCircle,
  BrandGithub,
  History,
  Database,
  CloudUpload,
  Download,
  Refresh
} from 'tabler-icons-react';
import { Period } from '../types/clipboard';
import { v4 as uuidv4 } from 'uuid';
import { modals } from '@mantine/modals';

const Settings = () => {
  const theme = useMantineTheme();
  const [activeTab, setActiveTab] = useState<string>('shortcuts');
  const [shortcut, setShortcut] = useState('');
  const [shortcutError, setShortcutError] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [retentionPeriod, setRetentionPeriod] = useState<number>(30);
  const [retentionUnit, setRetentionUnit] = useState<Period>('days');
  const [rcloneConfig, setRcloneConfig] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncingLocal, setSyncingLocal] = useState(false);
  const [historyFilePath, setHistoryFilePath] = useState('');
  const [version, setVersion] = useState('0.0.0');
  const [currentCommand, setCurrentCommand] = useState('');
  const currentProcessId = useRef<string>('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const defaultShortcut = await window.electronAPI.getStoreValue('shortcut');
        setShortcut(defaultShortcut);
      } catch (error) {
        console.error('Error initializing settings:', error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const loadRetentionSettings = async () => {
      try {
        const period = await window.electronAPI.getStoreValue('retentionPeriod');
        const unit = await window.electronAPI.getStoreValue('retentionUnit');
        if (period !== undefined) setRetentionPeriod(period);
        if (unit !== undefined) setRetentionUnit(unit);
      } catch (error) {
        console.error('Failed to load retention settings:', error);
      }
    };
    loadRetentionSettings();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const config = await window.electronAPI.getStoreValue('rcloneConfig');
        const filePath = await window.electronAPI.getHistoryFilePath();
        if (config) setRcloneConfig(config);
        if (filePath) setHistoryFilePath(filePath);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const getVersion = async () => {
      const ver = await window.electronAPI.getAppVersion();
      setVersion(ver);
    };
    getVersion();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.electronAPI.closeSettingsWindow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 监听同步进度
  useEffect(() => {
    const handleProgress = (_: any, { processId, data }: { processId: string; data: string }) => {
      console.log('同步进度:', processId, data);
      if (processId === currentProcessId.current) {
        setCurrentCommand(prev => {
          // 如果是新的命令执行，清空之前的输出
          if (data.startsWith('正在执行命令:')) {
            return data;
          }
          // 否则追加新的输出
          return prev ? `${prev}\n${data}` : data;
        });
      }
    };

    // 添加事件监听器
    window.electronAPI.ipcRenderer.on('sync-progress', handleProgress);

    // 清理函数
    return () => {
      window.electronAPI.ipcRenderer.removeListener('sync-progress', handleProgress);
    };
  }, []); // 空依赖数组，确保只在组件挂载时添加一次监听器

  const getTabStyle = (tabValue: string) => ({
    width: '100%',
    height: '48px',
    justifyContent: 'flex-start',
    padding: '0 16px',
    backgroundColor: activeTab === tabValue ? 
      theme.colors[theme.primaryColor][6] : 
      'transparent',
    color: activeTab === tabValue ? 
      theme.white : 
      theme.colors.gray[6],
    '&:hover': {
      backgroundColor: activeTab === tabValue ? 
        theme.colors[theme.primaryColor][6] : 
        theme.colors.gray[1]
    }
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    
    // 记录按下的键
    const key = e.key === ' ' ? 'Space' : e.key;
    // 更新显示的快捷键
    const modifiers = [];
    if (e.metaKey) modifiers.push('Command');
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    const displayKey = key.length === 1 ? key.toUpperCase() : key;
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      modifiers.push(displayKey);
    }

    setShortcut(modifiers.join('+'));
  };

  const handleBlur = async () => {
    if (shortcut.split('+').length > 1) {
      try {
        const success = await window.electronAPI.setStoreValue('shortcut', shortcut);
        if (!success) {
          setShortcutError('无效的快捷键组合');
        } else {
          setShortcut(shortcut);
          setShortcutError('');
        }
      } catch (error) {
        console.error('Error saving shortcut:', error);
        setShortcutError('保存快捷键失败');
      }
    } else {
      setShortcutError('请至少设置两个按键的组合');
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    // 记录松开的键
  };

  const handleRetentionChange = async (value: number, unit: Period) => {
    setRetentionPeriod(value);
    setRetentionUnit(unit);
    try {
      await window.electronAPI.setStoreValue('retentionPeriod', value);
      await window.electronAPI.setStoreValue('retentionUnit', unit);
    } catch (error) {
      console.error('Failed to save retention settings:', error);
    }
  };

  // 添加一个函数来检查是否有同步任务在执行
  const isSyncing = syncing || syncingLocal;

  const handleSyncToCloud = async () => {
    // 如果已经有同步任务在执行，直接返回
    if (isSyncing) {
      notifications.show({
        title: '操作失败',
        message: '已有同步任务在执行中',
        color: 'red'
      });
      return;
    }

    if (!rcloneConfig) {
      notifications.show({
        title: '同步失败',
        message: '请先配置 Rclone',
        color: 'red'
      });
      return;
    }

    try {
      // 如果已经在同步中，先取消之前的同步
      if (currentProcessId.current) {
        await window.electronAPI.cancelSync(currentProcessId.current);
        // 等待一小段时间确保之前的进程被清理
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setSyncing(true);
      setCurrentCommand(''); // 清空之前的命令输出
      const processId = uuidv4();
      currentProcessId.current = processId;
      await window.electronAPI.syncData(rcloneConfig, processId);
      notifications.show({
        title: '同步成功',
        message: '数据已成功同步到云端',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: '同步失败',
        message: error.message,
        color: 'red',
      });
    } finally {
      setSyncing(false);
      currentProcessId.current = '';
    }
  };

  const handleSyncToLocal = async () => {
    // 如果已经有同步任务在执行，直接返回
    if (isSyncing) {
      notifications.show({
        title: '操作失败',
        message: '已有同步任务在执行中',
        color: 'red'
      });
      return;
    }

    if (!rcloneConfig) {
      notifications.show({
        title: '同步失败',
        message: '请先配置 Rclone',
        color: 'red'
      });
      return;
    }

    try {
      // 如果已经在同步中，先取消之前的同步
      if (currentProcessId.current) {
        await window.electronAPI.cancelSync(currentProcessId.current);
      }

      setSyncingLocal(true);
      setCurrentCommand(''); // 清空之前的命令输出
      const processId = uuidv4();
      currentProcessId.current = processId;
      await window.electronAPI.syncDataFromCloud(rcloneConfig, processId);
      notifications.show({
        title: '同步成功',
        message: '云端数据已成功同步到本地',
        color: 'green'
      });
    } catch (error: any) {
      notifications.show({
        title: '同步失败',
        message: error.message || '同步数据时发生错误',
        color: 'red'
      });
    } finally {
      setSyncingLocal(false);
      currentProcessId.current = '';
    }
  };

  const handleCancelSync = async () => {
    if (currentProcessId.current) {
      try {
        await window.electronAPI.cancelSync(currentProcessId.current);
        // 不再在这里添加取消消息，因为主进程会发送取消消息
      } finally {
        setSyncing(false);
        setSyncingLocal(false);
        currentProcessId.current = '';
      }
    }
  };

  const handleCheckUpdate = async () => {
    try {
      setCheckingUpdate(true);
      const result = await window.electronAPI.checkForUpdates()
      if (result.hasUpdate) {
        // 显示更新信息弹窗
        modals.open({
          title: '发现新版本',
          size: 'md',
          children: (
            <Stack>
              <Text size="lg" fw={500}>v{result.version}</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {result.releaseNotes}
              </Text>
              <Group justify="flex-end">
                <Button
                  variant="light"
                  onClick={() => {
                    window.electronAPI.openExternal(result.downloadUrl!);
                    modals.closeAll();
                  }}
                >
                  前往下载
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={() => modals.closeAll()}
                >
                  稍后再说
                </Button>
              </Group>
            </Stack>
          )
        });
      } else {
        notifications.show({
          title: '检查更新',
          message: '当前已是最新版本',
          color: 'green'
        });
      }
    } catch (error: any) {
      console.error('更新检查失败:', error);  // 添加详细的错误日志
      notifications.show({
        title: '检查更新失败',
        message: error.message || '未知错误',  // 添加默认错误消息
        color: 'red'
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <Tabs 
      value={activeTab} 
      onChange={(value) => setActiveTab(value || 'shortcuts')}
      orientation="vertical"
      style={{
        flex: 1, 
        display: 'flex', 
        overflow: 'hidden' 
      }}
    >
      <Tabs.List 
        style={{ 
          width: '130px', 
          borderRight: `1px solid ${theme.colors.gray[3]}`,
          padding: '8px 0 0 8px'
        }}
      >
        <Tabs.Tab 
          value="shortcuts" 
          leftSection={<Keyboard size={20} />}
          styles={{ tab: getTabStyle('shortcuts') }}
        >
          快捷键
        </Tabs.Tab>
        <Tabs.Tab 
          value="history" 
          leftSection={<History size={20} />}
          styles={{ tab: getTabStyle('history') }}
        >
          历史记录
        </Tabs.Tab>
        <Tabs.Tab 
          value="storage" 
          leftSection={<Database size={20} />}
          styles={{ tab: getTabStyle('storage') }}
        >
          数据存储
        </Tabs.Tab>
        <Tabs.Tab 
          value="about" 
          leftSection={<InfoCircle size={20} />}
          styles={{ tab: getTabStyle('about') }}
        >
          关于
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel 
        value="shortcuts" 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '16px' 
        }}
      >
        <Stack>
          <Text fw={500}>快捷键设置</Text>
          <TextInput
            label=""
            placeholder={isInputFocused ? '请按下快捷键组合...' : '点击此处设置快捷键'}
            value={shortcut}
            error={shortcutError}
            onFocus={() => setIsInputFocused(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            readOnly
            style={{ maxWidth: '400px' }}
          />
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel 
        value="history" 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '16px' 
        }}
      >
        <Stack>
          <Text fw={500}>保留时长设置</Text>
          <Group>
            {retentionUnit !== 'permanent' && (
              <NumberInput
                style={{ width: 100 }}
                value={retentionPeriod}
                allowNegative={false}
                allowDecimal={false}
                onChange={(value) => handleRetentionChange(value as number, retentionUnit)}
                min={0}
              />
            )}
            <Select
              style={{ width: 120 }}
              value={retentionUnit}
              onChange={(value) => {
                handleRetentionChange(value === 'permanent' ? 0 : retentionPeriod, value as Period);
              }}
              data={[
                { value: 'days', label: '天' },
                { value: 'months', label: '月' },
                { value: 'years', label: '年' },
                { value: 'permanent', label: '永久' }
              ]}
            />
          </Group>
          <Text size="xs" color="dimmed">
            设置为0或选择永久将永久保存历史记录
          </Text>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel 
        value="storage" 
        style={{ 
          flex: 1,
          height: '100vh',
          overflowY: 'auto', 
          padding: '16px' 
        }}
      >
        <Stack>
          <Text fw={500}>数据存储设置</Text>
          <Group>
            <Text size="sm">本地数据存储位置</Text>
            <Button 
              variant="subtle" 
              size="xs" 
              onClick={() => window.electronAPI.openStoreDirectory()}
            >
              .../
              {historyFilePath.split('/').slice(-2).join('/')}
            </Button>
          </Group>
          <Text fw={500}>Rclone 配置</Text>
          <TextInput
            placeholder="请输入 rclone 配置，例如：remote:history"
            value={rcloneConfig}
            onChange={(e) => setRcloneConfig(e.target.value)}
          />
          <Group>
            {currentCommand && (
              <Code block style={{ 
                maxHeight: '200px', 
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                width: '100%'
              }}>
                {currentCommand}
              </Code>
            )}
            <Button
              leftSection={syncing ? (
                <Loader size="xs" color="red" type="dots" />
              ) : (
                <CloudUpload size={16} />
              )}
              onClick={syncing ? handleCancelSync : handleSyncToCloud}
              variant="light"
              color={syncing ? 'red' : 'blue'}
              disabled={!syncing && syncingLocal}
            >
              {syncing ? '取消同步' : '同步到云端'}
            </Button>
            <Button
              leftSection={syncingLocal ? (
                <Loader size="xs" color="red" type="dots" />
              ) : (
                <Download size={16} />
              )}
              onClick={syncingLocal ? handleCancelSync : handleSyncToLocal}
              variant="light"
              color={syncingLocal ? 'red' : 'blue'}
              disabled={!syncingLocal && syncing}
            >
              {syncingLocal ? '取消同步' : '同步到本地'}
            </Button>
          </Group>
          <Text size="xs" color="dimmed">
            使用 rclone 同步剪贴板历史到云存储或从云存储同步到本地。请确保已安装 rclone 并正确配置了远程存储。
          </Text>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel 
        value="about" 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '16px' 
        }}
      >
        <Stack>
          <Text fw={500}>关于应用</Text>
          <Group>
            <Text>版本：{version}</Text>
            <Button
              variant="light"
              size="xs"
              leftSection={<Refresh size={16} />}
              onClick={handleCheckUpdate}
              loading={checkingUpdate}
            >
              检查更新
            </Button>
          </Group>
          <Text c="dimmed">
            这是一个便捷的剪贴板历史记录管理工具，支持文本、图片的复制记录，
            并提供快速检索和收藏功能。
            支持 rclone 同步到云端和从云端同步到本地。
          </Text>
          
          <Group mt="md">
            <Button 
              variant="light" 
              leftSection={<BrandGithub size={16} />}
              onClick={(e) => {
                e.preventDefault();
                window.electronAPI.openExternal("https://github.com/yurentle/ClipHarbor");
              }}
            >
              GitHub
            </Button>
          </Group>
        </Stack>
      </Tabs.Panel>
    </Tabs>
  );
};

export default Settings;