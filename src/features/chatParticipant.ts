import * as vscode from 'vscode';
import { buildPrompt } from '../llm/promptBuilder';
import { ensureApiKey, streamFromGemini, getModel } from '../llm/geminiClient';
import { getProjectContext } from '../context/projectScanner';
import { getActiveFileContext } from '../context/fileUtils';
import { getCacheManager } from '../utils/cacheManager';
import { validateTokenCount } from '../utils/tokenCounter';
import { RefineryError, ErrorType } from '../utils/errors';
import { logger } from '../utils/logger';
import { getTargetModel, setTargetModel, clearTargetModel, TargetModel } from '../utils/modelDetector';

/**
 * Chat participant ID
 */
const PARTICIPANT_ID = 'refinery.refine';

/**
 * Helpful tips shown periodically
 */
const TIPS = [
    '💡 **Tip:** Use `/target Claude` to optimize prompts for Claude.',
    '💡 **Tip:** Press `Ctrl+Shift+R` to refine selected text instantly!',
    '💡 **Tip:** Open the Dashboard with `Ctrl+Alt+R` to view stats.',
    '💡 **Tip:** Refinery automatically detects your project\'s framework.',
    '💡 **Tip:** Use `@refine /help` to see all available commands.',
    '💡 **Tip:** Your refined prompts are cached for faster reuse.',
    '💡 **Tip:** Check logs with `Refinery: Show Logs` if issues occur.',
    '💡 **Tip:** Prompts refined for specific AIs (Claude, GPT-4) work better!',
];

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
    const startTime = Date.now();

    // Handle /help command
    if (request.command === 'help') {
        showHelpMessage(stream);
        return {};
    }

    // Handle /target command - set target AI model
    if (request.command === 'target') {
        if (!userInput.trim()) {
            const current = getTargetModel();
            if (current) {
                stream.markdown(`**Current target:** ${current.name}\n\n`);
                stream.markdown('To change: `@refine /target Claude 3.5 Sonnet`\n');
                stream.markdown('To clear: `@refine /target clear`');
            } else {
                stream.markdown('**No target model set.**\n\n');
                stream.markdown('Set one: `@refine /target Claude 3.5 Sonnet`\n\n');
                stream.markdown('This helps optimize the refined prompt for your specific AI.');
            }
            return {};
        }

        if (userInput.trim().toLowerCase() === 'clear') {
            clearTargetModel();
            stream.markdown('✅ Target model cleared.');
            return {};
        }

        setTargetModel(userInput.trim());
        stream.markdown(`✅ Target set to: **${userInput.trim()}**\n\n`);
        stream.markdown('Refined prompts will now be optimized for this model.');
        return {};
    }

    if (!userInput.trim()) {
        stream.markdown('Type your vague prompt and I\'ll refine it.\n\n');
        stream.markdown('**Try:**\n');
        stream.markdown('- `@refine make it look better`\n');
        stream.markdown('- `@refine add dark mode`\n\n');
        stream.markdown('**Tip:** Use `/target` to set your AI model for optimized prompts.');
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
        stream.progress('🔧 Refining your prompt...');

        // Get target model (user-specified)
        const targetModel = getTargetModel();

        // Gather project context
        const projectContext = await getProjectContext();
        const fileContext = await getActiveFileContext();

        if (token.isCancellationRequested) {
            return {};
        }

        // Build the full prompt
        const fullPrompt = buildPrompt(userInput, targetModel, projectContext, fileContext || undefined);
        const currentGeminiModel = getModel();

        // Validate token count
        const tokenValidation = validateTokenCount(fullPrompt, currentGeminiModel);

        if (!tokenValidation.isValid) {
            stream.markdown(`⚠️ **${tokenValidation.error}**\n\n`);
            stream.markdown('Try shortening your prompt.');
            return {};
        }

        // Check cache
        const cacheManager = getCacheManager();
        const contextHash = JSON.stringify({
            project: projectContext?.framework,
            target: targetModel?.name,
        });
        const cacheKey = cacheManager.hash(userInput, currentGeminiModel, contextHash);
        const cachedResult = cacheManager.get(cacheKey);

        if (cachedResult) {
            logger.logCache('hit', cacheKey);
            stream.markdown('### 🔧 Refined Prompt ✨ *cached*\n\n');
            stream.markdown('```\n');
            stream.markdown(cachedResult);
            stream.markdown('\n```\n\n');

            showContextInfo(stream, targetModel, projectContext?.framework);

            stream.button({
                command: 'refinery.copyToClipboard',
                arguments: [cachedResult.trim()],
                title: '📋 Copy Prompt',
            });
            
            // Record refinement for tips
            logger.incrementRefinement();

            return { metadata: { cached: true } };
        }

        logger.logCache('miss', cacheKey);

        // Stream the refined prompt with progress tracking
        let refinedPrompt = '';
        let isFirstChunk = true;
        let chunkCount = 0;

        // Progress callback for streaming
        const onProgress = (chars: number) => {
            chunkCount++;
            if (chunkCount % 5 === 0) { // Update every 5 chunks
                stream.progress(`🔧 Generating... ${chars} characters`);
            }
        };

        for await (const chunk of streamFromGemini(fullPrompt, apiKey, onProgress)) {
            if (token.isCancellationRequested) {
                break;
            }

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

        // Cache the result
        if (refinedPrompt.trim()) {
            cacheManager.set(cacheKey, refinedPrompt.trim(), currentGeminiModel, userInput.length);
            logger.logCache('set', cacheKey);
        }

        showContextInfo(stream, targetModel, projectContext?.framework);

        stream.button({
            command: 'refinery.copyToClipboard',
            arguments: [refinedPrompt.trim()],
            title: '📋 Copy Prompt',
        });

        const duration = Date.now() - startTime;
        
        // Record refinement and possibly show tip
        logger.incrementRefinement();
        showTipIfDue(stream);
        
        logger.info('refinement_complete', {
            duration,
            inputLength: userInput.length,
            outputLength: refinedPrompt.length,
            target: targetModel?.name,
        });

        return { metadata: { duration } };
    } catch (error) {
        return handleError(error, stream);
    }
}

/**
 * Show a helpful tip if interval reached
 */
function showTipIfDue(stream: vscode.ChatResponseStream): void {
    const config = vscode.workspace.getConfiguration('refinery');
    const showTips = config.get<boolean>('showTips', true);
    
    if (!showTips) {
        return;
    }
    
    const interval = config.get<number>('tipsInterval', 5);
    const stats = logger.getStats();
    
    if (stats.refinements > 0 && stats.refinements % interval === 0) {
        const tipIndex = Math.floor(stats.refinements / interval) % TIPS.length;
        stream.markdown(`\n---\n\n${TIPS[tipIndex]}\n`);
    }
}

/**
 * Show help message
 */
function showHelpMessage(stream: vscode.ChatResponseStream): void {
    stream.markdown('## 🔧 Refinery\n\n');
    stream.markdown('**Refine vague requests into clear, outcome-focused prompts.**\n\n');
    stream.markdown('---\n\n');
    stream.markdown('### Commands\n\n');
    stream.markdown('| Command | Description |\n');
    stream.markdown('|---------|-------------|\n');
    stream.markdown('| `@refine [prompt]` | Refine your vague prompt |\n');
    stream.markdown('| `@refine /target [model]` | Set target AI (e.g., Claude, GPT-4) |\n');
    stream.markdown('| `@refine /target clear` | Clear target model |\n');
    stream.markdown('| `@refine /help` | Show this help |\n\n');
    stream.markdown('---\n\n');
    stream.markdown('### Keyboard Shortcuts\n\n');
    stream.markdown('| Shortcut | Action |\n');
    stream.markdown('|----------|--------|\n');
    stream.markdown('| `Ctrl+Shift+R` | Refine selected text |\n');
    stream.markdown('| `Ctrl+Alt+R` | Open Dashboard |\n\n');
    stream.markdown('---\n\n');
    stream.markdown('### Examples\n\n');
    stream.markdown('```\n');
    stream.markdown('@refine make it look better\n');
    stream.markdown('@refine add dark mode\n');
    stream.markdown('@refine /target Claude 3.5 Sonnet\n');
    stream.markdown('```\n\n');
    stream.markdown('---\n\n');
    stream.markdown('### Settings\n\n');
    stream.markdown('- `Refinery: Set API Key` - Store your Gemini API key\n');
    stream.markdown('- `Refinery: Select Model` - Choose Gemini model\n');
    stream.markdown('- `Refinery: Show Logs` - View logs\n');
    stream.markdown('- `Refinery: Open Dashboard` - View stats and quick actions\n');
}

/**
 * Show context information
 */
function showContextInfo(
    stream: vscode.ChatResponseStream,
    targetModel: TargetModel | null,
    framework: string | null | undefined
): void {
    const parts: string[] = [];

    if (targetModel) {
        parts.push(`🎯 Target: **${targetModel.name}**`);
    }

    if (framework) {
        parts.push(`📁 Project: **${framework}**`);
    }

    if (parts.length > 0) {
        stream.markdown(`*${parts.join(' • ')}*\n\n`);
    }
}

/**
 * Handle errors
 */
function handleError(error: unknown, stream: vscode.ChatResponseStream): vscode.ChatResult {
    if (error instanceof RefineryError) {
        stream.markdown(error.getUserMessage());

        if (error.type === ErrorType.AUTH) {
            stream.button({
                command: 'refinery.setApiKey',
                title: '🔑 Update API Key',
            });
        }

        logger.error('refinement_error', {
            type: error.type,
            message: error.message,
        });

        return { metadata: { error: error.type } };
    }

    const message = error instanceof Error ? error.message : String(error);
    stream.markdown(`⚠️ **Error:** ${message}`);

    logger.error('refinement_error', { message });

    return { metadata: { error: 'UNKNOWN' } };
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
            vscode.window.showInformationMessage('🔧 Prompt copied!');
            logger.info('prompt_copied', { length: text.length });
        })
    );
}
