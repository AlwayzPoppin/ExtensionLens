import * as vscode from 'vscode';

export interface Conflict {
    type: 'command' | 'keybinding' | 'activation' | 'registration';
    id: string;
    sources: string[];
    severity: 'warning' | 'error';
    description: string;
    extensionId?: string;
}

export class ConflictDetector {
    async detectConflicts(): Promise<Conflict[]> {
        const conflicts: Conflict[] = [];

        // Detect command conflicts
        const commandConflicts = await this.detectCommandConflicts();
        conflicts.push(...commandConflicts);

        // Detect keybinding conflicts
        const keybindingConflicts = await this.detectKeybindingConflicts();
        conflicts.push(...keybindingConflicts);

        // Detect activation event overlaps
        const activationConflicts = await this.detectActivationConflicts();
        conflicts.push(...activationConflicts);

        // Detect manifest vs runtime mismatches
        const registrationConflicts = await this.detectRegistrationMismatches();
        conflicts.push(...registrationConflicts);

        return conflicts;
    }

    private async detectCommandConflicts(): Promise<Conflict[]> {
        const conflicts: Conflict[] = [];
        const commandMap = new Map<string, string[]>();

        // Build map of commands to extensions
        for (const ext of vscode.extensions.all) {
            const commands = ext.packageJSON.contributes?.commands || [];
            for (const cmd of commands) {
                const cmdId = cmd.command;
                if (!commandMap.has(cmdId)) {
                    commandMap.set(cmdId, []);
                }
                commandMap.get(cmdId)!.push(ext.packageJSON.displayName || ext.packageJSON.name);
            }
        }

        // Find duplicates
        for (const [cmdId, sources] of commandMap.entries()) {
            if (sources.length > 1) {
                conflicts.push({
                    type: 'command',
                    id: cmdId,
                    sources,
                    severity: 'error',
                    description: `Command "${cmdId}" is registered by multiple extensions`
                });
            }
        }

        return conflicts;
    }

    private async detectKeybindingConflicts(): Promise<Conflict[]> {
        const conflicts: Conflict[] = [];

        // Note: VS Code doesn't expose a direct API for keybindings
        // We can only check package.json contributions
        const keybindingMap = new Map<string, Array<{ source: string; command: string }>>();

        for (const ext of vscode.extensions.all) {
            const keybindings = ext.packageJSON.contributes?.keybindings || [];
            for (const kb of keybindings) {
                const key = kb.key || kb.mac || kb.linux || kb.win;
                if (!key) continue;

                const normalizedKey = this.normalizeKeybinding(key);
                if (!keybindingMap.has(normalizedKey)) {
                    keybindingMap.set(normalizedKey, []);
                }
                keybindingMap.get(normalizedKey)!.push({
                    source: ext.packageJSON.displayName || ext.packageJSON.name,
                    command: kb.command
                });
            }
        }

        // Find conflicts
        for (const [key, bindings] of keybindingMap.entries()) {
            if (bindings.length > 1) {
                conflicts.push({
                    type: 'keybinding',
                    id: key,
                    sources: bindings.map(b => `${b.source} (${b.command})`),
                    severity: 'warning',
                    description: `Keybinding "${key}" is used by multiple commands`
                });
            }
        }

        return conflicts;
    }

    private async detectRegistrationMismatches(): Promise<Conflict[]> {
        const conflicts: Conflict[] = [];
        const runtimeCommands = new Set(await vscode.commands.getCommands(true));

        for (const ext of vscode.extensions.all) {
            // Skip built-in extensions to focus on dev projects
            if (ext.id.startsWith('vscode.') || ext.id.startsWith('microsoft.')) continue;

            const manifestCommands = ext.packageJSON.contributes?.commands || [];
            const activationEvents = ext.packageJSON.activationEvents || [];

            for (const cmd of manifestCommands) {
                const cmdId = cmd.command;
                const sourceName = ext.packageJSON.displayName || ext.packageJSON.name;

                // 1. Check for Ghost Commands (Manifest but no Runtime)
                if (!runtimeCommands.has(cmdId) && ext.isActive) {
                    conflicts.push({
                        type: 'registration',
                        id: cmdId,
                        sources: [sourceName],
                        extensionId: ext.id,
                        severity: 'error',
                        description: `Command "${cmdId}" is defined in package.json but not registered in code. Users will see "Command not found".`
                    });
                }

                // 2. Check for Missing Activation Events
                const hasOnCommand = activationEvents.includes(`onCommand:${cmdId}`);
                const hasWildcard = activationEvents.includes('*') || activationEvents.includes('onStartupFinished');

                if (!hasOnCommand && !hasWildcard) {
                    conflicts.push({
                        type: 'registration',
                        id: cmdId,
                        sources: [sourceName],
                        extensionId: ext.id,
                        severity: 'warning',
                        description: `Command "${cmdId}" is missing "onCommand:${cmdId}" in activationEvents. It may fail to trigger if the extension isn't already active.`
                    });
                }
            }

            // 3. Check for Eager Activation (Performance)
            if (activationEvents.includes('*')) {
                conflicts.push({
                    type: 'activation',
                    id: '*',
                    sources: [ext.packageJSON.displayName || ext.packageJSON.name],
                    severity: 'warning',
                    description: `Extension uses wildcard activation ("*"). This significantly impacts VS Code startup time.`
                });
            }
        }

        return conflicts;
    }

    private async detectActivationConflicts(): Promise<Conflict[]> {
        const conflicts: Conflict[] = [];
        const activationMap = new Map<string, string[]>();

        for (const ext of vscode.extensions.all) {
            const events = ext.packageJSON.activationEvents || [];
            for (const event of events) {
                // Ignore very common/generic events unless they are duplicates within your own suite
                if (event === '*' || event === 'onStartupFinished') continue;

                if (!activationMap.has(event)) {
                    activationMap.set(event, []);
                }
                activationMap.get(event)!.push(ext.packageJSON.displayName || ext.packageJSON.name);
            }
        }

        for (const [event, sources] of activationMap.entries()) {
            // We consider 3+ extensions on the same specific event a potential performance warning
            if (sources.length > 2) {
                conflicts.push({
                    type: 'activation',
                    id: event,
                    sources,
                    severity: 'warning',
                    description: `Multiple extensions (${sources.length}) activate on "${event}". This may impact editor responsiveness.`
                });
            }
        }

        return conflicts;
    }

    private normalizeKeybinding(key: string): string {
        return key.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/control\+/g, 'ctrl+')
            .replace(/option\+/g, 'alt+')
            .replace(/command\+/g, 'cmd+')
            .replace(/meta\+/g, 'cmd+');
    }

    /**
     * Open keybindings editor filtered to a specific command
     */
    public async openKeybindingsEditor(commandId: string): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', commandId);
    }

    /**
     * Suggest alternative keybindings that are not in use
     */
    public async suggestAlternativeKeybindings(currentBinding: string): Promise<string[]> {
        const suggestions: string[] = [];

        // Common modifier combinations
        const modifiers = [
            'ctrl+shift',
            'ctrl+alt',
            'alt+shift',
            'ctrl+shift+alt'
        ];

        // Commonly available keys
        const keys = [
            'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
        ];

        // Get all currently used keybindings
        const usedBindings = new Set<string>();
        for (const ext of vscode.extensions.all) {
            const keybindings = ext.packageJSON.contributes?.keybindings || [];
            for (const kb of keybindings) {
                const key = kb.key || kb.mac || kb.linux || kb.win;
                if (key) {
                    usedBindings.add(this.normalizeKeybinding(key));
                }
            }
        }

        // Generate suggestions
        for (const modifier of modifiers) {
            for (const key of keys) {
                const binding = `${modifier}+${key}`;
                const normalized = this.normalizeKeybinding(binding);

                if (!usedBindings.has(normalized)) {
                    suggestions.push(binding);

                    // Return top 10 suggestions
                    if (suggestions.length >= 10) {
                        return suggestions;
                    }
                }
            }
        }

        return suggestions;
    }

    /**
     * Get detailed information about a conflict
     */
    public async getConflictDetails(conflict: Conflict): Promise<{ commandIds: string[]; extensionIds: string[] }> {
        const commandIds: string[] = [];
        const extensionIds: string[] = [];

        if (conflict.type === 'keybinding') {
            // Parse out command IDs and extension IDs from sources
            for (const ext of vscode.extensions.all) {
                const keybindings = ext.packageJSON.contributes?.keybindings || [];
                for (const kb of keybindings) {
                    const key = kb.key || kb.mac || kb.linux || kb.win;
                    if (key && this.normalizeKeybinding(key) === this.normalizeKeybinding(conflict.id)) {
                        commandIds.push(kb.command);
                        extensionIds.push(ext.id);
                    }
                }
            }
        }

        return { commandIds, extensionIds };
    }

    /**
     * Automatically fixes missing activation events by updating the extension's package.json.
     * This is useful for developers to quickly sync their manifest with their code.
     */
    public async fixMissingActivationEvents(conflict: Conflict): Promise<boolean> {
        // Security Fix: Do not auto-patch installed extensions.
        // It violates isolation and gets overwritten.

        const newEvent = `onCommand:${conflict.id}`;
        const message = `To fix this, add "${newEvent}" to 'activationEvents' in package.json.`;

        await vscode.window.showInformationMessage(`Manual Fix Required: ${message}`, 'Copy to Clipboard')
            .then(selection => {
                if (selection === 'Copy to Clipboard') {
                    vscode.env.clipboard.writeText(newEvent);
                }
            });

        return true;
    }

    /**
     * Automatically fixes all missing activation events across all extensions.
     * This identifies every command registered in code but missing from the manifest
     * and updates the respective package.json files in a single batch operation.
     */
    public async fixAllMissingActivationEvents(): Promise<boolean> {
        const conflicts = await this.detectRegistrationMismatches();
        const missingEvents = conflicts.filter(c =>
            c.type === 'registration' &&
            c.extensionId &&
            c.description.includes('missing "onCommand:')
        );

        if (missingEvents.length === 0) {
            vscode.window.showInformationMessage('No missing activation events detected.');
            return true;
        }

        const edit = new vscode.WorkspaceEdit();
        const extensionGroups = new Map<string, string[]>();

        // Group command IDs by extensionId to minimize file operations
        for (const conflict of missingEvents) {
            const extId = conflict.extensionId!;
            if (!extensionGroups.has(extId)) {
                extensionGroups.set(extId, []);
            }
            extensionGroups.get(extId)!.push(conflict.id);
        }

        for (const [extId, commandIds] of extensionGroups.entries()) {
            const extension = vscode.extensions.getExtension(extId);
            if (!extension) continue;

            const packageJsonUri = vscode.Uri.joinPath(extension.extensionUri, 'package.json');
            try {
                const document = await vscode.workspace.openTextDocument(packageJsonUri);
                const text = document.getText();
                const json = JSON.parse(text);

                if (!json.activationEvents) json.activationEvents = [];

                const originalCount = json.activationEvents.length;
                for (const cmdId of commandIds) {
                    const newEvent = `onCommand:${cmdId}`;
                    if (!json.activationEvents.includes(newEvent)) {
                        json.activationEvents.push(newEvent);
                    }
                }

                if (json.activationEvents.length > originalCount) {
                    json.activationEvents.sort();
                    const range = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
                    edit.replace(packageJsonUri, range, JSON.stringify(json, null, 4));
                }
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to process package.json for ${extId}: ${err}`);
            }
        }

        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            vscode.window.showInformationMessage(`Successfully updated activationEvents for ${extensionGroups.size} extensions.`);
        }
        return success;
    }
}
