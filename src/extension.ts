import * as vscode from 'vscode';
import { registerChatParticipant } from './features/chatParticipant';
import { promptForApiKey } from './llm/geminiClient';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('Refinery is now active!');

    // Register the chat participant (@refine)
    registerChatParticipant(context);

    // Register the set API key command
    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.setApiKey', promptForApiKey)
    );
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    console.log('Refinery deactivated');
}
