import * as vscode from 'vscode';

export interface PerformanceMetrics {
    extensionActivations: ExtensionActivationMetric[];
    totalExtensions: number;
    activeExtensions: number;
    averageActivationTime: number;
}

export interface ExtensionActivationMetric {
    id: string;
    displayName: string;
    activationTime: number;
    isActive: boolean;
}

export class PerformanceMonitor {
    private activationMetrics: Map<string, ExtensionActivationMetric> = new Map();
    private monitoringInterval?: NodeJS.Timeout;
    private startTime: number;

    constructor(private context: vscode.ExtensionContext) {
        this.startTime = Date.now();
        this.captureInitialMetrics();
    }

    private captureInitialMetrics() {
        // Capture metrics for already-active extensions
        for (const ext of vscode.extensions.all) {
            if (ext.isActive) {
                this.recordActivation(ext);
            }
        }

        // Monitor future activations
        vscode.extensions.onDidChange(() => {
            for (const ext of vscode.extensions.all) {
                if (ext.isActive && !this.activationMetrics.has(ext.id)) {
                    this.recordActivation(ext);
                }
            }
        });
    }

    private recordActivation(ext: vscode.Extension<any>) {
        const now = Date.now();
        const metric: ExtensionActivationMetric = {
            id: ext.id,
            displayName: ext.packageJSON.displayName || ext.packageJSON.name,
            activationTime: now - this.startTime,
            isActive: true
        };
        this.activationMetrics.set(ext.id, metric);
    }

    public startMonitoring() {
        // Poll for updates every 10 seconds
        this.monitoringInterval = setInterval(() => {
            this.updateMetrics();
        }, 10000);
    }

    public stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }

    private updateMetrics() {
        // Update activation status
        for (const ext of vscode.extensions.all) {
            const existing = this.activationMetrics.get(ext.id);
            if (existing) {
                existing.isActive = ext.isActive;
            }
        }
    }

    public getMetrics(): PerformanceMetrics {
        const activations = Array.from(this.activationMetrics.values());
        const totalExtensions = vscode.extensions.all.length;
        const activeExtensions = vscode.extensions.all.filter(e => e.isActive).length;

        const avgTime = activations.length > 0
            ? activations.reduce((sum, m) => sum + m.activationTime, 0) / activations.length
            : 0;

        return {
            extensionActivations: activations.sort((a, b) => b.activationTime - a.activationTime),
            totalExtensions,
            activeExtensions,
            averageActivationTime: avgTime
        };
    }

    public getSlowestExtensions(count: number = 10): ExtensionActivationMetric[] {
        const metrics = this.getMetrics();
        return metrics.extensionActivations.slice(0, count);
    }
}
