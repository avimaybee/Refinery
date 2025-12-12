/**
 * Prompt templates for common use cases
 */
export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    category: 'ui' | 'feature' | 'refactor' | 'fix' | 'test' | 'docs';
}

/**
 * Built-in prompt templates
 */
export const PROMPT_TEMPLATES: PromptTemplate[] = [
    // UI Templates
    {
        id: 'form',
        name: 'Add Form',
        description: 'Create a form with validation',
        template: 'Add a form with fields for [field1, field2, field3]. Include input validation with clear error messages and a submit button that provides feedback.',
        category: 'ui',
    },
    {
        id: 'modal',
        name: 'Add Modal/Dialog',
        description: 'Create a modal dialog',
        template: 'Add a modal dialog for [purpose]. It should have a clear header, body content, and action buttons. Include a way to close it.',
        category: 'ui',
    },
    {
        id: 'nav',
        name: 'Add Navigation',
        description: 'Create navigation component',
        template: 'Add a navigation bar with links to [pages]. Include responsive behavior for mobile devices and visual indication of the active page.',
        category: 'ui',
    },
    {
        id: 'table',
        name: 'Add Data Table',
        description: 'Create a data table with sorting',
        template: 'Add a data table to display [data type]. Include column headers, sortable columns, and pagination if the data is large.',
        category: 'ui',
    },
    {
        id: 'darkmode',
        name: 'Add Dark Mode',
        description: 'Implement dark mode toggle',
        template: 'Add a dark mode toggle that persists the user preference. Both themes should have good contrast and be visually consistent.',
        category: 'ui',
    },

    // Feature Templates
    {
        id: 'auth',
        name: 'Add Authentication',
        description: 'Implement user authentication',
        template: 'Add user authentication with login and signup flows. Include form validation, error handling, and appropriate security measures.',
        category: 'feature',
    },
    {
        id: 'search',
        name: 'Add Search',
        description: 'Implement search functionality',
        template: 'Add search functionality for [content type]. Include real-time filtering, clear results display, and handling for no results.',
        category: 'feature',
    },
    {
        id: 'pagination',
        name: 'Add Pagination',
        description: 'Implement pagination',
        template: 'Add pagination to [component/page]. Show page numbers, next/previous buttons, and indicate the current page clearly.',
        category: 'feature',
    },
    {
        id: 'notifications',
        name: 'Add Notifications',
        description: 'Implement notification system',
        template: 'Add a notification system that can show success, error, warning, and info messages. Notifications should auto-dismiss and be stackable.',
        category: 'feature',
    },

    // Refactor Templates
    {
        id: 'refactor-component',
        name: 'Refactor Component',
        description: 'Improve component structure',
        template: 'Refactor this component to improve readability, extract reusable logic, and follow best practices. Maintain existing functionality.',
        category: 'refactor',
    },
    {
        id: 'refactor-perf',
        name: 'Performance Optimization',
        description: 'Optimize for performance',
        template: 'Optimize this code for better performance. Focus on reducing unnecessary re-renders, memoization, and efficient data handling.',
        category: 'refactor',
    },
    {
        id: 'refactor-types',
        name: 'Add TypeScript Types',
        description: 'Add proper TypeScript types',
        template: 'Add proper TypeScript types to this code. Replace any types with specific interfaces, add return types, and ensure type safety.',
        category: 'refactor',
    },

    // Fix Templates
    {
        id: 'fix-accessibility',
        name: 'Fix Accessibility',
        description: 'Improve accessibility',
        template: 'Improve the accessibility of this component. Add proper ARIA labels, keyboard navigation, focus management, and screen reader support.',
        category: 'fix',
    },
    {
        id: 'fix-responsive',
        name: 'Fix Responsiveness',
        description: 'Make responsive for all devices',
        template: 'Make this component fully responsive. It should work well on mobile, tablet, and desktop without horizontal scrolling or layout issues.',
        category: 'fix',
    },

    // Test Templates
    {
        id: 'test-unit',
        name: 'Add Unit Tests',
        description: 'Create unit tests',
        template: 'Add unit tests for this code. Cover the main functionality, edge cases, and error handling. Use descriptive test names.',
        category: 'test',
    },
    {
        id: 'test-e2e',
        name: 'Add E2E Tests',
        description: 'Create end-to-end tests',
        template: 'Add end-to-end tests for [user flow]. Cover the happy path and key error scenarios.',
        category: 'test',
    },

    // Docs Templates
    {
        id: 'docs-readme',
        name: 'Write README',
        description: 'Create documentation',
        template: 'Create a README for this project. Include an overview, setup instructions, usage examples, and contribution guidelines.',
        category: 'docs',
    },
    {
        id: 'docs-api',
        name: 'Document API',
        description: 'Document API endpoints',
        template: 'Document this API with clear descriptions of endpoints, request/response formats, error codes, and usage examples.',
        category: 'docs',
    },
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return PROMPT_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all template categories
 */
export function getTemplateCategories(): Array<{ id: PromptTemplate['category']; label: string; icon: string }> {
    return [
        { id: 'ui', label: 'UI Components', icon: 'symbol-interface' },
        { id: 'feature', label: 'Features', icon: 'add' },
        { id: 'refactor', label: 'Refactoring', icon: 'references' },
        { id: 'fix', label: 'Fixes', icon: 'wrench' },
        { id: 'test', label: 'Testing', icon: 'beaker' },
        { id: 'docs', label: 'Documentation', icon: 'book' },
    ];
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): PromptTemplate | undefined {
    return PROMPT_TEMPLATES.find(t => t.id === id);
}
