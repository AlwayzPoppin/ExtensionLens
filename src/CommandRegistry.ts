import * as vscode from 'vscode';
import { ConduitService } from './ConduitService';

export interface CommandInfo {
    id: string;
    title?: string;
    source?: string;
    category?: string;
    isInternal?: boolean;
    isFavorite?: boolean;
}

export class CommandRegistry {
    private commandCache: CommandInfo[] = [];
    private lastUpdate: number = 0;
    private CACHE_DURATION = 5000; // 5 seconds
    private static conduitService?: ConduitService;
    private static readonly FAVORITES_KEY = 'extensionlens.favoriteCommands';

    constructor(private readonly context: vscode.ExtensionContext) { }

    public static setConduitService(service: ConduitService) {
        this.conduitService = service;
    }

    async getAllCommands(): Promise<CommandInfo[]> {
        const now = Date.now();
        if (now - this.lastUpdate < this.CACHE_DURATION && this.commandCache.length > 0) {
            return this.commandCache;
        }

        const commands = await vscode.commands.getCommands(true);
        const commandInfos: CommandInfo[] = [];

        // Try to match commands to extensions
        const extensions = vscode.extensions.all;

        for (const cmdId of commands) {
            const info: CommandInfo = {
                id: cmdId,
                source: this.findCommandSource(cmdId, extensions),
                isInternal: cmdId.startsWith('_') || cmdId.includes('._')
            };

            // Try to extract title from package.json contributions
            const sourceExt = extensions.find(ext =>
                ext.packageJSON.contributes?.commands?.some((c: any) => c.command === cmdId)
            );

            if (sourceExt) {
                const cmdDef = sourceExt.packageJSON.contributes.commands.find(
                    (c: any) => c.command === cmdId
                );
                if (cmdDef) {
                    info.title = cmdDef.title;
                    info.category = cmdDef.category;
                }
            }

            const favorites = this.getFavorites();
            info.isFavorite = favorites.includes(cmdId);

            commandInfos.push(info);
        }

        this.commandCache = commandInfos;
        this.lastUpdate = now;

        return commandInfos;
    }

    private getFavorites(): string[] {
        return this.context.globalState.get<string[]>(CommandRegistry.FAVORITES_KEY, []);
    }

    async toggleFavorite(commandId: string): Promise<boolean> {
        const favorites = this.getFavorites();
        const index = favorites.indexOf(commandId);
        let newValue: boolean;

        if (index > -1) {
            favorites.splice(index, 1);
            newValue = false;
        } else {
            favorites.push(commandId);
            newValue = true;
        }

        await this.context.globalState.update(CommandRegistry.FAVORITES_KEY, favorites);

        // Update cache if it exists
        const cachedCmd = this.commandCache.find(c => c.id === commandId);
        if (cachedCmd) {
            cachedCmd.isFavorite = newValue;
        }

        return newValue;
    }

    private findCommandSource(commandId: string, extensions: readonly vscode.Extension<any>[]): string {
        // Check if command belongs to VS Code core
        if (commandId.startsWith('vscode.') || commandId.startsWith('workbench.')) {
            return 'VS Code Core';
        }

        // 1. Primary: Check explicit contributions in package.json
        for (const ext of extensions) {
            const commands = ext.packageJSON.contributes?.commands || [];
            if (commands.some((c: any) => c.command === commandId)) {
                return ext.packageJSON.displayName || ext.packageJSON.name;
            }
        }

        // 2. Secondary: Check if command prefix matches extension name or short ID
        for (const ext of extensions) {
            const prefix = commandId.split('.')[0];
            const extIdParts = ext.id.split('.');
            const shortId = extIdParts.length > 1 ? extIdParts[1] : extIdParts[0];

            if (ext.packageJSON.name === prefix || shortId === prefix) {
                return ext.packageJSON.displayName || ext.packageJSON.name;
            }
        }

        return 'Unknown';
    }

    async searchCommands(query: string): Promise<CommandInfo[]> {
        const allCommands = await this.getAllCommands();
        const lowerQuery = query.toLowerCase();

        return allCommands.filter(cmd =>
            cmd.id.toLowerCase().includes(lowerQuery) ||
            cmd.title?.toLowerCase().includes(lowerQuery) ||
            cmd.source?.toLowerCase().includes(lowerQuery)
        );
    }

    async getCommandsByExtension(extensionId: string): Promise<CommandInfo[]> {
        const allCommands = await this.getAllCommands();
        return allCommands.filter(cmd => cmd.source === extensionId);
    }

    /**
     * Finds commands that are registered at runtime but missing from package.json.
     * Useful for finding internal commands that might need documentation or cleanup.
     */
    async getUnmappedRuntimeCommands(): Promise<CommandInfo[]> {
        const allCommands = await this.getAllCommands();
        const unmapped: CommandInfo[] = [];

        for (const cmd of allCommands) {
            const sourceExt = vscode.extensions.all.find(ext =>
                ext.packageJSON.contributes?.commands?.some((c: any) => c.command === cmd.id)
            );

            if (!sourceExt && cmd.source !== 'VS Code Core' && !cmd.isInternal) {
                unmapped.push(cmd);
            }
        }
        return unmapped;
    }

    /**
     * Utility to wrap command handlers for performance profiling.
     * Use this in your extension projects to track execution metrics.
     */
    public static wrapCommand(commandId: string, handler: (...args: any[]) => any): (...args: any[]) => Promise<any> {
        return async (...args: any[]) => {
            const start = Date.now();
            try {
                const result = await Promise.resolve(handler(...args));
                return result;
            } catch (err) {
                console.error(`[ExtensionLens] Command ${commandId} failed:`, err);
                throw err;
            } finally {
                const duration = Date.now() - start;
                if (duration > 100) {
                    console.warn(`[ExtensionLens] Slow command detected: ${commandId} took ${duration}ms`);

                    if (duration > 200 && this.conduitService) {
                        this.conduitService.logContribution(`PERF ALERT: Slow command detected: ${commandId} (${duration}ms)`);
                    }
                }
            }
        };
    }
}
