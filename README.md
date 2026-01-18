# 🔬 ExtensionLens

![Version](https://img.shields.io/visual-studio-marketplace/v/NexGenSynapse.extensionlens) ![Installs](https://img.shields.io/visual-studio-marketplace/i/NexGenSynapse.extensionlens) ![Rating](https://img.shields.io/visual-studio-marketplace/r/NexGenSynapse.extensionlens)


[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=nexgen-synapse.extensionlens)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Part of NexGen-Meta](https://img.shields.io/badge/NexGen--Meta-Suite-purple)](https://github.com/AlwayzPoppin/NexGen-Meta)

**The missing developer tools for VS Code extension creators.**

ExtensionLens gives you X-ray vision into your extensions: inspect commands, detect conflicts, profile performance, and debug issues—all from a sleek sidebar.

---

## ✨ Features

### 🔍 Extension Inspector
- View all installed extensions with activation status
- Enable/Disable/Uninstall extensions directly from the UI
- Monitor extension lifecycle in real-time

### ⚡ Click-to-Execute Commands
- Browse all registered commands in one place
- **Click any command to execute it instantly**
- Search and filter the entire command registry

### ⚠️ Conflict Detector
- Automatically detect keybinding conflicts
- Find duplicate command registrations
- One-click fixes for common issues

### 📊 Performance Monitor
- Real-time activation time tracking
- Identify the slowest extensions
- Optimize your extension's startup

### 📋 Log Monitor
- Real-time access to extension output channels
- View errors across all extensions at once
- Search and filter logs instantly

---

## 🚀 Quick Start

1. Install ExtensionLens from the VS Code Marketplace
2. Click the **🔬 ExtensionLens** icon in the Activity Bar
3. Explore your extensions!

### Commands

| Command | Description |
|---------|-------------|
| `ExtensionLens: Refresh Inspector` | Reload all data |
| `ExtensionLens: Show All Commands` | Browse command registry |
| `ExtensionLens: Show Performance Metrics` | View activation times |
| `ExtensionLens: Detect Command Conflicts` | Find conflicts |
| `ExtensionLens: Export Diagnostic Report` | Generate JSON report |

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `extensionlens.enablePerformanceMonitoring` | `true` | Track extension activation times |
| `extensionlens.enableEventLogging` | `false` | Log VS Code events (may impact performance) |
| `extensionlens.autoDetectConflicts` | `true` | Automatically detect conflicts on startup |

---

## 🧩 Part of the NexGen-Meta Suite

ExtensionLens is part of **NexGen-Meta**, a collection of developer tools for the modern IDE:

| Tool | Description |
|------|-------------|
| **[Conduit](https://github.com/AlwayzPoppin/Conduit)** | AI orchestration layer for VS Code. Coordinate multiple AI agents seamlessly. |
| **ExtensionLens** | You're using it! Developer tools for extension debugging. |

> 💡 *Like ExtensionLens? Star the repo and check out Conduit for AI-powered development workflows!*

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

## 📄 License

MIT © [Michael Watkins](https://github.com/AlwayzPoppin)
