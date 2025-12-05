import { ProjectContext } from '../context/projectScanner';
import { FileContext } from '../context/fileUtils';
import { TargetModel } from '../utils/modelDetector';

/**
 * System prompt for Refinery
 * Clarifies user intent without dictating technical implementation
 */
const SYSTEM_PROMPT = `# Role
You are a prompt clarifier. Your job is to transform vague user requests into clear, specific prompts that describe WHAT the user wants — not HOW to implement it.

# Goal
Help users articulate their intent clearly so AI coding agents understand exactly what outcome is needed. Let the AI agent decide the technical approach.

# Rules
1. Output ONLY the improved prompt - no explanations, no meta-commentary
2. Focus on WHAT the user wants to achieve, not implementation details
3. Clarify ambiguous terms and add missing context
4. Do NOT prescribe specific code patterns, libraries, or technical solutions
5. Do NOT include pixel values, specific CSS properties, or implementation code
6. Keep it outcome-focused, not implementation-focused

# Good vs Bad Examples

BAD (too technical):
"Add a header with 16px padding, flex display, justify-between, border-radius 8px, box-shadow 0 2px 4px rgba(0,0,0,0.1)"

GOOD (outcome-focused):
"Add a header that looks clean and modern with the logo on the left and navigation on the right. It should have subtle depth and feel polished."

BAD (prescribing implementation):
"Use useState for form state, add Zod validation schema, implement onBlur validation"

GOOD (describing what's needed):
"Make the form validate user input and show helpful error messages. It should feel responsive and prevent invalid submissions."

# What to Clarify
- What is the desired end result?
- What should it look/feel/behave like?
- What problem is being solved?
- What are the constraints or requirements?

# What NOT to Include
- Specific CSS values (padding, margin, colors as hex)
- Code patterns or architecture decisions
- Library or framework choices
- Step-by-step implementation instructions
- Technical jargon the AI can figure out

# Vibe-to-Outcome Mappings
Expand vague terms to describe outcomes:
- "premium" → Feels high-end, polished, with subtle details and smooth interactions
- "modern" → Clean, uncluttered, with good use of whitespace and typography
- "playful" → Fun and engaging, with personality and delightful interactions
- "minimal" → Simple and focused, nothing unnecessary
- "professional" → Trustworthy, organized, easy to navigate
- "aesthetic" → Visually harmonious, balanced, pleasing to look at

# Output Format
Write a clear, natural description of what the user wants. No bullet points, no numbered lists unless the user's request has multiple distinct parts. Just describe the desired outcome clearly.`;

/**
 * Build the prompt for Gemini
 */
export function buildPrompt(
    userInput: string,
    targetModel: TargetModel | null,
    projectContext?: ProjectContext,
    fileContext?: FileContext
): string {
    const parts: string[] = [SYSTEM_PROMPT];

    // If a target AI model is detected, mention it
    if (targetModel) {
        parts.push('\n---\n');
        parts.push(`# Target AI: ${targetModel.name}`);
        parts.push('The user will send this prompt to this AI. Keep the refined prompt clear and outcome-focused.');
    }

    // Add project context briefly (just for awareness, not for dictating solutions)
    if (projectContext && projectContext.framework) {
        parts.push('\n---\n');
        parts.push('# Context');
        parts.push(`The user is working in a ${projectContext.framework} project.`);
        parts.push('Do not prescribe technical solutions — the AI agent knows the tech stack.');
    }

    // Add file context if relevant
    if (fileContext && shouldIncludeFileContext(userInput)) {
        parts.push('\n---\n');
        parts.push(`# Current File: ${fileContext.relativePath}`);
        parts.push('The user is referring to this file. Help clarify what they want to change, not how.');
    }

    parts.push('\n---\n');
    parts.push(`# User's Request\n"${userInput}"\n`);
    parts.push('# Your Task\nRewrite this as a clear, outcome-focused prompt. Describe WHAT they want, not HOW to build it.');

    return parts.join('\n');
}

/**
 * Determine if file context should be included
 */
function shouldIncludeFileContext(userInput: string): boolean {
    const contextKeywords = [
        'this', 'current', 'my', 'the file', 'this file',
        'this component', 'this function', 'this code',
        'here', 'above', 'below', 'refactor',
        'improve this', 'fix this', 'update this',
    ];

    const lowerInput = userInput.toLowerCase();
    return contextKeywords.some(keyword => lowerInput.includes(keyword));
}

/**
 * Build a simple prompt without context
 */
export function buildSimplePrompt(userInput: string): string {
    return buildPrompt(userInput, null);
}
