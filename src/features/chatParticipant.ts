import * as vscode from 'vscode';
import { buildPrompt } from '../llm/promptBuilder';
import { ensureApiKey, streamFromGemini, getModel } from '../llm/geminiClient';
import { getProjectContext } from '../context/projectScanner';
import { getActiveFileContext } from '../context/fileUtils';
import { getCacheManager } from '../utils/cacheManager';
import { validateTokenCount } from '../utils/tokenCounter';
import { RefineryError, ErrorType } from '../utils/errors';
import { logger } from '../utils/logger';
import { getHistoryManager } from '../utils/historyManager';
import { PROMPT_TEMPLATES, getTemplateCategories } from '../utils/templates';

/**
 * Chat participant ID
 */
const PARTICIPANT_ID = 'refinery.refine';

/**
 * Helpful tips shown periodically
 */
const TIPS = [
    '**Tip:** Press `Ctrl+Shift+R` to refine selected text.',
    '**Tip:** Right-click selected text to refine it.',
    '**Tip:** Use `/templates` for common prompt patterns.',
    '**Tip:** Use `/history` to see past refinements.',
    '**Tip:** Refinery auto-detects your project framework.',
    '**Tip:** Open the Dashboard with `Ctrl+Alt+R`.',
];

/**
 * Warning prefix pattern used by the LLM for vague prompts
 */
const WARNING_PATTERN = /^⚠️\s*\*\*Your prompt is vague\.\*\*[^\n]*\n+/;

/**
 * Separate the warning indicator from the actual prompt content
 */
function separateWarningFromPrompt(fullText: string): { warning: string | null; promptContent: string } {
    const match = fullText.match(WARNING_PATTERN);
    if (match) {
        return {
            warning: match[0].trim(),
            promptContent: fullText.slice(match[0].length).trim()
        };
    }
    return { warning: null, promptContent: fullText };
}

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

    // Handle /templates command
    if (request.command === 'templates') {
        showTemplatesMessage(stream);
        return {};
    }

    // Handle /history command
    if (request.command === 'history') {
        showHistoryMessage(stream);
        return {};
    }

    if (!userInput.trim()) {
        showWelcomeMessage(stream);
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
        stream.progress('Refining your prompt...');

        // Gather project context
        const projectContext = await getProjectContext();
        const fileContext = await getActiveFileContext();

        if (token.isCancellationRequested) {
            return {};
        }

        // Build the full prompt (simplified - just enhance the text)
        const fullPrompt = buildPrompt(userInput);
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
        });
        const cacheKey = cacheManager.hash(userInput, currentGeminiModel, contextHash);
        const cachedResult = cacheManager.get(cacheKey);

        if (cachedResult) {
            logger.logCache('hit', cacheKey);

            // Separate warning from actual prompt content
            const { warning, promptContent } = separateWarningFromPrompt(cachedResult);

            if (warning) {
                stream.markdown(`${warning}\n\n`);
            }

            stream.markdown('### 🔧 Refined Prompt ✨ *cached*\n\n');
            stream.markdown('```\n');
            stream.markdown(promptContent);
            stream.markdown('\n```\n\n');

            showContextInfo(stream, projectContext?.framework);

            stream.button({
                command: 'refinery.copyToClipboard',
                arguments: [promptContent.trim()],
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
            if (chunkCount % 5 === 0) {
                stream.progress(`Generating... ${chars} characters`);
            }
        };

        for await (const chunk of streamFromGemini(fullPrompt, apiKey, onProgress)) {
            if (token.isCancellationRequested) {
                break;
            }

            if (isFirstChunk) {
                stream.markdown('### Refined Prompt\n\n');
                stream.markdown('> ');
                isFirstChunk = false;
            }

            refinedPrompt += chunk;
            stream.markdown(chunk);
        }

        if (!isFirstChunk) {
            stream.markdown('\n\n');
        }

        // Cache the result
        if (refinedPrompt.trim()) {
            cacheManager.set(cacheKey, refinedPrompt.trim(), currentGeminiModel, userInput.length);
            logger.logCache('set', cacheKey);
        }

        showContextInfo(stream, projectContext?.framework);

        // Separate warning from actual prompt content for the copy button
        const { promptContent } = separateWarningFromPrompt(refinedPrompt);

        // Add to history
        const historyManager = getHistoryManager();
        historyManager.add(userInput, promptContent, currentGeminiModel, projectContext?.framework || undefined);

        stream.button({
            command: 'refinery.copyToClipboard',
            arguments: [promptContent.trim()],
            title: 'Copy Prompt',
        });

        const duration = Date.now() - startTime;

        // Record refinement and possibly show tip
        logger.incrementRefinement();
        showTipIfDue(stream);

        logger.info('refinement_complete', {
            duration,
            inputLength: userInput.length,
            outputLength: refinedPrompt.length,
        });

        return { metadata: { duration } };
    } catch (error) {
        return handleError(error, stream);
    }
}

/**
 * Show welcome message when no input
 */
function showWelcomeMessage(stream: vscode.ChatResponseStream): void {
    stream.markdown('## Welcome to Refinery\n\n');
    stream.markdown('Transform vague ideas into clear, actionable prompts.\n\n');
    stream.markdown('### Try:\n');
    stream.markdown('- `@refine make the UI look better`\n');
    stream.markdown('- `@refine add a contact form`\n');
    stream.markdown('- `@refine refactor this function`\n\n');
    stream.markdown('**Tip:** Use `/templates` for quick-start patterns.');
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
    stream.markdown('## Refinery\n\n');
    stream.markdown('**Transform vague ideas into clear, outcome-focused prompts.**\n\n');

    stream.markdown('### Getting Started\n');
    stream.markdown('1. Type `@refine` followed by your vague idea\n');
    stream.markdown('2. If you see `[option1 / option2]`, remove what you don\'t want\n');
    stream.markdown('3. Copy the refined prompt to your AI coding agent\n\n');

    stream.markdown('---\n\n');
    stream.markdown('### Commands\n\n');
    stream.markdown('| Command | Description |\n');
    stream.markdown('|---------|-------------|\n');
    stream.markdown('| `@refine [prompt]` | Refine your vague prompt |\n');
    stream.markdown('| `@refine /templates` | Browse prompt templates |\n');
    stream.markdown('| `@refine /history` | View recent refinements |\n');
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
    stream.markdown('@refine fix the form validation\n');
    stream.markdown('```\n\n');

    stream.markdown('---\n\n');
    stream.markdown('*Built on [Anthropic\'s prompt engineering research](https://www.anthropic.com/engineering/claude-code-best-practices)*');
}

/**
 * Show templates message
 */
function showTemplatesMessage(stream: vscode.ChatResponseStream): void {
    stream.markdown('## Prompt Templates\n\n');
    stream.markdown('Quick-start templates for common tasks:\n\n');

    const categories = getTemplateCategories();
    for (const category of categories) {
        const templates = PROMPT_TEMPLATES.filter(t => t.category === category.id);
        stream.markdown(`### ${category.label}\n\n`);

        for (const template of templates.slice(0, 3)) {
            stream.markdown(`**${template.name}**\n`);
            stream.markdown(`\`${template.template.substring(0, 60)}...\`\n\n`);
        }
    }

    stream.markdown('---\n\n');
    stream.markdown('Run `Refinery: Browse Templates` for the full list.');
}

/**
 * Show history message
 */
function showHistoryMessage(stream: vscode.ChatResponseStream): void {
    stream.markdown('## Refinement History\n\n');

    const historyManager = getHistoryManager();
    const entries = historyManager.getRecent(5);

    if (entries.length === 0) {
        stream.markdown('No refinements yet. Try refining a prompt!\n\n');
        stream.markdown('Example: `@refine add a contact form`');
        return;
    }

    stream.markdown(`Showing last ${entries.length} refinements:\n\n`);

    for (const entry of entries) {
        const preview = entry.originalPrompt.length > 50
            ? entry.originalPrompt.substring(0, 50) + '...'
            : entry.originalPrompt;
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        stream.markdown(`**${timeStr}** - ${preview}\n\n`);
    }

    stream.markdown('---\n\n');
    stream.markdown('View full history in the Refinery sidebar.');
}

/**
 * Show context information
 */
function showContextInfo(
    stream: vscode.ChatResponseStream,
    framework: string | null | undefined
): void {
    if (framework) {
        stream.markdown(`*Project: **${framework}***\n\n`);
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
            // Auto-dismiss after 4 seconds using status bar message
            vscode.window.setStatusBarMessage('🔧 Prompt copied to clipboard!', 4000);
            logger.info('prompt_copied', { length: text.length });
        })
    );
}
