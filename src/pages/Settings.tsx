import { useState, useEffect } from 'react';
import { 
  Tabs, 
  Text, 
  Switch, 
  Stack, 
  Container, 
  TextInput, 
  Button, 
  Group, 
  Paper, 
  useMantineTheme
} from '@mantine/core';
import { 
  Settings as SettingsIcon, 
  Keyboard, 
  InfoCircle,
  BrandGithub,
  Mail,
  BrandTwitter
} from 'tabler-icons-react';

const Settings = () => {
  const theme = useMantineTheme();
  const [activeTab, setActiveTab] = useState<string>('shortcuts');
  const [showInDock, setShowInDock] = useState(true);
  const [showInStatusBar, setShowInStatusBar] = useState(true);
  const [shortcut, setShortcut] = useState('');

  useEffect(() => {
    window.electronAPI.getDefaultShortcut().then(defaultShortcut => {
      setShortcut(defaultShortcut);
    });
  }, []);

  const getTabStyle = (tabValue: string) => ({
    width: '100%',
    height: '48px',
    justifyContent: 'flex-start',
    padding: '0 16px',
    backgroundColor: activeTab === tabValue
      ? (theme.colorScheme === 'dark'
          ? theme.colors.dark[5]
          : theme.colors.gray[1])
      : 'transparent',
    color: activeTab === tabValue
      ? (theme.colorScheme === 'dark'
          ? theme.white
          : theme.colors.dark[9])
      : theme.colorScheme === 'dark'
        ? theme.colors.dark[1]
        : theme.colors.gray[7],
    '&:hover': {
      backgroundColor: theme.colorScheme === 'dark'
        ? theme.colors.dark[6]
        : theme.colors.gray[2]
    }
  });

  return (
    <div style={{ 
      height: '100vh', 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
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
            borderRight: `1px solid ${
              theme.colorScheme === 'dark' 
                ? theme.colors.dark[5] 
                : theme.colors.gray[3]
            }`,
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
            <Text fw={500}>快捷键设置</Text>
            <TextInput
              label="呼出剪贴板历史"
              value={shortcut}
              readOnly
              description="默认快捷键，用于呼出剪贴板历史记录"
              variant="filled"
            />
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
            <Text fw={500}>显示设置</Text>
            <Switch
              label="在 Dock 栏显示图标"
              checked={showInDock}
              onChange={(event) => setShowInDock(event.currentTarget.checked)}
              color="blue"
            />
            <Switch
              label="在状态栏显示图标"
              checked={showInStatusBar}
              onChange={(event) => setShowInStatusBar(event.currentTarget.checked)}
              color="blue"
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
                href="https://github.com/yourusername/clipboard-manager"
                target="_blank"
              >
                GitHub
              </Button>
              <Button 
                variant="light" 
                leftSection={<Mail size={16} />}
                component="a"
                href="mailto:support@clipboardmanager.com"
              >
                联系我们
              </Button>
              <Button 
                variant="light" 
                leftSection={<BrandTwitter size={16} />}
                component="a"
                href="https://twitter.com/yourusername"
                target="_blank"
              >
                Twitter
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default Settings;