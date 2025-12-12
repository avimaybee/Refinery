import * as vscode from 'vscode';

/**
 * Represents a single refinement entry in history
 */
export interface HistoryEntry {
    id: string;
    timestamp: number;
    originalPrompt: string;
    refinedPrompt: string;
    model: string;
    framework?: string;
}

/**
 * Manages prompt history with in-memory storage
 * Persists to workspace state for session continuity
 */
export class HistoryManager {
    private static instance: HistoryManager;
    private history: HistoryEntry[] = [];
    private context?: vscode.ExtensionContext;
    private maxHistory = 50;
    private onDidChangeEmitter = new vscode.EventEmitter<void>();

    readonly onDidChange = this.onDidChangeEmitter.event;

    private constructor() { }

    static getInstance(): HistoryManager {
        if (!HistoryManager.instance) {
            HistoryManager.instance = new HistoryManager();
        }
        return HistoryManager.instance;
    }

    initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        this.loadHistory();
    }

    private loadHistory(): void {
        if (this.context) {
            this.history = this.context.workspaceState.get<HistoryEntry[]>('refinery.history', []);
        }
    }

    private saveHistory(): void {
        if (this.context) {
            this.context.workspaceState.update('refinery.history', this.history);
        }
    }

    /**
     * Add a new refinement to history
     */
    add(original: string, refined: string, model: string, framework?: string): HistoryEntry {
        const entry: HistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            originalPrompt: original,
            refinedPrompt: refined,
            model,
            framework,
        };

        this.history.unshift(entry);

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }

        this.saveHistory();
        this.onDidChangeEmitter.fire();

        return entry;
    }

    /**
     * Get all history entries
     */
    getAll(): HistoryEntry[] {
        return [...this.history];
    }

    /**
     * Get recent entries (last N)
     */
    getRecent(count: number = 10): HistoryEntry[] {
        return this.history.slice(0, count);
    }

    /**
     * Get a specific entry by ID
     */
    getById(id: string): HistoryEntry | undefined {
        return this.history.find(e => e.id === id);
    }

    /**
     * Get the last refinement (for undo)
     */
    getLastRefinement(): HistoryEntry | undefined {
        return this.history[0];
    }

    /**
     * Clear all history
     */
    clear(): void {
        this.history = [];
        this.saveHistory();
        this.onDidChangeEmitter.fire();
    }

    /**
     * Delete a specific entry
     */
    delete(id: string): void {
        this.history = this.history.filter(e => e.id !== id);
        this.saveHistory();
        this.onDidChangeEmitter.fire();
    }

    /**
     * Get history count
     */
    get count(): number {
        return this.history.length;
    }
}

/**
 * Tree data provider for history sidebar
 */
export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<HistoryTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private historyManager: HistoryManager;

    constructor() {
        this.historyManager = HistoryManager.getInstance();
        this.historyManager.onDidChange(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: HistoryTreeItem): Thenable<HistoryTreeItem[]> {
        if (element) {
            // Child items (show refined prompt preview)
            return Promise.resolve([]);
        }

        const entries = this.historyManager.getRecent(20);

        if (entries.length === 0) {
            return Promise.resolve([
                new HistoryTreeItem(
                    'No refinements yet',
                    'empty',
                    '',
                    vscode.TreeItemCollapsibleState.None
                )
            ]);
        }

        return Promise.resolve(
            entries.map(entry => {
                const preview = entry.originalPrompt.length > 40
                    ? entry.originalPrompt.substring(0, 40) + '...'
                    : entry.originalPrompt;
                const timeAgo = this.formatTimeAgo(entry.timestamp);

                return new HistoryTreeItem(
                    preview,
                    entry.id,
                    timeAgo,
                    vscode.TreeItemCollapsibleState.None,
                    entry
                );
            })
        );
    }

    private formatTimeAgo(timestamp: number): string {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
}

/**
 * Tree item for history entries
 */
export class HistoryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly entryId: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly entry?: HistoryEntry
    ) {
        super(label, collapsibleState);
        this.tooltip = entry?.refinedPrompt || 'No refinements yet';
        this.description = description;

        if (entry) {
            this.iconPath = new vscode.ThemeIcon('history');
            this.contextValue = 'historyEntry';
            this.command = {
                command: 'refinery.copyHistoryEntry',
                title: 'Copy Refined Prompt',
                arguments: [entry]
            };
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}

/**
 * Get singleton instance
 */
export function getHistoryManager(): HistoryManager {
    return HistoryManager.getInstance();
}
