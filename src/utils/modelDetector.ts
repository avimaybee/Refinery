import * as vscode from 'vscode';

/**
 * Target AI model (user-specified)
 */
export interface TargetModel {
    name: string;
}

/**
 * Currently targeted model (set by user via /target command)
 */
let currentTarget: TargetModel | null = null;

/**
 * Set the target model
 */
export function setTargetModel(name: string): void {
    currentTarget = { name };
}

/**
 * Clear the target model
 */
export function clearTargetModel(): void {
    currentTarget = null;
}

/**
 * Get the current target model
 */
export function getTargetModel(): TargetModel | null {
    return currentTarget;
}

/**
 * Format model info for display
 */
export function formatModelInfo(model: TargetModel | null): string {
    if (!model) {
        return 'No target model specified';
    }
    return model.name;
}
