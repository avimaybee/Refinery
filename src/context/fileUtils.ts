import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Context extracted from the active file
 */
export interface FileContext {
    relativePath: string;
    fileName: string;
    language: string;
    content: string;
    cursorLine: number;
    totalLines: number;
    wasTruncated: boolean;
}

/**
 * Maximum lines to include in context to avoid token overflow
 */
const MAX_LINES = 2000;
const HEADER_LINES = 100;
const CONTEXT_RADIUS = 25;

/**
 * Get context from the active editor
 */
export async function getActiveFileContext(): Promise<FileContext | null> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        return null;
    }

    const document = editor.document;
    const cursorLine = editor.selection.active.line;
    const totalLines = document.lineCount;

    // Get relative path
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const relativePath = workspaceFolder
        ? path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
        : document.fileName;

    let content: string;
    let wasTruncated = false;

    if (totalLines > MAX_LINES) {
        // Smart truncation: header + context around cursor
        content = getSmartTruncatedContent(document, cursorLine);
        wasTruncated = true;
    } else {
        content = document.getText();
    }

    return {
        relativePath,
        fileName: path.basename(document.fileName),
        language: document.languageId,
        content,
        cursorLine: cursorLine + 1, // 1-indexed for display
        totalLines,
        wasTruncated,
    };
}

/**
 * Smart truncation for large files
 * Returns: first 100 lines (header/imports) + 50 lines around cursor
 */
function getSmartTruncatedContent(
    document: vscode.TextDocument,
    cursorLine: number
): string {
    const lines: string[] = [];
    const totalLines = document.lineCount;

    // Add header (first 100 lines)
    const headerEnd = Math.min(HEADER_LINES, totalLines);
    for (let i = 0; i < headerEnd; i++) {
        lines.push(document.lineAt(i).text);
    }

    // Add separator if cursor context doesn't overlap with header
    const contextStart = Math.max(0, cursorLine - CONTEXT_RADIUS);
    const contextEnd = Math.min(totalLines - 1, cursorLine + CONTEXT_RADIUS);

    if (contextStart > headerEnd) {
        lines.push('');
        lines.push(`// ... [Lines ${headerEnd + 1} to ${contextStart} truncated] ...`);
        lines.push('');
    }

    // Add context around cursor (if not already included in header)
    const actualContextStart = Math.max(contextStart, headerEnd);
    for (let i = actualContextStart; i <= contextEnd; i++) {
        lines.push(document.lineAt(i).text);
    }

    // Add trailing indicator if there's more content
    if (contextEnd < totalLines - 1) {
        lines.push('');
        lines.push(`// ... [Lines ${contextEnd + 2} to ${totalLines} truncated] ...`);
    }

    return lines.join('\n');
}

/**
 * Get a specific line range from the active document
 */
export function getLineRange(
    document: vscode.TextDocument,
    startLine: number,
    endLine: number
): string {
    const lines: string[] = [];
    const actualEnd = Math.min(endLine, document.lineCount - 1);

    for (let i = startLine; i <= actualEnd; i++) {
        lines.push(document.lineAt(i).text);
    }

    return lines.join('\n');
}

/**
 * Get the comment style for a given language
 */
export function getCommentStyle(languageId: string): { single: string; blockStart: string; blockEnd: string } {
    switch (languageId) {
        case 'python':
        case 'ruby':
        case 'shell':
        case 'bash':
        case 'yaml':
            return { single: '#', blockStart: '"""', blockEnd: '"""' };

        case 'html':
        case 'xml':
        case 'markdown':
            return { single: '<!--', blockStart: '<!--', blockEnd: '-->' };

        case 'css':
        case 'scss':
        case 'less':
            return { single: '/*', blockStart: '/*', blockEnd: '*/' };

        case 'javascript':
        case 'typescript':
        case 'javascriptreact':
        case 'typescriptreact':
        case 'java':
        case 'csharp':
        case 'cpp':
        case 'c':
        case 'go':
        case 'rust':
        case 'swift':
        case 'kotlin':
        default:
            return { single: '//', blockStart: '/**', blockEnd: ' */' };
    }
}

/**
 * Format content as a block comment for the given language
 */
export function formatAsBlockComment(content: string, languageId: string): string {
    const style = getCommentStyle(languageId);

    if (languageId === 'python') {
        // Python docstring style
        return `${style.blockStart}\n${content}\n${style.blockEnd}`;
    }

    if (style.blockStart === '<!--') {
        // HTML/XML comment
        return `${style.blockStart}\n${content}\n${style.blockEnd}`;
    }

    // JSDoc-style block comment
    const lines = content.split('\n');
    const formattedLines = lines.map(line => ` * ${line}`);
    return `${style.blockStart}\n * @forge-spec\n *\n${formattedLines.join('\n')}\n${style.blockEnd}`;
}
