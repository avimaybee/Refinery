import * as vscode from 'vscode';
import { buildPrompt } from '../llm/promptBuilder';
import { ensureApiKey, streamFromGemini } from '../llm/geminiClient';

/**
 * Chat participant ID
 */
const PARTICIPANT_ID = 'refinery.refine';

/**
 * Chat participant handler
 */
async function chatHandler(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
    const userInput = request.prompt;

    // Handle slash commands
    if (request.command === 'help') {
        stream.markdown('## 🔧 Refinery\n\n');
        stream.markdown('**Refine vague ideas into production-ready prompts.**\n\n');
        stream.markdown('Stop wasting API quota on follow-up prompts. Refinery enhances your requests so AI agents understand exactly what you need — the first time.\n\n');
        stream.markdown('---\n\n');
        stream.markdown('### How It Works\n\n');
        stream.markdown('1. Type `@refine` followed by your vague request\n');
        stream.markdown('2. Get a comprehensive, task-oriented prompt\n');
        stream.markdown('3. Copy and paste into your AI agent\n\n');
        stream.markdown('---\n\n');
        stream.markdown('### Examples\n\n');
        stream.markdown('| You Type | What You Get |\n');
        stream.markdown('|----------|-------------|\n');
        stream.markdown('| `make it look better` | Detailed visual improvements with specific values |\n');
        stream.markdown('| `add dark mode` | Complete implementation tasks with edge cases |\n');
        stream.markdown('| `fix the form` | Validation, UX, and accessibility requirements |\n');
        stream.markdown('| `make it premium` | Glassmorphism, animations, and design tokens |\n\n');
        stream.markdown('---\n\n');
        stream.markdown('### Settings\n\n');
        stream.markdown('- **API Key**: Run `Refinery: Set API Key` command\n');
        stream.markdown('- **Model**: Settings → Extensions → Refinery\n\n');
        stream.markdown('*Powered by Gemini with Google Search for latest best practices.*\n');
        return {};
    }

    if (!userInput.trim()) {
        stream.markdown('Type your vague prompt and I\'ll refine it for your AI agent.\n\n');
        stream.markdown('**Try:**\n');
        stream.markdown('- `@refine make it look better`\n');
        stream.markdown('- `@refine add dark mode`\n');
        return {};
    }

    // Ensure we have an API key
    const apiKey = await ensureApiKey();

    if (!apiKey) {
        stream.markdown('⚠️ **Setup Required**\n\n');
        stream.markdown('Get your free API key at [Google AI Studio](https://aistudio.google.com/apikey)\n\n');
        stream.markdown('Then run: `Refinery: Set API Key`');
        return {};
    }

    try {
        // Loading indicators
        stream.progress('🔍 Analyzing your request...');

        await new Promise(resolve => setTimeout(resolve, 300));

        if (token.isCancellationRequested) {
            return {};
        }

        stream.progress('🔧 Refining prompt with Gemini...');

        const targetModel = null;
        const prompt = buildPrompt(userInput, targetModel);

        // Stream the refined prompt
        let refinedPrompt = '';
        let isFirstChunk = true;

        for await (const chunk of streamFromGemini(prompt, apiKey)) {
            if (token.isCancellationRequested) {
                break;
            }

            // Show header on first chunk
            if (isFirstChunk) {
                stream.markdown('### 🔧 Refined Prompt\n\n');
                stream.markdown('```\n');
                isFirstChunk = false;
            }

            refinedPrompt += chunk;
            stream.markdown(chunk);
        }

        if (!isFirstChunk) {
            stream.markdown('\n```\n\n');
        }

        // Copy button
        stream.button({
            command: 'refinery.copyToClipboard',
            arguments: [refinedPrompt.trim()],
            title: '📋 Copy Prompt',
        });

        return {
            metadata: { refinedPrompt: refinedPrompt.trim() },
        };
    } catch (error) {
        if (error instanceof Error) {
            stream.markdown(`⚠️ **Error:** ${error.message}`);
        }
        return {};
    }
}

/**
 * Register the chat participant
 */
export function registerChatParticipant(context: vscode.ExtensionContext): void {
    const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, chatHandler);
    participant.iconPath = new vscode.ThemeIcon('tools');
    context.subscriptions.push(participant);

    context.subscriptions.push(
        vscode.commands.registerCommand('refinery.copyToClipboard', async (text: string) => {
            await vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage('🔧 Prompt copied! Paste it in your AI chat.');
        })
    );
}
