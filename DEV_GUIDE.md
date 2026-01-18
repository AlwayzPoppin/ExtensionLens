# ExtensionLens Development Tips

## Daily Development Workflow

### Starting Development
```bash
# 1. Open the project
cd C:\Users\wattz\NexGen-Meta\ExtensionLens

# 2. Start watch mode (auto-compile on save)
npm run watch

# 3. Press F5 in VS Code to launch Extension Development Host

# 4. Make changes to .ts files - they'll auto-compile

# 5. Reload Extension Development Host with Ctrl+R (or Cmd+R on Mac)
```

### Making Changes

**When you edit TypeScript files**:
1. Save the file (auto-compiles if watch mode is running)
2. Reload the Extension Development Host (`Ctrl+R` or `Cmd+R`)
3. Changes take effect immediately

**When you edit package.json**:
1. Save the file
2. Reload the Extension Development Host window
3. Sometimes need to restart entirely (close and press F5 again)

## Debugging Tips

### Viewing Logs
- **Extension Host Output**: `View > Output > Select "ExtensionLens"`
- **Developer Console**: `Help > Toggle Developer Tools` (in Extension Development Host)
- **Webview Console**: Right-click webview > `Inspect` (opens DevTools for webview)

### Common Issues

**Issue**: "Extension not found"
```bash
# Solution: Recompile
npm run compile
```

**Issue**: Changes not appearing
```bash
# Solution: Reload the Extension Development Host
# Press Ctrl+R (Cmd+R on Mac) in the Extension Development Host window
```

**Issue**: Webview not updating
```bash
# The webview HTML is embedded in InspectorPanelProvider.ts
# After editing, recompile and reload
npm run compile
# Then reload Extension Development Host
```

**Issue**: Commands not working
```bash
# 1. Check package.json - ensure commands are registered in "contributes.commands"
# 2. Check extension.ts - ensure command handlers are registered
# 3. Reload Extension Development Host
```

## Testing Workflow

### Manual Testing Checklist

**Extensions Tab**:
- [ ] Extensions list loads
- [ ] Search box filters correctly
- [ ] Active/Inactive badges show correctly
- [ ] Can scroll through extensions

**Commands Tab**:
- [ ] Commands list loads
- [ ] Search box filters correctly
- [ ] Shows command source
- [ ] All commands appear

**Performance Tab**:
- [ ] Metrics load correctly
- [ ] Shows total/active counts
- [ ] Shows slowest extensions
- [ ] Activation times make sense

**Conflicts Tab**:
- [ ] Conflict detection runs
- [ ] Shows conflicts if any exist
- [ ] Shows "no conflicts" if none
- [ ] Error/warning badges correct

**Commands**:
- [ ] Refresh command works
- [ ] Show All Commands opens quick picker
- [ ] Show Performance jumps to tab
- [ ] Detect Conflicts shows results
- [ ] Export Report saves JSON file

### Creating Test Scenarios

**Test conflict detection**:
1. Install two extensions that might conflict (e.g., multiple theme extensions)
2. Run conflict detection
3. Verify conflicts are shown

**Test performance monitoring**:
1. Install a slow extension (e.g., large language pack)
2. Reload VS Code
3. Check performance tab for activation time

## Code Organization

### Adding a New Feature

**1. Create the service** (if needed):
```typescript
// src/NewService.ts
export class NewService {
    constructor() { }
    
    public async getData() {
        // Implementation
    }
}
```

**2. Update extension.ts**:
```typescript
import { NewService } from './NewService';

let newService: NewService;

export function activate(context: vscode.ExtensionContext) {
    newService = new NewService();
    
    // Register command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.newFeature', async () => {
            const data = await newService.getData();
            // Handle data
        })
    );
}
```

**3. Update package.json**:
```json
{
  "contributes": {
    "commands": [
      {
        "command": "extensionlens.newFeature",
        "title": "ExtensionLens: New Feature"
      }
    ]
  }
}
```

**4. Update webview** (if UI needed):
```typescript
// In InspectorPanelProvider.ts
webviewView.webview.onDidReceiveMessage(async (data) => {
    switch (data.type) {
        case 'getNewData':
            const newData = await newService.getData();
            webviewView.webview.postMessage({
                type: 'newData',
                data: newData
            });
            break;
    }
});
```

### Webview Development

The webview is a single HTML string in `InspectorPanelProvider.ts`:

**To add a new tab**:
1. Add tab button in the tabs section
2. Add tab content div
3. Add case in `loadTabData()` function
4. Add message handler in `window.addEventListener('message')`
5. Add render function (e.g., `renderNewTab()`)

**Webview tips**:
- Use VS Code CSS variables for theming
- Keep JavaScript inline (no external files)
- Use `acquireVsCodeApi()` for messaging
- Test in light and dark themes

## Performance Optimization

### Best Practices

**Lazy loading**:
```typescript
// Don't load data until needed
public async getData() {
    if (this.cache && this.isCacheValid()) {
        return this.cache;
    }
    this.cache = await this.fetchData();
    return this.cache;
}
```

**Caching**:
```typescript
private cache: any[] = [];
private lastUpdate: number = 0;
private CACHE_DURATION = 5000; // 5 seconds

async getData() {
    const now = Date.now();
    if (now - this.lastUpdate < this.CACHE_DURATION) {
        return this.cache;
    }
    // Fetch fresh data
}
```

**Async operations**:
```typescript
// Use async/await for non-blocking operations
async loadData() {
    const [extensions, commands, metrics] = await Promise.all([
        this.extensionMonitor.getAllExtensions(),
        this.commandRegistry.getAllCommands(),
        this.performanceMonitor.getMetrics()
    ]);
}
```

## Packaging for Release

### Creating a VSIX

```bash
# 1. Install vsce (once)
npm install -g @vscode/vsce

# 2. Update version in package.json
# Edit version field: "0.1.1"

# 3. Update CHANGELOG.md
# Document changes

# 4. Clean and compile
npm run compile

# 5. Package
vsce package

# Creates: extensionlens-0.1.1.vsix
```

### Testing the VSIX

```bash
# Install locally
code --install-extension extensionlens-0.1.1.vsix

# Test in clean environment
code --disable-extensions --install-extension extensionlens-0.1.1.vsix
```

### Publishing (when ready)

```bash
# 1. Get a publisher account at https://marketplace.visualstudio.com/

# 2. Create a Personal Access Token (PAT)
# https://dev.azure.com/ > User Settings > Personal Access Tokens

# 3. Login
vsce login nexgen-synapse

# 4. Publish
vsce publish
```

## Git Workflow

### Initial Setup
```bash
cd ExtensionLens
git init
git add .
git commit -m "Initial commit - ExtensionLens v0.1.0"
```

### Working on Features
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, commit
git add .
git commit -m "Add new feature"

# Merge back to main
git checkout main
git merge feature/new-feature
```

### Version Tagging
```bash
# Tag releases
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

## Troubleshooting Common Errors

### TypeScript Errors

**Error**: Cannot find module 'vscode'
```bash
# Solution: Install types
npm install --save-dev @types/vscode
```

**Error**: Property 'X' does not exist
```typescript
// Solution: Check VS Code API version
// Update package.json engines.vscode to match your API usage
```

### Runtime Errors

**Error**: Command 'extensionlens.X' already exists
```typescript
// Solution: Extension activated twice
// Check that activation events are correct
// Ensure you're not registering commands multiple times
```

**Error**: Webview not loading
```typescript
// Solution: Check webview options
webviewView.webview.options = {
    enableScripts: true,  // Required!
    localResourceRoots: [this._extensionUri]
};
```

## VS Code Extension API Quick Reference

### Common APIs

```typescript
// Get all extensions
vscode.extensions.all

// Get specific extension
vscode.extensions.getExtension('publisher.extension-id')

// Get all commands
await vscode.commands.getCommands(true)

// Execute command
await vscode.commands.executeCommand('command.id')

// Show notification
vscode.window.showInformationMessage('Message')
vscode.window.showWarningMessage('Warning')
vscode.window.showErrorMessage('Error')

// Quick picker
const selection = await vscode.window.showQuickPick(items, options)

// Save dialog
const uri = await vscode.window.showSaveDialog(options)

// Configuration
const config = vscode.workspace.getConfiguration('extensionlens')
const value = config.get('settingName', defaultValue)
```

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)

---

Happy coding! 🚀
