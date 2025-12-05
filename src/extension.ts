import * as vscode from 'vscode';
import { registerChatParticipant } from './features/chatParticipant';
import { initializeGeminiClient, promptForApiKey, selectModel } from './llm/geminiClient';
import { logger } from './utils/logger';
import { DashboardPanel } from './utils/dashboard';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('Refinery is now active!');

    // Initialize logger (creates OutputChannel and status bar)
    logger.initialize(context);

    // Initialize Gemini client with extension context (for SecretStorage)
    initializeGeminiClient(context);

    // Register the chat participant (@refine)
    registerChatParticipant(context);

    // Register the set API key command
    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.setApiKey', promptForApiKey)
    );

    // Register the select model command
    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.selectModel', selectModel)
    );

    // Register show logs command
    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.showLogs', () => {
            logger.show();
        })
    );

    // Register export logs command
    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.exportLogs', async () => {
            const filePath = await logger.exportLogs();
            if (filePath) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                await vscode.window.showTextDocument(doc);
            }
        })
    );

    // Register clear logs command
    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.clearLogs', () => {
            logger.clearLogs();
            vscode.window.showInformationMessage('Refinery logs cleared!');
        })
    );

    // Register dashboard command
    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.showDashboard', () => {
            DashboardPanel.createOrShow(context.extensionUri);
        })
    );

    // Register refine selection command (keyboard shortcut)
    context.subscriptions.push(
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

            // Open Copilot Chat with @refine and the selected text
            // Use the VS Code command to open the chat panel with pre-filled text
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: `@refine ${selectedText}`
            });

            logger.info('refine_selection_triggered', { 
                textLength: selectedText.length,
                file: editor.document.fileName
            });
        })
    );

    logger.info('extension_activated', { 
        commandsRegistered: [
            'setApiKey', 
            'selectModel', 
            'showLogs', 
            'exportLogs', 
            'clearLogs', 
            'showDashboard', 
            'refineSelection'
        ]
    });
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    console.log('Refinery deactivated');
}
