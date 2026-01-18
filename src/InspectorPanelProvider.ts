import * as vscode from 'vscode';
import { ExtensionMonitor } from './ExtensionMonitor';
import { CommandRegistry } from './CommandRegistry';
import { PerformanceMonitor, PerformanceMetrics } from './PerformanceMonitor';
import { ConflictDetector, Conflict } from './ConflictDetector';
import { LogMonitor, LogEntry } from './LogMonitor';
import * as path from 'path';

export class InspectorPanelProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly extensionMonitor: ExtensionMonitor,
        private readonly commandRegistry: CommandRegistry,
        private readonly performanceMonitor: PerformanceMonitor,
        private readonly conflictDetector: ConflictDetector,
        private readonly logMonitor: LogMonitor
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                // VFS RPC Bridge (AAA Security Requirement)
                case 'readFile': {
                    try {
                        const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, data.path);
                        const content = await vscode.workspace.fs.readFile(uri);
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, result: Buffer.from(content).toString('utf8') });
                    } catch (e: any) {
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, error: e.message });
                    }
                    break;
                }
                case 'writeFile': {
                    try {
                        const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, data.path);
                        const content = Buffer.from(data.content, 'utf8');
                        await vscode.workspace.fs.writeFile(uri, content);
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, result: 'success' });
                    } catch (e: any) {
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, error: e.message });
                    }
                    break;
                }
                case 'listFiles': {
                    try {
                        const root = vscode.workspace.workspaceFolders![0].uri;
                        const files = await this._recursiveList(root, '');
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, result: files });
                    } catch (e: any) {
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, error: e.message });
                    }
                    break;
                }
                case 'getSecret': {
                    try {
                        const secret = await this._context.secrets.get(data.key);
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, result: secret });
                    } catch (e: any) {
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, error: e.message });
                    }
                    break;
                }
                case 'setSecret': {
                    try {
                        await this._context.secrets.store(data.key, data.value);
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, result: 'success' });
                    } catch (e: any) {
                        webviewView.webview.postMessage({ command: 'rpcResult', id: data.id, error: e.message });
                    }
                    break;
                }

                case 'getExtensions':
                    const extensions = this.extensionMonitor.getAllExtensions();
                    webviewView.webview.postMessage({
                        type: 'extensionsData',
                        data: extensions
                    });
                    break;

                case 'getCommands':
                    const commands = await this.commandRegistry.getAllCommands();
                    webviewView.webview.postMessage({
                        type: 'commandsData',
                        data: commands
                    });
                    break;

                case 'getPerformance':
                    const metrics = this.performanceMonitor.getMetrics();
                    webviewView.webview.postMessage({
                        type: 'performanceData',
                        data: metrics
                    });
                    break;

                case 'getConflicts':
                    const conflicts = await this.conflictDetector.detectConflicts();
                    webviewView.webview.postMessage({
                        type: 'conflictsData',
                        data: conflicts
                    });
                    break;

                case 'fixConflict':
                    await this.conflictDetector.fixMissingActivationEvents(data.conflict);
                    const updatedConflicts = await this.conflictDetector.detectConflicts();
                    webviewView.webview.postMessage({
                        type: 'conflictsData',
                        data: updatedConflicts
                    });
                    break;

                case 'fixAllConflicts':
                    await this.conflictDetector.fixAllMissingActivationEvents();
                    const refreshedConflicts = await this.conflictDetector.detectConflicts();
                    webviewView.webview.postMessage({
                        type: 'conflictsData',
                        data: refreshedConflicts
                    });
                    break;

                case 'searchCommands':
                    const results = await this.commandRegistry.searchCommands(data.query);
                    webviewView.webview.postMessage({
                        type: 'searchResults',
                        data: results
                    });
                    break;

                case 'enableExtension':
                    await vscode.commands.executeCommand('extensionlens.enableExtension', data.extensionId);
                    break;

                case 'disableExtension':
                    await vscode.commands.executeCommand('extensionlens.disableExtension', data.extensionId);
                    break;

                case 'uninstallExtension':
                    await vscode.commands.executeCommand('extensionlens.uninstallExtension', data.extensionId);
                    break;

                case 'openKeybindingsEditor':
                    await vscode.commands.executeCommand('extensionlens.openKeybindingsEditor', data.commandId);
                    break;

                case 'suggestKeybindingFix':
                    await vscode.commands.executeCommand('extensionlens.suggestKeybindingFix', data.binding);
                    break;

                case 'getLogs':
                    const logs = await this.logMonitor.getLogs(data.extensionId);
                    webviewView.webview.postMessage({
                        type: 'logsData',
                        data: logs
                    });
                    break;

                case 'getRecentErrors':
                    const errors = await this.logMonitor.getRecentErrors();
                    webviewView.webview.postMessage({
                        type: 'logsData',
                        data: errors
                    });
                    break;

                case 'executeCommand':
                    await vscode.commands.executeCommand(data.commandId);
                    break;

                case 'toggleFavorite':
                    const isFav = await this.commandRegistry.toggleFavorite(data.commandId);
                    webviewView.webview.postMessage({
                        type: 'favoriteUpdated',
                        commandId: data.commandId,
                        isFavorite: isFav
                    });
                    break;
            }
        });

        // Send initial data
        this.refresh();
    }

    private async _recursiveList(uri: vscode.Uri, relative: string): Promise<string[]> {
        const entries = await vscode.workspace.fs.readDirectory(uri);
        let results: string[] = [];
        for (const [name, type] of entries) {
            const relPath = relative ? path.join(relative, name) : name;
            if (type === vscode.FileType.Directory) {
                if (name === 'node_modules' || name === '.git' || name === '.conduit' || name === '.agent') continue;
                const subResults = await this._recursiveList(vscode.Uri.joinPath(uri, name), relPath);
                results = results.concat(subResults);
            } else {
                results.push(relPath);
            }
        }
        return results;
    }

    public refresh() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'refresh' });
        }
    }

    public showPerformanceView(metrics: PerformanceMetrics) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showPerformance',
                data: metrics
            });
        }
    }

    public showConflicts(conflicts: Conflict[]) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showConflicts',
                data: conflicts
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'assets', 'inspector.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'assets', 'inspector.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src \${webview.cspSource} 'unsafe-inline'; script-src 'nonce-\${nonce}';">
    <title>ExtensionLens Inspector</title>
    <style>
        :root {
            --accent: #667eea;
            --accent-hover: #764ba2;
            --success: #4caf50;
            --warning: #ff9800;
            --danger: #f44336;
        }

        body { 
            font-family: var(--vscode-font-family); 
            padding: 12px; 
            color: var(--vscode-foreground); 
            background: var(--vscode-sideBar-background);
        }

        /* Header Card */
        .header-card { 
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.1)); 
            border: 1px solid rgba(102, 126, 234, 0.3); 
            border-radius: 10px; 
            padding: 16px; 
            margin-bottom: 16px; 
            position: relative; 
            overflow: hidden; 
        }
        .header-title { 
            font-size: 20px; font-weight: 700; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; 
            position: relative; z-index: 1;
        }
        .header-version { font-size: 10px; opacity: 0.5; font-family: monospace; margin-left: 8px; }
        .header-status { 
            display: flex; align-items: center; gap: 8px; 
            margin-top: 8px; position: relative; z-index: 1; 
        }
        .status-pill { 
            background: rgba(76, 175, 80, 0.2); color: var(--success); 
            padding: 3px 10px; border-radius: 12px; 
            font-size: 9px; font-weight: 700; letter-spacing: 0.5px; 
        }
        .status-dot { 
            width: 6px; height: 6px; background: var(--success); 
            border-radius: 50%; box-shadow: 0 0 8px var(--success); 
            animation: pulse 2s infinite; 
        }
        @keyframes pulse { 
            0%, 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); } 
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(76, 175, 80, 0); } 
        }

        /* Tabbed Interface */
        .tabs {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
            overflow-x: auto;
            scrollbar-width: none;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .tabs::-webkit-scrollbar { display: none; }
        .tab {
            white-space: nowrap;
            padding: 6px 4px;
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            opacity: 0.6;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }
        .tab.active {
            opacity: 1;
            color: var(--accent);
            border-bottom-color: var(--accent);
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }

        /* Search Box */
        .search-area { margin-bottom: 12px; }
        .search-box {
            width: 100%; box-sizing: border-box;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 8px 10px; border-radius: 6px;
            font-size: 11px;
        }
        .search-box:focus { border-color: var(--accent); outline: none; }

        /* List Items (Extension/Command) */
        .card-item {
            background: transparent;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 10px;
            transition: all 0.2s;
        }
        .card-item:hover { border-color: var(--accent); background: rgba(102, 126, 234, 0.03); }
        .item-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px; }
        .item-title { font-size: 12px; font-weight: 700; color: var(--vscode-foreground); }
        .item-meta { font-size: 10px; opacity: 0.5; display: flex; gap: 8px; flex-wrap: wrap; }
        .item-actions { display: flex; gap: 8px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; }

        /* Badges */
        .badge { 
            font-size: 9px; padding: 2px 8px; border-radius: 10px; 
            font-weight: 700; letter-spacing: 0.3px;
        }
        .badge-success { background: rgba(76, 175, 80, 0.15); color: var(--success); }
        .badge-warning { background: rgba(255, 152, 0, 0.15); color: var(--warning); }
        .badge-danger { background: rgba(244, 67, 54, 0.15); color: var(--danger); }
        .badge-accent { background: rgba(102, 126, 234, 0.15); color: var(--accent); }
        .badge-ghost { border: 1px solid var(--vscode-panel-border); opacity: 0.6; }

        /* Buttons */
        .btn-sm {
            padding: 4px 10px; border-radius: 4px; border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .btn-sm:hover { border-color: var(--accent); background: var(--accent); color: white; }
        .btn-primary-sm {
            background: var(--accent); color: white; border: none;
        }
        .btn-icon {
            background: none; border: none; cursor: pointer; opacity: 0.6; transition: all 0.1s; font-size: 14px;
        }
        .btn-icon:hover { opacity: 1; transform: scale(1.1); color: var(--warning); }
        .btn-icon.active { opacity: 1; color: var(--warning); }

        /* Metrics */
        .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .metric-card {
            background: rgba(102, 126, 234, 0.05); border: 1px solid rgba(102, 126, 234, 0.2);
            padding: 12px; border-radius: 8px;
        }
        .metric-label { font-size: 9px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px; }
        .metric-value { font-size: 18px; font-weight: 700; margin-top: 4px; }

        /* Logs */
        .log-entry {
            font-family: monospace; font-size: 10px; padding: 6px 10px;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            white-space: pre-wrap; word-break: break-all;
        }
        .log-entry:last-child { border-bottom: none; }
        .log-error { color: var(--danger); border-left: 2px solid var(--danger); }
        .log-warn { color: var(--warning); border-left: 2px solid var(--warning); }
        .log-info { color: var(--accent); border-left: 2px solid var(--accent); }

        /* Empty States */
        .empty-state { text-align: center; padding: 40px 20px; opacity: 0.5; font-size: 11px; }

        /* Footer Promo */
        .promo-card {
            margin-top: 24px; padding: 14px; 
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); 
            border-radius: 8px; border: 1px solid var(--vscode-panel-border);
            text-align: center;
        }
        .promo-title { font-size: 11px; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .btn-promo {
            display: block; margin-top: 10px; padding: 6px;
            background: var(--accent); color: white; border-radius: 4px;
            text-decoration: none; font-size: 10px; font-weight: 600;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header-card">
        <div style="display: flex; align-items: baseline;">
            <span class="header-title">Lens</span>
            <span class="header-version">v0.3.3</span>
        </div>
        <div class="header-status">
            <span class="status-pill">MONITOR ACTIVE</span>
            <span class="status-dot"></span>
        </div>
    </div>

    <!-- Main Navigation -->
    <div class="tabs">
        <button class="tab active" data-tab="extensions">Extensions</button>
        <button class="tab" data-tab="commands">Commands</button>
        <button class="tab" data-tab="performance">Performance</button>
        <button class="tab" data-tab="conflicts">Conflicts</button>
        <button class="tab" data-tab="logs">Logs</button>
    </div>

    <!-- Tabbed Contents -->
    <div id="extensions" class="tab-content active">
        <div class="search-area">
            <input type="text" class="search-box" id="extension-search" placeholder="Search extensions...">
        </div>
        <div id="extension-list"></div>
    </div>

    <div id="commands" class="tab-content">
        <div class="search-area">
            <input type="text" class="search-box" id="command-search" placeholder="Search explorer commands...">
        </div>
        <div id="command-list"></div>
    </div>

    <div id="performance" class="tab-content">
        <div id="performance-metrics"></div>
        <div id="slowest-extensions"></div>
    </div>

    <div id="conflicts" class="tab-content">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
            <button id="fix-all-conflicts" class="btn-sm btn-primary-sm" style="display: none;">Fix All Detection Issues</button>
        </div>
        <div id="conflict-list"></div>
    </div>

    <div id="logs" class="tab-content">
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <input type="text" class="search-box" id="log-search" placeholder="Search logs..." style="margin-bottom: 0;">
            <button class="btn-sm" id="btn-get-errors">Errors Only</button>
        </div>
        <div id="log-container" style="max-height: 400px; overflow-y: auto; background: rgba(0,0,0,0.1); border-radius: 8px;">
            <div class="empty-state">Select an active extension or view system errors</div>
        </div>
    </div>

    <!-- Suite Footer -->
    <div class="promo-card">
        <div class="promo-title"><span>🧩</span> NexGen-Meta Suite</div>
        <div style="font-size: 10px; opacity: 0.6;">Try <strong>Conduit</strong> for full AI orchestration</div>
        <a href="https://github.com/AlwayzPoppin/Conduit" class="btn-promo">⚡ Open Conduit</a>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Navigation
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(tabName).classList.add('active');
                loadTabData(tabName);
            });
        });

        function loadTabData(tabId) {
            switch (tabId) {
                case 'extensions': vscode.postMessage({ type: 'getExtensions' }); break;
                case 'commands': vscode.postMessage({ type: 'getCommands' }); break;
                case 'performance': vscode.postMessage({ type: 'getPerformance' }); break;
                case 'conflicts': vscode.postMessage({ type: 'getConflicts' }); break;
                case 'logs': vscode.postMessage({ type: 'getRecentErrors' }); break;
            }
        }

        // Bridge
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'extensionsData': renderExtensions(message.data); break;
                case 'commandsData': renderCommands(message.data); break;
                case 'performanceData': renderPerformance(message.data); break;
                case 'conflictsData': renderConflicts(message.data); break;
                case 'logsData': renderLogs(message.data); break;
                case 'favoriteUpdated': updateFavoriteUI(message.commandId, message.isFavorite); break;
                case 'refresh': loadTabData(document.querySelector('.tab.active').dataset.tab); break;
            }
        });

        function renderExtensions(extensions) {
            const list = document.getElementById('extension-list');
            if (extensions.length === 0) { list.innerHTML = '<div class="empty-state">No extensions found</div>'; return; }
            list.innerHTML = extensions.map(ext => \`
                <div class="card-item">
                    <div class="item-header">
                        <div>
                            <div class="item-title">\${ext.displayName}</div>
                            <div class="item-meta">
                                <span>v\${ext.version}</span>
                                <span>· \${ext.publisher}</span>
                            </div>
                        </div>
                        <span class="badge \${ext.isActive ? 'badge-success' : 'badge-ghost'}">
                            \${ext.isActive ? 'ACTIVE' : 'IDLE'}
                        </span>
                    </div>
                    <div class="item-actions">
                        <button class="btn-sm \${ext.isActive ? '' : 'btn-primary-sm'}" onclick="vscode.postMessage({type: '\${ext.isActive ? 'disableExtension' : 'enableExtension'}', extensionId: '\${ext.id}'})">
                            \${ext.isActive ? 'Manage' : 'Manage'}
                        </button>
                        <button class="btn-sm" onclick="document.querySelector('[data-tab=logs]').click(); vscode.postMessage({type:'getLogs', extensionId:'\${ext.id}'})">📋 Logs</button>
                        <button class="btn-sm" style="opacity: 0.5" onclick="vscode.postMessage({type:'uninstallExtension', extensionId:'\${ext.id}'})">🗑️</button>
                    </div>
                </div>
            \`).join('');
        }

        function renderCommands(commands) {
            const list = document.getElementById('command-list');
            const sorted = [...commands].sort((a,b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
            list.innerHTML = sorted.map(cmd => \`
                <div class="card-item">
                    <div class="item-header">
                        <div>
                            <div class="item-title">\${cmd.id}</div>
                            <div class="item-meta">\${cmd.title || 'Internal Context'}</div>
                        </div>
                        <button class="btn-icon \${cmd.isFavorite ? 'active' : ''}" onclick="vscode.postMessage({type:'toggleFavorite', commandId:'\${cmd.id}'})">
                            \${cmd.isFavorite ? '★' : '☆'}
                        </button>
                    </div>
                    <div class="item-actions">
                        <button class="btn-sm btn-primary-sm" onclick="vscode.postMessage({type:'executeCommand', commandId:'\${cmd.id}'})">⚡ Run Command</button>
                    </div>
                </div>
            \`).join('');
        }

        function renderPerformance(metrics) {
            const container = document.getElementById('performance-metrics');
            container.innerHTML = \`
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-label">Active Env</div>
                        <div class="metric-value">\${metrics.totalExtensions}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Avg Load</div>
                        <div class="metric-value">\${Math.round(metrics.avgActivationTime)}ms</div>
                    </div>
                </div>
                <div style="font-size: 11px; font-weight: 700; margin-bottom: 8px; opacity: 0.8;">Slowest Startups</div>
            \`;
            const list = document.getElementById('slowest-extensions');
            list.innerHTML = metrics.extensionActivations.slice(0, 5).map(ext => \`
                <div class="card-item" style="padding: 8px 12px; display: flex; justify-content: space-between; align-items:center;">
                    <div style="font-size: 11px;">\${ext.displayName}</div>
                    <div class="badge badge-warning">\${ext.activationTime.toFixed(0)}ms</div>
                </div>
            \`).join('');
        }

        function renderConflicts(conflicts) {
            const list = document.getElementById('conflict-list');
            const fixAll = document.getElementById('fix-all-conflicts');
            if (conflicts.length === 0) {
                list.innerHTML = '<div class="empty-state">✅ No conflicts detected</div>';
                fixAll.style.display = 'none';
                return;
            }
            fixAll.style.display = 'block';
            list.innerHTML = conflicts.map(c => \`
                <div class="card-item" style="border-left: 3px solid \${c.severity === 'error' ? 'var(--danger)' : 'var(--warning)'}">
                    <div class="item-title">\${c.id}</div>
                    <div style="font-size: 10px; margin-top: 4px; opacity: 0.8;">\${c.description}</div>
                    <div class="item-meta" style="margin-top: 6px;">
                        \${c.sources.map(s => '<span class="badge badge-ghost">' + s + '</span>').join('')}
                    </div>
                    <div class="item-actions">
                        <button class="btn-sm btn-primary-sm" onclick="vscode.postMessage({type:'fixConflict', conflict: \${JSON.stringify(c)}})">🛠️ Resolve</button>
                    </div>
                </div>
            \`).join('');
        }

        function renderLogs(logs) {
            const container = document.getElementById('log-container');
            if (logs.length === 0) {
                container.innerHTML = '<div class="empty-state">No recent log entries</div>';
                return;
            }
            container.innerHTML = logs.map(log => \`
                <div class="log-entry log-\${log.level.toLowerCase()}">
                    <span style="opacity: 0.5">[\${log.timestamp.split('T')[1].split('.')[0]}]</span> \${log.message}
                </div>
            \`).join('');
        }

        function updateFavoriteUI(id, isFav) {
            loadTabData('commands');
        }

        // Search Filters
        document.getElementById('extension-search').addEventListener('input', e => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#extension-list .card-item').forEach(item => {
                item.style.display = item.innerText.toLowerCase().includes(query) ? '' : 'none';
            });
        });

        document.getElementById('command-search').addEventListener('input', e => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#command-list .card-item').forEach(item => {
                item.style.display = item.innerText.toLowerCase().includes(query) ? '' : 'none';
            });
        });

        document.getElementById('fix-all-conflicts').onclick = () => vscode.postMessage({ type: 'fixAllConflicts' });
        document.getElementById('btn-get-errors').onclick = () => vscode.postMessage({ type: 'getRecentErrors' });

        // Initial Data
        vscode.postMessage({ type: 'getExtensions' });
    </script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
