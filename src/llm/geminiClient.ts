import * as vscode from 'vscode';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Default model
 */
export const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * API Key regex pattern for validation
 */
const API_KEY_PATTERN = /^AIza[0-9A-Za-z_-]{35}$/;

/**
 * Secret storage key
 */
const SECRET_KEY = 'refinery.apiKey';

/**
 * Extension context (set during activation)
 */
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Lazy-loaded Gemini AI client instance
 * Only initialized when first needed
 */
let geminiInstance: GoogleGenerativeAI | null = null;

/**
 * Track in-flight requests for deduplication
 */
const inFlightRequests: Map<string, Promise<string>> = new Map();

/**
 * Initialize the Gemini client with extension context
 * Must be called during extension activation
 * NOTE: This does NOT initialize the API client - that's lazy-loaded
 */
export function initializeGeminiClient(context: vscode.ExtensionContext): void {
    extensionContext = context;

    // Migrate from legacy config storage if exists
    migrateFromLegacyStorage();
}

/**
 * Migrate API key from legacy config to SecretStorage
 */
async function migrateFromLegacyStorage(): Promise<void> {
    if (!extensionContext) return;

    const config = vscode.workspace.getConfiguration('refinery');
    const legacyKey = config.get<string>('apiKey');

    if (legacyKey && legacyKey.trim()) {
        // Store in secrets
        await extensionContext.secrets.store(SECRET_KEY, legacyKey);

        // Remove from config (clear the legacy setting)
        await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);

        console.log('Refinery: Migrated API key to secure storage');
    }
}

/**
 * Get the API key from SecretStorage
 */
export async function getApiKey(): Promise<string | undefined> {
    if (!extensionContext) {
        console.warn('Refinery: Extension context not initialized');
        return undefined;
    }

    return await extensionContext.secrets.get(SECRET_KEY);
}

/**
 * Get the selected model from settings
 */
export function getModel(): string {
    const config = vscode.workspace.getConfiguration('refinery');
    return config.get<string>('model') || DEFAULT_MODEL;
}

/**
 * Set the model in settings
 */
export async function setModel(model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('refinery');
    await config.update('model', model, vscode.ConfigurationTarget.Global);
}

/**
 * Validate API key format
 */
export function validateApiKey(key: string): boolean {
    return API_KEY_PATTERN.test(key);
}

/**
 * Prompt user to enter API key with validation
 */
export async function promptForApiKey(): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
        title: 'Refinery Setup',
        prompt: 'Enter your Google AI Studio API key',
        placeHolder: 'AIza...',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || !value.trim()) {
                return 'API key is required';
            }
            if (!validateApiKey(value)) {
                return 'Invalid API key format. Should start with "AIza" followed by 35 characters.';
            }
            return null;
        }
    });

    if (apiKey && extensionContext) {
        // Store in SecretStorage (encrypted by OS)
        await extensionContext.secrets.store(SECRET_KEY, apiKey);
        vscode.window.showInformationMessage('🔐 API key saved securely!');
    }

    return apiKey;
}

/**
 * Validate that we have an API key, prompt if not
 */
export async function ensureApiKey(): Promise<string | null> {
    let apiKey = await getApiKey();

    if (!apiKey) {
        const action = await vscode.window.showWarningMessage(
            'Refinery requires a Google AI Studio API key.',
            'Enter API Key',
            'Get API Key'
        );

        if (action === 'Enter API Key') {
            apiKey = await promptForApiKey();
        } else if (action === 'Get API Key') {
            vscode.env.openExternal(vscode.Uri.parse('https://aistudio.google.com/apikey'));
            apiKey = await promptForApiKey();
        }
    }

    return apiKey || null;
}

/**
 * Fetch available models from Gemini API
 */
export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch models');
        }

        const data = await response.json() as {
            models: Array<{
                name: string;
                displayName: string;
                supportedGenerationMethods: string[]
            }>
        };

        // Filter for models that support generateContent
        return data.models
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .sort();
    } catch (error) {
        console.error('Failed to fetch models:', error);
        return [];
    }
}

/**
 * Show model picker and let user select
 */
export async function selectModel(): Promise<void> {
    const apiKey = await ensureApiKey();
    if (!apiKey) {
        return;
    }

    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching available models...',
    };

    const models = await vscode.window.withProgress(progressOptions, async () => {
        return await fetchAvailableModels(apiKey);
    });

    if (models.length === 0) {
        vscode.window.showErrorMessage('Could not fetch models. Check your API key.');
        return;
    }

    const currentModel = getModel();

    const selected = await vscode.window.showQuickPick(
        models.map(m => ({
            label: m,
            description: m === currentModel ? '(current)' : '',
        })),
        {
            title: 'Select Gemini Model',
            placeHolder: 'Choose a model...',
        }
    );

    if (selected) {
        await setModel(selected.label);
        vscode.window.showInformationMessage(`Model set to: ${selected.label}`);
    }
}

/**
 * Create a Gemini client with Google Search tool enabled
 * Uses lazy initialization - GoogleGenerativeAI is only created on first use
 */
export function createGeminiClient(apiKey: string): GenerativeModel {
    // Lazy initialize the Gemini AI instance
    if (!geminiInstance) {
        geminiInstance = new GoogleGenerativeAI(apiKey);
    }
    
    const model = getModel();

    // Enable Google Search tool for grounding
    return geminiInstance.getGenerativeModel({
        model,
        tools: [{
            googleSearch: {},
        } as any],
    });
}

/**
 * Reset the Gemini client (for API key changes)
 */
export function resetGeminiClient(): void {
    geminiInstance = null;
}

/**
 * Check if a request with the same key is already in-flight
 */
export function getInFlightRequest(key: string): Promise<string> | null {
    return inFlightRequests.get(key) || null;
}

/**
 * Register an in-flight request
 */
export function setInFlightRequest(key: string, promise: Promise<string>): void {
    inFlightRequests.set(key, promise);
}

/**
 * Clear an in-flight request
 */
export function clearInFlightRequest(key: string): void {
    inFlightRequests.delete(key);
}

/**
 * Stream a prompt to Gemini with Google Search enabled
 * Includes real-time progress tracking
 */
export async function* streamFromGemini(
    prompt: string,
    apiKey: string,
    onProgress?: (chars: number, estimatedPercent: number) => void
): AsyncGenerator<string> {
    const model = createGeminiClient(apiKey);

    const result = await model.generateContentStream(prompt);
    
    let totalChars = 0;
    const estimatedOutputChars = 2000; // Typical refined prompt length

    for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
            totalChars += text.length;
            
            // Call progress callback if provided
            if (onProgress) {
                const percent = Math.min(95, Math.round((totalChars / estimatedOutputChars) * 100));
                onProgress(totalChars, percent);
            }
            
            yield text;
        }
    }
}
