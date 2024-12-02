import { useState, useEffect } from 'react';
import { Tabs, Text, Switch, Box, Stack, Container, TextInput, Button } from '@mantine/core';
import { Settings as SettingsIcon, Keyboard, Photo, InfoCircle } from 'tabler-icons-react';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<string>('shortcuts');
  const [showInDock, setShowInDock] = useState(true);
  const [showInStatusBar, setShowInStatusBar] = useState(true);
  const [shortcut, setShortcut] = useState('');
  console.log('Settings component rendered');
  useEffect(() => {
    // 获取默认快捷键
    window.electronAPI.getDefaultShortcut().then(defaultShortcut => {
      setShortcut(defaultShortcut);
    });
  }, []);

  return (
    <Container size="md" p="md">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value || 'shortcuts')}
        orientation="vertical"
      >
        <Tabs.List>
          <Tabs.Tab value="shortcuts" leftSection={<Keyboard size={16} />}>
            快捷键
          </Tabs.Tab>
          <Tabs.Tab value="appearance" leftSection={<SettingsIcon size={16} />}>
            显示设置
          </Tabs.Tab>
          <Tabs.Tab value="about" leftSection={<InfoCircle size={16} />}>
            关于
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="shortcuts" pl="xl">
          <Stack>
            <Text size="lg" fw={500}>快捷键设置</Text>
            <Box>
              <TextInput
                label="呼出剪贴板历史"
                value={shortcut}
                readOnly
                description="默认快捷键，用于呼出剪贴板历史记录"
              />
            </Box>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="appearance" pl="xl">
          <Stack>
            <Text size="lg" fw={500}>显示设置</Text>
            <Switch
              label="在 Dock 栏显示图标"
              checked={showInDock}
              onChange={(event) => setShowInDock(event.currentTarget.checked)}
            />
            <Switch
              label="在状态栏显示图标"
              checked={showInStatusBar}
              onChange={(event) => setShowInStatusBar(event.currentTarget.checked)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="about" pl="xl">
          <Stack>
            <Text size="lg" fw={500}>关于</Text>
            <Text>版本：1.0.0</Text>
            <Text>
              这是一个便捷的剪贴板历史记录管理工具，支持文本、图片和文件的复制记录，
              并提供快速检索和收藏功能。
            </Text>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
};

export default Settings; 