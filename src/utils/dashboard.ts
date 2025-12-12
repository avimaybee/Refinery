import * as vscode from 'vscode';
import { logger } from './logger';
import { getCacheManager, resetCacheManager } from './cacheManager';

/**
 * Dashboard webview panel for Refinery settings and stats
 */
export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        // Set initial content
        this.update();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            (message) => this.handleMessage(message),
            null,
            this.disposables
        );

        // Handle disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Update content periodically
        const interval = setInterval(() => {
            if (this.panel.visible) {
                this.update();
            }
        }, 5000);

        this.disposables.push({ dispose: () => clearInterval(interval) });
    }

    /**
     * Create or show the dashboard panel
     */
    public static createOrShow(extensionUri: vscode.Uri): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If panel exists, show it
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel.panel.reveal(column);
            DashboardPanel.currentPanel.update();
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'refineryDashboard',
            '🔧 Refinery Dashboard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
    }

    /**
     * Handle messages from webview
     */
    private async handleMessage(message: { command: string }): Promise<void> {
        switch (message.command) {
            case 'clearCache':
                resetCacheManager();
                logger.info('cache_cleared_from_dashboard');
                vscode.window.showInformationMessage('Cache cleared!');
                this.update();
                break;

            case 'resetStats':
                logger.resetStats();
                vscode.window.showInformationMessage('Statistics reset!');
                this.update();
                break;

            case 'exportLogs':
                vscode.commands.executeCommand('refinery.exportLogs');
                break;

            case 'showLogs':
                vscode.commands.executeCommand('refinery.showLogs');
                break;

            case 'setApiKey':
                vscode.commands.executeCommand('refinery.setApiKey');
                break;

            case 'selectModel':
                vscode.commands.executeCommand('refinery.selectModel');
                break;

            case 'refresh':
                this.update();
                break;
        }
    }

    /**
     * Update webview content
     */
    private update(): void {
        const stats = logger.getStats();
        const cacheStats = getCacheManager().getStats();
        const config = vscode.workspace.getConfiguration('refinery');
        const currentModel = config.get<string>('model', 'gemini-2.5-flash');
        const logLevel = config.get<string>('logLevel', 'INFO');

        this.panel.webview.html = this.getHtmlContent(stats, cacheStats, currentModel, logLevel);
    }

    /**
     * Get HTML content for the webview
     */
    private getHtmlContent(
        stats: ReturnType<typeof logger.getStats>,
        cacheStats: { size: number; hits: number; misses: number; hitRate: string },
        currentModel: string,
        logLevel: string
    ): string {
        const total = cacheStats.hits + cacheStats.misses;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Refinery Dashboard</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --text-primary: var(--vscode-editor-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-hover: var(--vscode-button-hoverBackground);
            --border: var(--vscode-panel-border);
            --success: #4caf50;
            --warning: #ff9800;
            --error: #f44336;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 24px;
            line-height: 1.6;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }

        .header h1 {
            font-size: 24px;
            font-weight: 600;
        }

        .header .refresh-btn {
            margin-left: auto;
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-primary);
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .header .refresh-btn:hover {
            background: var(--bg-secondary);
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
        }

        .card-title {
            font-size: 12px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .card-value {
            font-size: 28px;
            font-weight: 600;
        }

        .card-value.success { color: var(--success); }
        .card-value.warning { color: var(--warning); }
        .card-value.error { color: var(--error); }

        .card-subtitle {
            font-size: 12px;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        .section {
            margin-bottom: 24px;
        }

        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .config-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-bottom: 8px;
        }

        .config-label {
            font-weight: 500;
        }

        .config-value {
            color: var(--text-secondary);
            font-family: monospace;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 24px;
        }

        .btn {
            padding: 10px 20px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
        }

        .btn-primary {
            background: var(--accent);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
            background: var(--accent-hover);
        }

        .btn-secondary {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-primary);
        }

        .btn-secondary:hover {
            background: var(--bg-secondary);
        }

        .btn-danger {
            background: var(--error);
            color: white;
        }

        .btn-danger:hover {
            opacity: 0.9;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: var(--border);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 8px;
        }

        .progress-fill {
            height: 100%;
            background: var(--success);
            transition: width 0.3s;
        }

        .tip {
            background: var(--bg-secondary);
            border-left: 3px solid var(--accent);
            padding: 12px 16px;
            border-radius: 0 8px 8px 0;
            margin-top: 24px;
        }

        .tip-title {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .tip-content {
            color: var(--text-secondary);
            font-size: 14px;
        }

        code {
            background: var(--bg-primary);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="header">
        <span style="font-size: 28px;">🔧</span>
        <h1>Refinery Dashboard</h1>
        <button class="refresh-btn" onclick="refresh()">↻ Refresh</button>
    </div>

    <div class="grid">
        <div class="card">
            <div class="card-title">API Calls</div>
            <div class="card-value">${stats.apiCalls}</div>
            <div class="card-subtitle">Total requests to Gemini</div>
        </div>

        <div class="card">
            <div class="card-title">Cache Hit Rate</div>
            <div class="card-value success">${cacheStats.hitRate}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${cacheStats.hitRate}"></div>
            </div>
            <div class="card-subtitle">${cacheStats.hits} hits / ${total} total</div>
        </div>

        <div class="card">
            <div class="card-title">Cache Size</div>
            <div class="card-value">${cacheStats.size}</div>
            <div class="card-subtitle">Cached refinements</div>
        </div>

        <div class="card">
            <div class="card-title">Errors</div>
            <div class="card-value ${stats.errors > 0 ? 'error' : ''}">${stats.errors}</div>
            <div class="card-subtitle">Total errors logged</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">⚙️ Configuration</div>
        
        <div class="config-row">
            <span class="config-label">Gemini Model</span>
            <span class="config-value">${currentModel}</span>
        </div>

        <div class="config-row">
            <span class="config-label">Log Level</span>
            <span class="config-value">${logLevel}</span>
        </div>
    </div>

    <div class="section">
        <div class="section-title">🚀 Quick Actions</div>
        
        <div class="actions">
            <button class="btn btn-primary" onclick="setApiKey()">🔑 Set API Key</button>
            <button class="btn btn-primary" onclick="selectModel()">🤖 Select Model</button>
            <button class="btn btn-secondary" onclick="showLogs()">📋 View Logs</button>
            <button class="btn btn-secondary" onclick="exportLogs()">💾 Export Logs</button>
            <button class="btn btn-secondary" onclick="clearCache()">🗑️ Clear Cache</button>
            <button class="btn btn-danger" onclick="resetStats()">↺ Reset Stats</button>
        </div>
    </div>

    <div class="tip">
        <div class="tip-title">💡 Pro Tip</div>
        <div class="tip-content">
            Use <code>Ctrl+Shift+R</code> to instantly refine selected text without opening chat.
        </div>
    </div>

    <div class="tip" style="margin-top: 16px;">
        <div class="tip-title">📚 Built on Research</div>
        <div class="tip-content">
            Refinery's prompts are engineered using best practices from 
            <a href="https://www.anthropic.com/engineering/claude-code-best-practices" style="color: var(--accent);">Anthropic's Claude Code research</a> 
            and <a href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices" style="color: var(--accent);">Claude 4 prompt engineering guidelines</a>.
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function clearCache() { vscode.postMessage({ command: 'clearCache' }); }
        function resetStats() { vscode.postMessage({ command: 'resetStats' }); }
        function exportLogs() { vscode.postMessage({ command: 'exportLogs' }); }
        function showLogs() { vscode.postMessage({ command: 'showLogs' }); }
        function setApiKey() { vscode.postMessage({ command: 'setApiKey' }); }
        function selectModel() { vscode.postMessage({ command: 'selectModel' }); }
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
    </script>
</body>
</html>`;
    }

    /**
     * Dispose of the panel
     */
    public dispose(): void {
        DashboardPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
