import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

export class ConduitService {
    private bridgePath: string | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.findBridge();
    }

    /**
     * Locates the Conduit agent bridge script.
     * Checks workspace folders first, then safe sibling extension directories.
     */
    private findBridge() {
        // Sanitize suffix to prevent traversal
        const potentialBridgeSuffix = path.normalize(path.join('Conduit', 'Conduit', 'agent_bridge.js'));
        if (potentialBridgeSuffix.includes('..')) {
            console.error('[ExtensionLens] Invalid bridge suffix');
            return;
        }

        // 1. Check workspace folders (for development)
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                const workspacePotential = path.join(folder.uri.fsPath, potentialBridgeSuffix);
                // Extra safety check
                if (workspacePotential.startsWith(folder.uri.fsPath) && fs.existsSync(workspacePotential)) {
                    this.bridgePath = workspacePotential;
                    console.log(`[ExtensionLens] Conduit bridge found in workspace: ${this.bridgePath}`);
                    return;
                }
            }
        }

        // 2. Fallback: Look for sibling extensions in the system extensions folder
        try {
            const extPath = this.context.extensionPath;
            const rootPath = path.dirname(extPath);
            // In VS Code, extensions are often named "publisher.name-version"
            // We'll look for a folder starting with "nexgen-synapse.conduit"
            const files = fs.readdirSync(rootPath);
            const conduitExtDir = files.find(f => f.startsWith('nexgen-synapse.conduit'));

            if (conduitExtDir) {
                // Sanitize: Ensure we don't traverse up
                if (conduitExtDir.includes('..') || conduitExtDir.includes('/') || conduitExtDir.includes('\\')) {
                    console.warn('[ExtensionLens] Suspicious extension directory name skipped');
                } else {
                    const siblingPotential = path.join(rootPath, conduitExtDir, 'Conduit', 'agent_bridge.js');
                    if (fs.existsSync(siblingPotential)) {
                        this.bridgePath = siblingPotential;
                        console.log(`[ExtensionLens] Conduit bridge found in sibling extension: ${this.bridgePath}`);
                        return;
                    }
                }
            }

            // Legacy fallback (exact "Conduit" folder name)
            const legacyPotential = path.join(rootPath, 'Conduit', 'Conduit', 'agent_bridge.js');
            if (fs.existsSync(legacyPotential)) {
                this.bridgePath = legacyPotential;
                console.log(`[ExtensionLens] Conduit bridge found at legacy path: ${this.bridgePath}`);
                return;
            }

            console.warn(`[ExtensionLens] Conduit bridge NOT found. Please ensure Conduit is installed or open in the workspace.`);
        } catch (e) {
            console.error('[ExtensionLens] Error finding Conduit bridge:', e);
        }
    }

    /**
     * Executes the bridge script with the provided arguments.
     * @param args Command line arguments for the bridge
     * @returns Promise resolving to success status and output
     */
    private runBridge(args: string[]): Promise<{ success: boolean; output: string }> {
        return new Promise((resolve) => {
            if (!this.bridgePath) {
                resolve({ success: false, output: 'Bridge path not found' });
                return;
            }

            const command = `node "${this.bridgePath}" ${args.join(' ')}`;
            cp.exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[ExtensionLens] Conduit Bridge Error: ${error.message}`);
                    resolve({ success: false, output: stderr || error.message });
                } else {
                    resolve({ success: true, output: stdout });
                }
            });
        });
    }

    /**
     * Log a contribution (action)
     */
    public async logContribution(message: string): Promise<void> {
        await this.runBridge(['--agent', 'extensionlens', '--log', `"${message}"`]);
    }

    /**
     * Update agent status/intent
     */
    public async updateStatus(intent: string, status: 'idle' | 'working' | 'blocked' = 'working'): Promise<void> {
        await this.runBridge([
            '--agent', 'extensionlens',
            '--status', status,
            '--intent', `"${intent}"`
        ]);
    }

    /**
     * Add a plan/task to the Conduit queue
     */
    public async addPlan(task: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
        await this.runBridge([
            '--agent', 'extensionlens',
            '--add-plan', `"${task}"`,
            '--priority', priority
        ]);
    }

    /**
     * Learn a new rule/pattern
     */
    public async learn(rule: string): Promise<void> {
        await this.runBridge(['--agent', 'extensionlens', '--learn', `"${rule}"`]);
    }
}
