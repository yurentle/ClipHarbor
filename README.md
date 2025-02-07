<div align="center">

# ClipHarbor

<img src="public/logo_dock.png" alt="ClipHarbor Logo" width="128" height="128">

[![GitHub release](https://img.shields.io/github/v/release/yurentle/ClipHarbor)](https://github.com/yurentle/ClipHarbor/releases)
[![GitHub stars](https://img.shields.io/github/stars/yurentle/ClipHarbor)](https://github.com/yurentle/ClipHarbor/stargazers)

现代化的跨平台剪贴板管理工具

[English](./README_EN.md) | 简体中文

</div>

## ✨ 特性

- 🔄 **智能剪贴板历史**: 自动保存和管理剪贴板历史，支持文本、图片和文件
- 🎯 **快速搜索**: 强大的搜索功能，快速定位历史记录
- ⌨️ **快捷键支持**: 自定义快捷键，快速访问剪贴板历史
- 🎨 **现代化界面**: 基于 Mantine UI 的美观界面，支持亮暗主题
- 🔒 **隐私保护**: 本地存储，数据安全有保障
- 🌍 **跨平台支持**: 支持 macOS、Windows 和 Linux

## 📦 安装

### 下载安装包

访问 [GitHub Releases](https://github.com/yurentle/ClipHarbor/releases) 下载最新版本：

- **macOS**: `.dmg` (Intel/Apple Silicon)
- **Windows**: `.exe` (安装版) 或 `.zip` (便携版)
- **Linux**: `.AppImage` 或 `.deb`

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/yurentle/ClipHarbor.git
cd ClipHarbor

# 安装依赖
pnpm install

# 开发模式运行
pnpm dev

# 构建应用
pnpm build
```

## 🚀 使用方法

1. **启动应用**: 安装后启动应用，它会在系统托盘中显示图标
2. **复制内容**: 正常使用系统复制功能 (Ctrl+C/Command+C)
3. **查看历史**: 
   - 点击托盘图标打开主界面
   - 使用快捷键打开主界面（默认为 `Alt+Space`）
4. **搜索内容**: 在搜索框输入关键词快速查找
5. **使用内容**: 点击历史记录或使用快捷键快速粘贴

## ⚙️ 配置选项

- **常规设置**:
  - 开机自启动
  - 显示/隐藏托盘图标
  - 自定义快捷键
- **历史记录**:
  - 设置最大保存数量
  - 清空历史记录
  - 导出/导入数据
- **外观**:
  - 切换暗色/亮色主题
  - 自定义界面布局

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！请查看我们的[贡献指南](CONTRIBUTING.md)。

## 📄 开源协议

ClipHarbor 使用 MIT 协议。

