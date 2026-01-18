import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    source: string;
}

export class LogMonitor {
    private logWatcher?: vscode.FileSystemWatcher;

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Get the root log directory for this session
     */
    private getRootLogUri(): vscode.Uri | undefined {
        // Our logUri is something like .../logs/<session>/exthost1/extension.lens
        // We want to go up to .../logs/<session>/exthost1/
        try {
            const logPath = this.context.logUri.fsPath;
            const parentDir = path.dirname(logPath);
            return vscode.Uri.file(parentDir);
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Get all extensions that have logs in this session
     */
    public async getLoggedExtensions(): Promise<string[]> {
        const rootLogUri = this.getRootLogUri();
        if (!rootLogUri) return [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(rootLogUri);
            return entries
                .filter(([name, type]) => type === vscode.FileType.Directory)
                .map(([name]) => name);
        } catch (e) {
            return [];
        }
    }

    /**
     * Read logs for a specific extension
     */
    public async getLogs(extensionId: string): Promise<LogEntry[]> {
        const rootLogUri = this.getRootLogUri();
        if (!rootLogUri) return [];

        const extLogUri = vscode.Uri.joinPath(rootLogUri, extensionId);
        try {
            const entries = await vscode.workspace.fs.readDirectory(extLogUri);
            const logFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.log'))
                .map(([name]) => name);

            const allLogs: LogEntry[] = [];
            for (const file of logFiles) {
                const content = await this.readFile(vscode.Uri.joinPath(extLogUri, file));
                allLogs.push(...this.parseLogContent(content, extensionId));
            }

            return allLogs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        } catch (e) {
            return [];
        }
    }

    private async readFile(uri: vscode.Uri): Promise<string> {
        // Optimization: Read only the last 50KB to prevent OOM
        try {
            const filePath = uri.fsPath;
            const stats = await fs.promises.stat(filePath);
            const size = stats.size;
            const MAX_BYTES = 50 * 1024; // 50KB

            if (size <= MAX_BYTES) {
                const arr = await vscode.workspace.fs.readFile(uri);
                return Buffer.from(arr).toString('utf8');
            }

            const buffer = Buffer.alloc(MAX_BYTES);
            const fd = await fs.promises.open(filePath, 'r');
            await fd.read(buffer, 0, MAX_BYTES, size - MAX_BYTES);
            await fd.close();

            return '...[TRUNCATED]...\n' + buffer.toString('utf8');
        } catch (e) {
            return '';
        }
    }

    /**
     * Parses raw log content into structured LogEntry objects.
     * Handles multi-line log messages (stack traces).
     * @param content Raw string content of the log file
     * @param source Source identifier (e.g. extension ID)
     */
    private parseLogContent(content: string, source: string): LogEntry[] {
        const lines = content.split('\n');
        const entries: LogEntry[] = [];

        // Format: [2023-12-28 12:00:00.000] [exthost] [info] message
        const regExp = /^\[(.*?)\] \[(.*?)\] \[(.*?)\] (.*)$/;

        for (const line of lines) {
            const match = line.match(regExp);
            if (match) {
                entries.push({
                    timestamp: match[1],
                    source: match[2] === 'exthost' ? source : match[2],
                    level: this.normalizeLevel(match[3]),
                    message: match[4]
                });
            } else if (line.trim() && entries.length > 0) {
                // Multi-line stack trace or message
                entries[entries.length - 1].message += '\n' + line;
            }
        }

        return entries;
    }

    /**
     * Normalizes log levels to standard identifiers.
     * Maps 'err', 'trace' etc to 'error', 'debug'.
     */
    private normalizeLevel(level: string): 'info' | 'warn' | 'error' | 'debug' {
        level = level.toLowerCase();
        if (level.includes('err')) return 'error';
        if (level.includes('warn')) return 'warn';
        if (level.includes('debug') || level.includes('trace')) return 'debug';
        return 'info';
    }

    /**
     * Get all "error" logs from all extensions
     */
    public async getRecentErrors(limit: number = 50): Promise<LogEntry[]> {
        const rootLogUri = this.getRootLogUri();
        // DEBUG: Show where we are looking
        if (rootLogUri) {
            console.log(`ExtensionLens: Scanning logs at ${rootLogUri.fsPath}`);
            vscode.window.showInformationMessage(`ExtensionLens Scanning: ${rootLogUri.fsPath}`);
        } else {
            console.log('ExtensionLens: Could not determine root log URI');
        }

        const extensions = await this.getLoggedExtensions();
        let allErrors: LogEntry[] = [];

        for (const extId of extensions) {
            const logs = await this.getLogs(extId);
            allErrors.push(...logs.filter(l => l.level === 'error'));
        }

        return allErrors
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, limit);
    }
}
