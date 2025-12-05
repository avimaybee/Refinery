import * as vscode from 'vscode';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Available Gemini models
 */
export const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-3-pro-preview',
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number];

/**
 * Default model
 */
export const DEFAULT_MODEL: GeminiModel = 'gemini-2.5-flash';

/**
 * Get the API key from settings
 */
export function getApiKey(): string | undefined {
    const config = vscode.workspace.getConfiguration('refinery');
    return config.get<string>('apiKey');
}

/**
 * Get the selected model from settings
 */
export function getModel(): GeminiModel {
    const config = vscode.workspace.getConfiguration('refinery');
    const model = config.get<string>('model');

    if (model && GEMINI_MODELS.includes(model as GeminiModel)) {
        return model as GeminiModel;
    }

    return DEFAULT_MODEL;
}

/**
 * Prompt user to enter API key
 */
export async function promptForApiKey(): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
        title: 'Refinery Setup',
        prompt: 'Enter your Google AI Studio API key',
        placeHolder: 'AIza...',
        password: true,
        ignoreFocusOut: true,
    });

    if (apiKey) {
        const config = vscode.workspace.getConfiguration('refinery');
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('API key saved successfully!');
    }

    return apiKey;
}

/**
 * Validate that we have an API key, prompt if not
 */
export async function ensureApiKey(): Promise<string | null> {
    let apiKey = getApiKey();

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
 * Create a Gemini client with Google Search tool enabled
 */
export function createGeminiClient(apiKey: string): GenerativeModel {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = getModel();

    // Enable Google Search tool for grounding
    return genAI.getGenerativeModel({
        model,
        tools: [{
            googleSearch: {},
        } as any],
    });
}

/**
 * Send a prompt to Gemini and get the response
 */
export async function sendToGemini(
    prompt: string,
    apiKey: string
): Promise<string> {
    const model = createGeminiClient(apiKey);

    const result = await model.generateContent(prompt);
    const response = result.response;

    return response.text();
}

/**
 * Stream a prompt to Gemini with Google Search enabled
 */
export async function* streamFromGemini(
    prompt: string,
    apiKey: string
): AsyncGenerator<string> {
    const model = createGeminiClient(apiKey);

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
            yield text;
        }
    }
}
