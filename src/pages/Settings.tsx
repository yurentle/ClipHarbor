import { useState, useEffect } from 'react';
import { 
  Tabs,
  Text,
  Switch,
  Stack,
  TextInput,
  NumberInput,
  Button,
  Group,
  useMantineTheme,
  Select
} from '@mantine/core';
import { 
  Settings as SettingsIcon, 
  Keyboard, 
  InfoCircle,
  BrandGithub,
  Mail,
  History
} from 'tabler-icons-react';

type Period = 'days' | 'months' | 'years' | 'permanent';

const Settings = () => {
  const theme = useMantineTheme();
  const [activeTab, setActiveTab] = useState<string>('shortcuts');
  const [showDockIcon, setShowDockIcon] = useState(true);
  const [showTrayIcon, setShowTrayIcon] = useState(true);
  const [shortcut, setShortcut] = useState('');
  const [shortcutError, setShortcutError] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [retentionPeriod, setRetentionPeriod] = useState<number>(30);
  const [retentionUnit, setRetentionUnit] = useState<'days' | 'months' | 'years' | 'permanent'>('days');

  useEffect(() => {
    const init = async () => {
      try {
        const defaultShortcut = await window.electronAPI.getShortcut();
        setShortcut(defaultShortcut);
      } catch (error) {
        console.error('Error initializing settings:', error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    // Load saved retention settings
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
    // 当输入框失去焦点时设置新的快捷键
    if (shortcut.split('+').length > 1) {
      try {
        const success = await window.electronAPI.setShortcut(shortcut);
        if (!success) {
          setShortcutError('无效的快捷键组合');
        } else {
          setShortcut(shortcut); // 更新显示的快捷键
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

  const handleDockIconToggle = async (checked: boolean) => {
    try {
      const result = await window.electronAPI.toggleDockIcon(checked);
      setShowDockIcon(result);
    } catch (error) {
      console.error('Error toggling dock icon:', error);
    }
  };

  const handleTrayIconToggle = async (checked: boolean) => {
    try {
      const result = await window.electronAPI.toggleTrayIcon(checked);
      setShowTrayIcon(result);
    } catch (error) {
      console.error('Error toggling tray icon:', error);
    }
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

  return (
    <div style={{ height: '100vh', padding: '20px' }}>
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
            width: '200px', 
            borderRight: `1px solid ${theme.colors.gray[3]}`,
            padding: '8px 0'
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
            value="appearance" 
            leftSection={<SettingsIcon size={20} />}
            styles={{ tab: getTabStyle('appearance') }}
          >
            显示设置
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
            <Text size="lg">快捷键设置</Text>
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
            <Text size="sm">保留时长设置</Text>
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
          value="appearance" 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '16px' 
          }}
        >
          <Stack>
            <Text size="lg">显示设置</Text>
            <Switch
              label="在 Dock 栏显示图标"
              checked={showDockIcon}
              onChange={(event) => handleDockIconToggle(event.currentTarget.checked)}
            />
            <Switch
              label="在状态栏显示图标"
              checked={showTrayIcon}
              onChange={(event) => handleTrayIconToggle(event.currentTarget.checked)}
            />
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
            <Text>版本：1.0.0</Text>
            <Text c="dimmed">
              这是一个便捷的剪贴板历史记录管理工具，支持文本、图片和文件的复制记录，
              并提供快速检索和收藏功能。
            </Text>
            
            <Group mt="md">
              <Button 
                variant="light" 
                leftSection={<BrandGithub size={16} />}
                component="a"
                href="https://github.com/yurentle/ClipHarbor"
                target="_blank"
              >
                GitHub
              </Button>
              <Button 
                variant="light" 
                leftSection={<Mail size={16} />}
                component="a"
                href="mailto:yurentle@gmail.com"
              >
                联系我们
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default Settings;