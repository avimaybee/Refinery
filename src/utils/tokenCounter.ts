/**
 * Token estimation utilities
 * Uses heuristics - not exact but good enough for UI feedback
 */

/**
 * Default token limit (conservative estimate)
 */
const DEFAULT_TOKEN_LIMIT = 100000;

/**
 * Estimate token count from text
 * Uses heuristic: ~1.3 tokens per word for English text
 */
export function estimateTokens(text: string): number {
    if (!text || text.trim().length === 0) {
        return 0;
    }

    const words = text.trim().split(/\s+/).length;
    const punctuationCount = (text.match(/[.,!?;:'"()\[\]{}]/g) || []).length;

    return Math.ceil(words * 1.3 + punctuationCount * 0.5);
}

/**
 * Format token count for display (e.g., 1000 -> "1k", 1500000 -> "1.5M")
 */
export function formatTokenCount(tokens: number): string {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
    isValid: boolean;
    estimatedTokens: number;
    maxTokens: number;
    usagePercent: number;
    warning: string | null;
    error: string | null;
}

/**
 * Validate that the prompt is within reasonable limits
 * Note: Actual model limits vary. Run 'Refinery: Select Model' to pick your model.
 */
export function validateTokenCount(
    text: string,
    _model: string, // Model parameter kept for API compatibility but not used for limits
    warningThreshold: number = 0.8
): TokenValidationResult {
    const estimatedTokens = estimateTokens(text);
    const maxTokens = DEFAULT_TOKEN_LIMIT;
    const usagePercent = (estimatedTokens / maxTokens) * 100;

    let warning: string | null = null;
    let error: string | null = null;
    let isValid = true;

    if (usagePercent >= 100) {
        isValid = false;
        error = `Prompt may be too long: ~${formatTokenCount(estimatedTokens)} tokens`;
    } else if (usagePercent >= warningThreshold * 100) {
        warning = `Large prompt: ~${formatTokenCount(estimatedTokens)} tokens`;
    }

    return {
        isValid,
        estimatedTokens,
        maxTokens,
        usagePercent,
        warning,
        error,
    };
}

/**
 * Simple recommendation - just inform user they can change model
 * No longer auto-recommends based on prompt length
 */
export function recommendModel(_userInput: string): { model: string; reason: string } | null {
    // Removed auto-recommendations
    // User can run 'Refinery: Select Model' to pick any model they want
    return null;
}
