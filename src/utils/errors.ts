/**
 * Error types for classification
 */
export enum ErrorType {
    AUTH = 'AUTH',
    RATE_LIMIT = 'RATE_LIMIT',
    NETWORK = 'NETWORK',
    TOKEN_OVERFLOW = 'TOKEN_OVERFLOW',
    INVALID_INPUT = 'INVALID_INPUT',
    API_ERROR = 'API_ERROR',
    UNKNOWN = 'UNKNOWN',
}

/**
 * Structured error for Refinery operations
 */
export class RefineryError extends Error {
    public readonly type: ErrorType;
    public readonly retryable: boolean;
    public readonly suggestedAction: string;
    public readonly retryAfterMs?: number;

    constructor(
        message: string,
        type: ErrorType,
        retryable: boolean = false,
        suggestedAction: string = '',
        retryAfterMs?: number
    ) {
        super(message);
        this.name = 'RefineryError';
        this.type = type;
        this.retryable = retryable;
        this.suggestedAction = suggestedAction;
        this.retryAfterMs = retryAfterMs;
    }

    /**
     * Get user-friendly error message based on type
     */
    getUserMessage(): string {
        switch (this.type) {
            case ErrorType.AUTH:
                return '🔑 **Authentication Error**\n\nYour API key is invalid or expired.';
            case ErrorType.RATE_LIMIT:
                const waitTime = this.retryAfterMs 
                    ? `Wait ${Math.ceil(this.retryAfterMs / 1000 / 60)} minute(s) or `
                    : '';
                return `⏱️ **Rate Limited**\n\n${waitTime}try again later.`;
            case ErrorType.NETWORK:
                return '🌐 **Network Error**\n\nCould not connect to Gemini API. Check your internet connection.';
            case ErrorType.TOKEN_OVERFLOW:
                return '📏 **Prompt Too Large**\n\nYour input exceeds the model\'s token limit. Try a shorter prompt.';
            case ErrorType.INVALID_INPUT:
                return '⚠️ **Invalid Input**\n\nPlease provide a valid prompt to refine.';
            case ErrorType.API_ERROR:
                return '🔧 **API Error**\n\nGemini returned an unexpected error. Please try again.';
            default:
                return '❌ **Error**\n\nSomething went wrong. Please try again.';
        }
    }
}

/**
 * Classify an error from the Gemini API or network
 */
export function classifyError(error: unknown): RefineryError {
    if (error instanceof RefineryError) {
        return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    // Authentication errors
    if (
        lowerMessage.includes('api key') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('401') ||
        lowerMessage.includes('invalid key') ||
        lowerMessage.includes('permission denied')
    ) {
        return new RefineryError(
            errorMessage,
            ErrorType.AUTH,
            false,
            'Update your API key using the "Refinery: Set API Key" command.'
        );
    }

    // Rate limiting
    if (
        lowerMessage.includes('rate limit') ||
        lowerMessage.includes('429') ||
        lowerMessage.includes('quota') ||
        lowerMessage.includes('too many requests')
    ) {
        // Try to extract retry-after time if available
        const retryMatch = lowerMessage.match(/(\d+)\s*(second|minute|sec|min)/i);
        let retryAfterMs: number | undefined;
        
        if (retryMatch) {
            const value = parseInt(retryMatch[1], 10);
            const unit = retryMatch[2].toLowerCase();
            retryAfterMs = unit.startsWith('min') ? value * 60 * 1000 : value * 1000;
        } else {
            retryAfterMs = 60 * 1000; // Default 1 minute
        }

        return new RefineryError(
            errorMessage,
            ErrorType.RATE_LIMIT,
            true,
            'Wait a moment before trying again.',
            retryAfterMs
        );
    }

    // Network errors
    if (
        lowerMessage.includes('network') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('econnrefused') ||
        lowerMessage.includes('enotfound') ||
        lowerMessage.includes('fetch failed') ||
        lowerMessage.includes('failed to fetch')
    ) {
        return new RefineryError(
            errorMessage,
            ErrorType.NETWORK,
            true,
            'Check your internet connection and try again.'
        );
    }

    // Token/context length errors
    if (
        lowerMessage.includes('token') ||
        lowerMessage.includes('context length') ||
        lowerMessage.includes('too long') ||
        lowerMessage.includes('maximum')
    ) {
        return new RefineryError(
            errorMessage,
            ErrorType.TOKEN_OVERFLOW,
            false,
            'Shorten your prompt and try again.'
        );
    }

    // API errors (500s, etc.)
    if (
        lowerMessage.includes('500') ||
        lowerMessage.includes('502') ||
        lowerMessage.includes('503') ||
        lowerMessage.includes('internal server error') ||
        lowerMessage.includes('service unavailable')
    ) {
        return new RefineryError(
            errorMessage,
            ErrorType.API_ERROR,
            true,
            'The API is temporarily unavailable. Please try again.'
        );
    }

    // Default unknown error
    return new RefineryError(
        errorMessage,
        ErrorType.UNKNOWN,
        false,
        'An unexpected error occurred.'
    );
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 500,
    onRetry?: (attempt: number, error: RefineryError, delayMs: number) => void
): Promise<T> {
    let lastError: RefineryError | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = classifyError(error);

            // Don't retry non-retryable errors
            if (!lastError.retryable || attempt === maxRetries) {
                throw lastError;
            }

            // Calculate delay with exponential backoff
            const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
            
            if (onRetry) {
                onRetry(attempt, lastError, delayMs);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw lastError || new RefineryError('Unknown error', ErrorType.UNKNOWN);
}
