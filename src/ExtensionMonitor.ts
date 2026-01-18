import * as vscode from 'vscode';
import { ConduitService } from './ConduitService';

export interface ExtensionInfo {
    id: string;
    displayName: string;
    version: string;
    isActive: boolean;
    activationTime?: number;
    extensionKind: vscode.ExtensionKind;
    publisher: string;
    description: string;
}

export class ExtensionMonitor {
    private activationTimes: Map<string, number> = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        private conduitService: ConduitService
    ) {
        this.trackActivations();
    }

    private trackActivations() {
        // Monitor when extensions activate
        vscode.extensions.onDidChange(() => {
            this.updateActivationTimes();
        });

        this.updateActivationTimes();
    }

    private updateActivationTimes() {
        for (const ext of vscode.extensions.all) {
            if (ext.isActive && !this.activationTimes.has(ext.id)) {
                // Estimate activation time (not perfect, but useful)
                this.activationTimes.set(ext.id, Date.now());
            }
        }
    }

    public getAllExtensions(): ExtensionInfo[] {
        return vscode.extensions.all.map(ext => ({
            id: ext.id,
            displayName: ext.packageJSON.displayName || ext.packageJSON.name,
            version: ext.packageJSON.version,
            isActive: ext.isActive,
            activationTime: this.activationTimes.get(ext.id),
            extensionKind: ext.extensionKind,
            publisher: ext.packageJSON.publisher || 'Unknown',
            description: ext.packageJSON.description || ''
        }));
    }

    public getActiveExtensions(): ExtensionInfo[] {
        return this.getAllExtensions().filter(ext => ext.isActive);
    }

    public getExtensionById(id: string): ExtensionInfo | undefined {
        const ext = vscode.extensions.getExtension(id);
        if (!ext) return undefined;

        return {
            id: ext.id,
            displayName: ext.packageJSON.displayName || ext.packageJSON.name,
            version: ext.packageJSON.version,
            isActive: ext.isActive,
            activationTime: this.activationTimes.get(ext.id),
            extensionKind: ext.extensionKind,
            publisher: ext.packageJSON.publisher || 'Unknown',
            description: ext.packageJSON.description || ''
        };
    }

    public getExtensionDetails(id: string) {
        const ext = vscode.extensions.getExtension(id);
        if (!ext) return null;

        return {
            ...this.getExtensionById(id),
            packageJSON: ext.packageJSON,
            extensionPath: ext.extensionPath,
            exports: ext.exports
        };
    }

    /**
     * Enable an extension
     */
    /**
     * Open extension in marketplace to allow user to enable it
     */
    public async enableExtension(extensionId: string): Promise<{ success: boolean; message: string }> {
        // "Ghost Logic" Fix: Direct enable is not possible via API. Redirect user.
        await vscode.commands.executeCommand('workbench.extensions.search', `@id:${extensionId}`);
        return { success: true, message: 'Opened extension in sidebar for management.' };
    }

    /**
     * Open extension in marketplace to allow user to disable it
     */
    public async disableExtension(extensionId: string): Promise<{ success: boolean; message: string }> {
        // "Ghost Logic" Fix: Direct disable is not possible via API. Redirect user.
        await vscode.commands.executeCommand('workbench.extensions.search', `@id:${extensionId}`);
        return { success: true, message: 'Opened extension in sidebar for management.' };
    }

    /**
     * Uninstall an extension
     */
    public async uninstallExtension(extensionId: string): Promise<{ success: boolean; message: string }> {
        try {
            const ext = vscode.extensions.getExtension(extensionId);
            if (!ext) {
                return { success: false, message: 'Extension not found' };
            }

            // Prevent uninstalling self
            if (extensionId === 'nexgen-synapse.extensionlens') {
                return { success: false, message: 'Cannot uninstall ExtensionLens itself' };
            }

            await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', extensionId);

            const msg = `Uninstalled extension: ${ext.packageJSON.displayName || extensionId}`;
            await this.conduitService.logContribution(msg);

            return { success: true, message: msg };
        } catch (error: any) {
            return { success: false, message: `Failed to uninstall: ${error.message}` };
        }
    }
}
