import * as vscode from 'vscode';
import { InspectorPanelProvider } from './InspectorPanelProvider';
import { ExtensionMonitor } from './ExtensionMonitor';
import { CommandRegistry } from './CommandRegistry';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ConflictDetector } from './ConflictDetector';
import { LogMonitor } from './LogMonitor';
import { ConduitService } from './ConduitService';

import * as path from 'path';
import * as fs from 'fs';

let extensionMonitor: ExtensionMonitor;
let commandRegistry: CommandRegistry;
let performanceMonitor: PerformanceMonitor;
let conflictDetector: ConflictDetector;
let logMonitor: LogMonitor;
let conduitService: ConduitService;

export async function activate(context: vscode.ExtensionContext) {
    const debugLogPath = path.join(context.extensionPath, 'extensionlens_debug.log');
    const log = (msg: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', metadata: any = {}) => {
        try {
            const entry = {
                timestamp: new Date().toISOString(),
                level,
                message: msg,
                ...metadata
            };
            fs.appendFileSync(debugLogPath, JSON.stringify(entry) + '\n');
        } catch { }
    };

    log('ExtensionLens is now active');
    console.log('⚡ ExtensionLens is now active');

    // Initialize core services
    commandRegistry = new CommandRegistry(context);
    performanceMonitor = new PerformanceMonitor(context);
    conflictDetector = new ConflictDetector();
    logMonitor = new LogMonitor(context);
    conduitService = new ConduitService(context);

    CommandRegistry.setConduitService(conduitService);

    extensionMonitor = new ExtensionMonitor(context, conduitService);

    // Register webview provider
    const inspectorProvider = new InspectorPanelProvider(
        context,
        extensionMonitor,
        commandRegistry,
        performanceMonitor,
        conflictDetector,
        logMonitor
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'extensionlens.inspector',
            inspectorProvider
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.refreshInspector', () => {
            inspectorProvider.refresh();
            vscode.window.showInformationMessage('ExtensionLens: Inspector refreshed');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.showCommandPalette', async () => {
            const commands = await commandRegistry.getAllCommands();

            // Sort favorites to the top
            const sortedCommands = [...commands].sort((a, b) => {
                if (a.isFavorite && !b.isFavorite) return -1;
                if (!a.isFavorite && b.isFavorite) return 1;
                return a.id.localeCompare(b.id);
            });

            const items = sortedCommands.map(cmd => ({
                label: (cmd.isFavorite ? '$(star-full) ' : '') + cmd.id,
                description: cmd.source || 'Unknown',
                detail: cmd.title
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Search commands...',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                vscode.window.showInformationMessage(`Command: ${selected.label}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.showPerformance', () => {
            const metrics = performanceMonitor.getMetrics();
            inspectorProvider.showPerformanceView(metrics);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.detectConflicts', async () => {
            const conflicts = await conflictDetector.detectConflicts();

            if (conflicts.length === 0) {
                vscode.window.showInformationMessage('No conflicts detected!');
            } else {
                const message = `Found ${conflicts.length} conflict(s)`;
                const action = await vscode.window.showWarningMessage(
                    message,
                    'View Details'
                );

                if (action === 'View Details') {
                    inspectorProvider.showConflicts(conflicts);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.exportReport', async () => {
            const report = await generateDiagnosticReport();
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('extensionlens-report.json'),
                filters: {
                    'JSON': ['json']
                }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(
                    uri,
                    Buffer.from(JSON.stringify(report, null, 2))
                );
                vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
            }
        })
    );

    // Extension control commands
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.enableExtension', async (extensionId: string) => {
            const result = await extensionMonitor.enableExtension(extensionId);
            if (result.success) {
                vscode.window.showInformationMessage(result.message);
                inspectorProvider.refresh();
            } else {
                vscode.window.showErrorMessage(result.message);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.disableExtension', async (extensionId: string) => {
            const ext = vscode.extensions.getExtension(extensionId);
            const displayName = ext?.packageJSON.displayName || extensionId;

            const confirmation = await vscode.window.showWarningMessage(
                `Disable "${displayName}"?`,
                { modal: true },
                'Disable'
            );

            if (confirmation === 'Disable') {
                const result = await extensionMonitor.disableExtension(extensionId);
                if (result.success) {
                    vscode.window.showInformationMessage(result.message);
                    inspectorProvider.refresh();
                } else {
                    vscode.window.showErrorMessage(result.message);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.uninstallExtension', async (extensionId: string) => {
            const ext = vscode.extensions.getExtension(extensionId);
            const displayName = ext?.packageJSON.displayName || extensionId;

            const confirmation = await vscode.window.showWarningMessage(
                `Uninstall "${displayName}"? This cannot be undone.`,
                { modal: true },
                'Uninstall'
            );

            if (confirmation === 'Uninstall') {
                const result = await extensionMonitor.uninstallExtension(extensionId);
                if (result.success) {
                    vscode.window.showInformationMessage(result.message);
                    inspectorProvider.refresh();
                } else {
                    vscode.window.showErrorMessage(result.message);
                }
            }
        })
    );

    // Keybinding resolution commands
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.openKeybindingsEditor', async (commandId: string) => {
            await conflictDetector.openKeybindingsEditor(commandId);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extensionlens.suggestKeybindingFix', async (currentBinding: string) => {
            const suggestions = await conflictDetector.suggestAlternativeKeybindings(currentBinding);

            if (suggestions.length === 0) {
                vscode.window.showInformationMessage('No alternative keybindings available.');
                return;
            }

            const selected = await vscode.window.showQuickPick(suggestions, {
                placeHolder: `Alternative keybindings for "${currentBinding}"`,
                title: 'Suggested Keybinding'
            });

            if (selected) {
                const action = await vscode.window.showInformationMessage(
                    `To use "${selected}", manually assign it in the Keybindings editor.`,
                    'Open Keybindings'
                );

                if (action === 'Open Keybindings') {
                    await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings');
                }
            }
        })
    );

    // Auto-detect conflicts on startup if enabled
    const config = vscode.workspace.getConfiguration('extensionlens');
    if (config.get('autoDetectConflicts', true)) {
        setTimeout(() => {
            conflictDetector.detectConflicts().then(conflicts => {
                if (conflicts.length > 0) {
                    vscode.window.showWarningMessage(
                        `ExtensionLens: ${conflicts.length} conflict(s) detected`,
                        'View'
                    ).then(action => {
                        if (action === 'View') {
                            vscode.commands.executeCommand('extensionlens.detectConflicts');
                        }
                    });
                }
            });
        }, 3000);
    }

    // Start performance monitoring if enabled
    if (config.get('enablePerformanceMonitoring', true)) {
        performanceMonitor.startMonitoring();
    }

    // Report activation to Conduit
    conduitService.updateStatus('ExtensionLens meta-monitoring initialized');
}

async function generateDiagnosticReport() {
    const extensions = vscode.extensions.all.map(ext => ({
        id: ext.id,
        isActive: ext.isActive,
        packageJSON: ext.packageJSON
    }));

    const commands = await commandRegistry.getAllCommands();
    const metrics = performanceMonitor.getMetrics();
    const conflicts = await conflictDetector.detectConflicts();

    return {
        timestamp: new Date().toISOString(),
        vscodeVersion: vscode.version,
        extensions,
        commands,
        performance: metrics,
        conflicts
    };
}

export function deactivate() {
    if (performanceMonitor) {
        performanceMonitor.stopMonitoring();
    }
}
