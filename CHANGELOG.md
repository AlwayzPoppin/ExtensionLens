# Change Log

## [0.3.3] - 2026-01-17

### Security & Reliability
- **Vigilant Remediations**:
    - **Safe Management**: Removed direct enable/disable calls in favor of Marketplace redirection.
    - **Memory Safety**: Log monitoring now uses tail-reading to prevent OOM on large files.
    - **Isolation**: Removed auto-patching of external extension manifests.
- **Build Fixes**: Enforced clean build pipeline to prevent stale artifacts.

## [0.3.0] - 2025-12-28

### New Features

#### Extension Log Monitoring
- **New Logs Tab**: Real-time access to extension logs and error consoles
- **Extension-Specific Logs**: Click the "Logs" button on any active extension to see its output
- **Global Error View**: "Errors" button to quickly see critical issues across all extensions
- **Live Search**: filter logs in real-time by message or source
- **Automatic Scrolling**: Always keep the latest logs in view

### UI Improvements
- Added "Logs" tab to the main sidebar
- Added "Logs" action button to active extensions in the list
- **Extension Selection**: Added visual selection state and click handling for the extension list
- **Details Pane**: Added a dynamic details view that displays comprehensive extension metadata upon selection
- Color-coded log levels (Error, Warn, Info, Debug)
- Improved webview script reliability

## [0.2.0] - 2025-12-28

### New Features

#### Extension Control
- **Enable/Disable Extensions**: Click enable or disable buttons directly in the Extensions tab
- **Uninstall Extensions**: Remove extensions with one click (with confirmation)
- **Smart Protection**: Cannot disable or uninstall ExtensionLens itself
- **Confirmation Dialogs**: Safety prompts before disabling or uninstalling

#### Keybinding Resolution
- **Open Keybindings Editor**: Click "Open Keybindings" on conflicts to jump directly to the keybindings editor
- **Suggest Alternative Keybindings**: Get AI-powered suggestions for available keybindings
- **Quick Fix Workflow**: One-click access to resolve keybinding conflicts

###  UI Improvements
- Added action buttons to extension list items
- Added resolution buttons to conflict cards
- Improved button styling with hover effects
- Better visual hierarchy in lists

### Technical Changes
- New commands: `enableExtension`, `disableExtension`, `uninstallExtension`
- New commands: `openKeybindingsEditor`, `suggestKeybindingFix`
- Enhanced `ExtensionMonitor` with control methods
- Enhanced `ConflictDetector` with resolution methods
- Improved message handling in webview

## [0.1.0] - 2025-12-28

All notable changes to the "ExtensionLens" extension will be documented in this file.

## [0.1.0] - 2025-12-28

### Initial Release

#### Features
- **Extension Inspector**: View all installed and active extensions with detailed information
- **Command Explorer**: Browse and search all registered VS Code commands
- **Performance Monitor**: Track extension activation times and identify performance bottlenecks
- **Conflict Detector**: Automatically detect command and keybinding conflicts between extensions
- **Tabbed UI**: Clean, organized interface with searchable lists
- **Export Reports**: Generate diagnostic reports in JSON format

#### Commands
- `ExtensionLens: Refresh Inspector` - Refresh the inspector view
- `ExtensionLens: Show All Commands` - Quick picker for all commands
- `ExtensionLens: Show Performance Metrics` - View performance data
- `ExtensionLens: Detect Command Conflicts` - Find conflicts
- `ExtensionLens: Export Diagnostic Report` - Generate JSON report

#### Configuration
- `extensionlens.enablePerformanceMonitoring` - Monitor activation times (default: true)
- `extensionlens.enableEventLogging` - Log VS Code events (default: false)
- `extensionlens.autoDetectConflicts` - Auto-detect conflicts on startup (default: true)
