import * as vscode from 'vscode';

/**
 * Log levels
 */
export enum LogLevel {
    SILENT = -1,
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

/**
 * Log level names for display
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.SILENT]: 'SILENT',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
};

/**
 * Log entry structure
 */
interface LogEntry {
    timestamp: string;
    level: LogLevel;
    levelName: string;
    event: string;
    data?: Record<string, unknown>;
}

/**
 * Logger for Refinery extension
 * Uses VS Code's OutputChannel for visibility
 */
class Logger {
    private outputChannel: vscode.OutputChannel | null = null;
    private logLevel: LogLevel = LogLevel.INFO;
    private logHistory: LogEntry[] = [];
    private maxHistorySize: number = 1000;
    private apiCallCount: number = 0;
    private errorCount: number = 0;
    private cacheHits: number = 0;
    private cacheMisses: number = 0;
    private statusBarItem: vscode.StatusBarItem | null = null;
    private extensionContext: vscode.ExtensionContext | null = null;
    private refinementCount: number = 0;

    /**
     * Initialize the logger with an output channel
     */
    initialize(context: vscode.ExtensionContext): void {
        this.extensionContext = context;
        this.outputChannel = vscode.window.createOutputChannel('Refinery');
        context.subscriptions.push(this.outputChannel);

        // Load log level from settings
        this.loadLogLevelFromSettings();

        // Listen for settings changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('refinery.logLevel')) {
                    this.loadLogLevelFromSettings();
                }
            })
        );

        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'refinery.showDashboard';
        this.updateStatusBar();
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);

        this.info('logger_initialized', { level: LOG_LEVEL_NAMES[this.logLevel] });
    }

    /**
     * Load log level from VS Code settings
     */
    private loadLogLevelFromSettings(): void {
        const config = vscode.workspace.getConfiguration('refinery');
        const levelStr = config.get<string>('logLevel', 'INFO').toUpperCase();
        
        switch (levelStr) {
            case 'SILENT': this.logLevel = LogLevel.SILENT; break;
            case 'ERROR': this.logLevel = LogLevel.ERROR; break;
            case 'WARN': this.logLevel = LogLevel.WARN; break;
            case 'DEBUG': this.logLevel = LogLevel.DEBUG; break;
            default: this.logLevel = LogLevel.INFO;
        }
    }

    /**
     * Set the log level programmatically
     */
    setLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Get current log level
     */
    getLevel(): LogLevel {
        return this.logLevel;
    }

    /**
     * Format and write a log entry
     */
    private write(level: LogLevel, event: string, data?: Record<string, unknown>): void {
        // Check if level is above threshold (lower number = higher priority)
        if (this.logLevel === LogLevel.SILENT || level > this.logLevel) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            levelName: LOG_LEVEL_NAMES[level],
            event,
            data,
        };

        // Add to history
        this.logHistory.push(entry);
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }

        // Write to output channel
        if (this.outputChannel) {
            let line = `[${entry.timestamp}] ${entry.levelName.padEnd(5)} | ${event}`;
            
            if (data && Object.keys(data).length > 0) {
                // Sanitize sensitive data
                const sanitized = this.sanitizeData(data);
                const dataStr = Object.entries(sanitized)
                    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                    .join(' ');
                line += ` | ${dataStr}`;
            }

            this.outputChannel.appendLine(line);
        }
    }

    /**
     * Sanitize log data to remove sensitive information
     */
    private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
        const sanitized = { ...data };
        
        // Remove or mask sensitive keys
        const sensitiveKeys = ['apiKey', 'key', 'token', 'secret', 'password'];
        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }

    /**
     * Log debug message
     */
    debug(event: string, data?: Record<string, unknown>): void {
        this.write(LogLevel.DEBUG, event, data);
    }

    /**
     * Log info message
     */
    info(event: string, data?: Record<string, unknown>): void {
        this.write(LogLevel.INFO, event, data);
    }

    /**
     * Log warning message
     */
    warn(event: string, data?: Record<string, unknown>): void {
        this.write(LogLevel.WARN, event, data);
    }

    /**
     * Log error message
     */
    error(event: string, data?: Record<string, unknown>): void {
        this.errorCount++;
        this.updateStatusBar();
        this.write(LogLevel.ERROR, event, data);
    }

    /**
     * Log an API call
     */
    logApiCall(data: {
        model: string;
        inputLength: number;
        duration?: number;
        tokensOut?: number;
        cached?: boolean;
        error?: string;
    }): void {
        if (!data.cached) {
            this.apiCallCount++;
        }
        if (data.cached) {
            this.cacheHits++;
        } else if (!data.error) {
            this.cacheMisses++;
        }
        
        this.updateStatusBar();
        this.info('api_call', data);
    }

    /**
     * Log a cache operation
     */
    logCache(operation: 'hit' | 'miss' | 'set' | 'clear', key?: string): void {
        if (operation === 'hit') {
            this.cacheHits++;
        } else if (operation === 'miss') {
            this.cacheMisses++;
        }
        
        this.updateStatusBar();
        this.debug('cache_operation', { operation, key: key?.substring(0, 8) });
    }

    /**
     * Increment refinement count (for tips)
     */
    incrementRefinement(): void {
        this.refinementCount++;
        this.updateStatusBar();
    }

    /**
     * Get refinement count for tips
     */
    getRefinementCount(): number {
        return this.refinementCount;
    }

    /**
     * Show the output channel
     */
    show(): void {
        this.outputChannel?.show();
    }

    /**
     * Update the status bar item
     */
    private updateStatusBar(): void {
        if (!this.statusBarItem) {
            return;
        }

        const total = this.cacheHits + this.cacheMisses;
        const hitRate = total > 0 ? Math.round((this.cacheHits / total) * 100) : 0;

        if (this.errorCount > 0) {
            this.statusBarItem.text = `$(warning) Refinery: ${this.errorCount} error(s)`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = `$(tools) Refinery`;
            this.statusBarItem.backgroundColor = undefined;
        }

        this.statusBarItem.tooltip = new vscode.MarkdownString([
            '### 🔧 Refinery Statistics\n',
            `| Metric | Value |`,
            `|--------|-------|`,
            `| API Calls | ${this.apiCallCount} |`,
            `| Cache Hit Rate | ${hitRate}% (${this.cacheHits}/${total}) |`,
            `| Refinements | ${this.refinementCount} |`,
            `| Errors | ${this.errorCount} |`,
            `| Log Level | ${LOG_LEVEL_NAMES[this.logLevel]} |`,
            '',
            '**Click to open Dashboard**',
        ].join('\n'));
        this.statusBarItem.tooltip.isTrusted = true;
    }

    /**
     * Export logs to a file
     * @returns The file path where logs were saved, or undefined if cancelled
     */
    async exportLogs(): Promise<string | undefined> {
        if (this.logHistory.length === 0) {
            vscode.window.showInformationMessage('No logs to export.');
            return undefined;
        }

        const confirm = await vscode.window.showWarningMessage(
            'Export logs may contain API metadata (not API keys). Continue?',
            'Export',
            'Cancel'
        );

        if (confirm !== 'Export') {
            return undefined;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultUri = vscode.Uri.file(`refinery-logs-${timestamp}.json`);

        const uri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'JSON': ['json'] },
        });

        if (uri) {
            const content = JSON.stringify({
                exportedAt: new Date().toISOString(),
                stats: this.getStats(),
                entries: this.logHistory,
            }, null, 2);

            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
            vscode.window.showInformationMessage(`Logs exported to ${uri.fsPath}`);
            return uri.fsPath;
        }
        
        return undefined;
    }

    /**
     * Clear logs
     */
    clearLogs(): void {
        this.logHistory = [];
        this.outputChannel?.clear();
        vscode.window.showInformationMessage('Logs cleared.');
    }

    /**
     * Get log history
     */
    getLogHistory(): LogEntry[] {
        return [...this.logHistory];
    }

    /**
     * Get current stats
     */
    getStats(): {
        apiCalls: number;
        errors: number;
        cacheHits: number;
        cacheMisses: number;
        hitRate: string;
        refinements: number;
        logLevel: string;
    } {
        const total = this.cacheHits + this.cacheMisses;
        const hitRate = total > 0 ? `${Math.round((this.cacheHits / total) * 100)}%` : '0%';

        return {
            apiCalls: this.apiCallCount,
            errors: this.errorCount,
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            hitRate,
            refinements: this.refinementCount,
            logLevel: LOG_LEVEL_NAMES[this.logLevel],
        };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.apiCallCount = 0;
        this.errorCount = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.refinementCount = 0;
        this.updateStatusBar();
        this.info('stats_reset');
    }
}

// Singleton instance
export const logger = new Logger();
