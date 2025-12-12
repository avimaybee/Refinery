import * as vscode from 'vscode';
import { registerChatParticipant } from './features/chatParticipant';
import { initializeGeminiClient, promptForApiKey, selectModel } from './llm/geminiClient';
import { logger } from './utils/logger';
import { DashboardPanel } from './utils/dashboard';
import { getHistoryManager, HistoryTreeProvider, HistoryEntry } from './utils/historyManager';
import { PROMPT_TEMPLATES, getTemplateCategories } from './utils/templates';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('Refinery is now active!');

    // Initialize logger
    logger.initialize(context);

    // Initialize Gemini client
    initializeGeminiClient(context);

    // Initialize history manager
    const historyManager = getHistoryManager();
    historyManager.initialize(context);

    // Register the chat participant
    registerChatParticipant(context);

    // Create status bar item
    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBar.text = '$(tools) Refinery';
    statusBar.tooltip = 'Open Refinery Dashboard';
    statusBar.command = 'refinery.showDashboard';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Register history tree view
    const historyTreeProvider = new HistoryTreeProvider();
    vscode.window.registerTreeDataProvider('refinery.history', historyTreeProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.setApiKey', promptForApiKey),
        vscode.commands.registerCommand('refinery.selectModel', selectModel),
        vscode.commands.registerCommand('refinery.showLogs', () => logger.show()),
        vscode.commands.registerCommand('refinery.exportLogs', async () => {
            const filePath = await logger.exportLogs();
            if (filePath) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                await vscode.window.showTextDocument(doc);
            }
        }),
        vscode.commands.registerCommand('refinery.clearLogs', () => {
            logger.clearLogs();
            vscode.window.setStatusBarMessage('Logs cleared', 3000);
        }),
        vscode.commands.registerCommand('refinery.showDashboard', () => {
            DashboardPanel.createOrShow(context.extensionUri);
        }),
        vscode.commands.registerCommand('refinery.refineSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor. Select text to refine.');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (!selectedText || selectedText.trim().length === 0) {
                vscode.window.showWarningMessage('No text selected. Select text to refine.');
                return;
            }

            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: `@refine ${selectedText}`
            });

            logger.info('refine_selection_triggered', {
                textLength: selectedText.length,
                file: editor.document.fileName
            });
        }),

        // History commands
        vscode.commands.registerCommand('refinery.showHistory', () => {
            vscode.commands.executeCommand('refinery.history.focus');
        }),
        vscode.commands.registerCommand('refinery.clearHistory', () => {
            historyManager.clear();
            vscode.window.setStatusBarMessage('History cleared', 3000);
        }),
        vscode.commands.registerCommand('refinery.copyHistoryEntry', async (entry: HistoryEntry) => {
            if (entry?.refinedPrompt) {
                await vscode.env.clipboard.writeText(entry.refinedPrompt);
                vscode.window.setStatusBarMessage('Prompt copied to clipboard', 4000);
            }
        }),

        // Templates command
        vscode.commands.registerCommand('refinery.showTemplates', async () => {
            const categories = getTemplateCategories();
            const categoryPick = await vscode.window.showQuickPick(
                categories.map(c => ({
                    label: c.label,
                    description: `${PROMPT_TEMPLATES.filter(t => t.category === c.id).length} templates`,
                    id: c.id
                })),
                { placeHolder: 'Select a template category' }
            );

            if (!categoryPick) return;

            const templates = PROMPT_TEMPLATES.filter(t => t.category === categoryPick.id);
            const templatePick = await vscode.window.showQuickPick(
                templates.map(t => ({
                    label: t.name,
                    description: t.description,
                    detail: t.template,
                    template: t
                })),
                { placeHolder: 'Select a template', matchOnDetail: true }
            );

            if (!templatePick) return;

            // Open chat with the template
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: `@refine ${templatePick.template.template}`
            });
        })
    );

    logger.info('extension_activated', {
        commandsRegistered: [
            'setApiKey', 'selectModel', 'showLogs', 'exportLogs', 'clearLogs',
            'showDashboard', 'refineSelection', 'showHistory', 'clearHistory',
            'copyHistoryEntry', 'showTemplates'
        ]
    });
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    console.log('Refinery deactivated');
}
