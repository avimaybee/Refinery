import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Project context detected from package.json or requirements.txt
 */
export interface ProjectContext {
    framework: string | null;
    styling: string | null;
    animation: string | null;
    uiLibrary: string | null;
    language: 'typescript' | 'javascript' | 'python' | 'unknown';
    constraints: string[];
}

/**
 * Dependency to constraint mapping
 */
const DEPENDENCY_CONSTRAINTS: Record<string, string> = {
    // Styling
    'tailwindcss': 'Strictly use Tailwind CSS utility classes. No inline styles or custom CSS unless absolutely necessary.',
    'styled-components': 'Use styled-components for styling. Follow the component-based styling pattern.',
    'emotion': 'Use Emotion for CSS-in-JS styling.',
    '@emotion/react': 'Use Emotion for CSS-in-JS styling.',
    'sass': 'Project uses SCSS/Sass for styling.',

    // Animation
    'framer-motion': 'Use Framer Motion for all animations. Prefer spring physics and gesture-based interactions.',
    'react-spring': 'Use react-spring for physics-based animations.',
    'gsap': 'Use GSAP for complex animations and timelines.',

    // UI Libraries
    '@shadcn/ui': 'Use Shadcn/UI components. Follow their composition patterns and styling conventions.',
    'shadcn-ui': 'Use Shadcn/UI components. Follow their composition patterns and styling conventions.',
    '@radix-ui/react-dialog': 'Project uses Radix UI primitives. Build accessible components on top of these.',
    '@chakra-ui/react': 'Use Chakra UI components and design tokens.',
    '@mui/material': 'Use Material-UI components and theming system.',
    'antd': 'Use Ant Design components and design system.',

    // Frameworks
    'react': 'This is a React project. Use functional components with hooks. Prefer composition over inheritance.',
    'react-dom': 'This is a React project. Use functional components with hooks.',
    'next': 'This is a Next.js project. Consider SSR/SSG implications. Use App Router patterns if applicable.',
    'vue': 'This is a Vue.js project. Use Composition API with <script setup> syntax.',
    'nuxt': 'This is a Nuxt.js project. Follow Nuxt conventions for routing and data fetching.',
    'svelte': 'This is a Svelte project. Use reactive declarations and Svelte-specific patterns.',
    '@angular/core': 'This is an Angular project. Follow Angular conventions and use dependency injection.',

    // State Management
    'zustand': 'Use Zustand for state management. Keep stores small and focused.',
    'redux': 'Use Redux for state management with proper action/reducer patterns.',
    '@reduxjs/toolkit': 'Use Redux Toolkit for state management. Prefer createSlice and RTK Query.',
    'jotai': 'Use Jotai for atomic state management.',
    'recoil': 'Use Recoil for state management with atoms and selectors.',

    // TypeScript
    'typescript': 'This is a TypeScript project. Use strict typing. Avoid `any` type.',
};

/**
 * Scans the workspace for package.json or requirements.txt and extracts project context
 */
export async function getProjectContext(): Promise<ProjectContext> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        return getDefaultContext();
    }

    const rootPath = workspaceFolders[0].uri;

    // Try package.json first (Node.js/JavaScript projects)
    try {
        const packageJsonUri = vscode.Uri.joinPath(rootPath, 'package.json');
        const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
        const packageJson = JSON.parse(packageJsonContent.toString());

        return parsePackageJson(packageJson);
    } catch {
        // package.json not found, try requirements.txt
    }

    // Try requirements.txt (Python projects)
    try {
        const requirementsUri = vscode.Uri.joinPath(rootPath, 'requirements.txt');
        const requirementsContent = await vscode.workspace.fs.readFile(requirementsUri);

        return parseRequirementsTxt(requirementsContent.toString());
    } catch {
        // requirements.txt not found
    }

    // Try pyproject.toml (Python projects)
    try {
        const pyprojectUri = vscode.Uri.joinPath(rootPath, 'pyproject.toml');
        await vscode.workspace.fs.readFile(pyprojectUri);

        return {
            ...getDefaultContext(),
            language: 'python',
            constraints: ['This is a Python project.'],
        };
    } catch {
        // pyproject.toml not found
    }

    return getDefaultContext();
}

/**
 * Parse package.json and extract dependencies to generate constraints
 */
function parsePackageJson(packageJson: Record<string, unknown>): ProjectContext {
    const allDeps: Record<string, string> = {
        ...(packageJson.dependencies as Record<string, string> || {}),
        ...(packageJson.devDependencies as Record<string, string> || {}),
    };

    const constraints: string[] = [];
    let framework: string | null = null;
    let styling: string | null = null;
    let animation: string | null = null;
    let uiLibrary: string | null = null;
    const hasTypeScript = 'typescript' in allDeps;

    // Check each dependency against our mapping
    for (const dep of Object.keys(allDeps)) {
        if (DEPENDENCY_CONSTRAINTS[dep]) {
            constraints.push(DEPENDENCY_CONSTRAINTS[dep]);
        }

        // Categorize dependencies
        if (['react', 'vue', 'svelte', 'next', 'nuxt'].includes(dep)) {
            framework = dep;
        }
        if (['tailwindcss', 'styled-components', 'emotion', 'sass'].includes(dep)) {
            styling = dep;
        }
        if (['framer-motion', 'react-spring', 'gsap'].includes(dep)) {
            animation = dep;
        }
        if (dep.includes('shadcn') || dep.includes('chakra') || dep.includes('mui') || dep === 'antd') {
            uiLibrary = dep;
        }
    }

    return {
        framework,
        styling,
        animation,
        uiLibrary,
        language: hasTypeScript ? 'typescript' : 'javascript',
        constraints: constraints.length > 0 ? constraints : ['No specific framework constraints detected.'],
    };
}

/**
 * Parse requirements.txt for Python projects
 */
function parseRequirementsTxt(content: string): ProjectContext {
    const lines = content.split('\n').map(l => l.trim().toLowerCase());
    const constraints: string[] = ['This is a Python project.'];

    // Check for common Python frameworks
    if (lines.some(l => l.startsWith('django'))) {
        constraints.push('Use Django framework conventions. Follow MVT pattern.');
    }
    if (lines.some(l => l.startsWith('flask'))) {
        constraints.push('Use Flask framework. Follow Flask application patterns.');
    }
    if (lines.some(l => l.startsWith('fastapi'))) {
        constraints.push('Use FastAPI with async patterns. Use Pydantic for validation.');
    }

    return {
        framework: null,
        styling: null,
        animation: null,
        uiLibrary: null,
        language: 'python',
        constraints,
    };
}

/**
 * Default context when no project files are found
 */
function getDefaultContext(): ProjectContext {
    return {
        framework: null,
        styling: null,
        animation: null,
        uiLibrary: null,
        language: 'unknown',
        constraints: ['No specific project context detected. Provide general best practices.'],
    };
}

/**
 * Format constraints for inclusion in the LLM prompt
 */
export function formatConstraints(context: ProjectContext): string {
    if (context.constraints.length === 0) {
        return 'No specific constraints.';
    }

    return context.constraints.map(c => `- ${c}`).join('\n');
}
