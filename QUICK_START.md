# ExtensionLens - Quick Start Guide

## What is ExtensionLens?

ExtensionLens is a developer tool for VS Code extension authors. It provides real-time inspection, profiling, and debugging capabilities for VS Code extensions.

## Installation

1. Open the ExtensionLens folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new VS Code window, look for the ExtensionLens icon in the Activity Bar

## Features Overview

### 📦 Extensions Tab
- View all installed extensions (active and inactive)
- See version numbers and publishers
- Search/filter extensions
- Monitor activation status

### ⌨️ Commands Tab
- Browse all registered commands
- See which extension owns each command
- Search commands by ID or title
- Identify command sources

### ⚡ Performance Tab
- Track extension activation times
- Identify slowest extensions
- Monitor average activation times
- View total/active extension counts

### ⚠️ Conflicts Tab
- Detect duplicate command registrations
- Find keybinding conflicts
- View conflict severity (warning/error)
- See which extensions are conflicting

## Usage Tips

### Finding Performance Issues
1. Open the Performance tab
2. Check the "Slowest Extensions" list
3. Look for unusually high activation times (>1000ms)
4. Consider disabling or replacing slow extensions

### Resolving Conflicts
1. Run `ExtensionLens: Detect Command Conflicts` from the command palette
2. Review conflicts in the Conflicts tab
3. Disable one of the conflicting extensions
4. Or reassign keybindings in your settings

### Debugging Your Extension
1. Install ExtensionLens in your Extension Development Host
2. Use it to verify your commands are registered correctly
3. Check activation time to optimize startup
4. Ensure no conflicts with popular extensions

### Exporting Reports
1. Run `ExtensionLens: Export Diagnostic Report`
2. Save the JSON file
3. Share with collaborators or extension maintainers
4. Use for performance tracking over time

## Configuration

Access via `File > Preferences > Settings` and search for "ExtensionLens":

- **Enable Performance Monitoring**: Track activation times (default: on)
- **Enable Event Logging**: Log VS Code events - may impact performance (default: off)
- **Auto Detect Conflicts**: Check for conflicts on startup (default: on)

## Commands

All commands available in the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `ExtensionLens: Refresh Inspector` - Reload all data
- `ExtensionLens: Show All Commands` - Quick picker for commands
- `ExtensionLens: Show Performance Metrics` - Jump to performance view
- `ExtensionLens: Detect Command Conflicts` - Run conflict detection
- `ExtensionLens: Export Diagnostic Report` - Save report to file

## Development Workflow

### For Extension Authors
1. Open your extension project
2. Press `F5` to launch Extension Development Host
3. Install ExtensionLens in the dev host
4. Monitor your extension's behavior in real-time
5. Export reports to track improvements

### For Troubleshooting
1. Notice VS Code slowness or errors?
2. Open ExtensionLens
3. Check Performance tab for slow extensions
4. Check Conflicts tab for errors
5. Export a report to share with maintainers

## Next Steps

- **Build the extension**: `npm run compile`
- **Watch mode**: `npm run watch`
- **Package**: `vsce package` (requires vsce: `npm install -g @vscode/vsce`)
- **Test**: Press `F5` and verify all features work

## Troubleshooting

**Issue**: Extension doesn't activate
- Check that you ran `npm install` and `npm run compile`
- Look for errors in the Output panel (View > Output > select "ExtensionLens")

**Issue**: Data not loading in tabs
- Click the Refresh button
- Check the Developer Console (Help > Toggle Developer Tools)

**Issue**: Can't see ExtensionLens icon
- Ensure the extension activated (check Extensions view)
- Reload VS Code (`Developer: Reload Window`)

## Contributing Ideas

Future enhancements could include:
- Event logging with filtering
- Memory usage tracking
- API call monitoring
- Extension dependency graphs
- Performance comparison over time
- Integration with VS Code Telemetry

---

**Happy debugging! 🔍**
