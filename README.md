<div align="center">

# ClipHarbor

<img src="resources/icons/logo_dock.png" alt="ClipHarbor Logo" width="128" height="128">

[![GitHub release](https://img.shields.io/github/v/release/yurentle/ClipHarbor)](https://github.com/yurentle/ClipHarbor/releases)
[![GitHub stars](https://img.shields.io/github/stars/yurentle/ClipHarbor)](https://github.com/yurentle/ClipHarbor/stargazers)

现代化的跨平台剪贴板管理工具

[English](./README_EN.md) | 简体中文

</div>

## ✨ 特性

- 🔄 **智能剪贴板历史**: 自动保存和管理剪贴板历史，支持文本、图片
- 🎯 **快速搜索**: 强大的搜索功能，快速定位历史记录
- ⌨️ **快捷键支持**: 自定义快捷键，快速访问剪贴板历史
- 🎨 **现代化界面**: 基于 Mantine UI 的美观界面
- 🔒 **隐私保护**: 本地存储，数据安全有保障
- 🔄 **云端同步**: 支持通过 rclone 同步剪贴板历史到云端
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
   - 使用快捷键打开主界面（默认为 `Command/Ctrl+Shift+V`）
4. **搜索内容**: 在搜索框输入关键词快速查找
5. **使用内容**: 点击历史记录或使用快捷键快速粘贴


## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！请查看我们的[贡献指南](CONTRIBUTING.md)。

## 📄 开源协议

ClipHarbor 使用 MIT 协议。

## 🔄 云端同步配置

### Rclone 同步
ClipHarbor 支持使用 rclone 将剪贴板历史备份到云端存储。设置步骤：

1. 安装 rclone 并配置好远程存储
   ```bash
   # 安装 rclone
   brew install rclone  # macOS
   # 或者访问 https://rclone.org/install/ 获取其他安装方式
   
   # 配置远程存储
   rclone config
   ```

2. 在 ClipHarbor 设置中：
   - 打开设置窗口
   - 在同步设置部分输入你的 rclone 配置名称
   - 点击保存，你的剪贴板历史将自动同步到云端

更多关于 rclone 配置的信息，请访问 [rclone.org](https://rclone.org/)
