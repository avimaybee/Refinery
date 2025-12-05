# Refinery

> Refine vague ideas into production-ready prompts

**Stop wasting API quota on follow-up prompts.** Refinery enhances your requests so AI agents understand exactly what you need — the first time.

## Features

### 🔧 Prompt Refinement

Type `@refine` followed by your vague request:

- `@refine make it look better`
- `@refine add dark mode`
- `@refine fix the form`

Get back a comprehensive, task-oriented prompt ready to paste into your AI agent.

### ✨ Powered by Gemini

Uses Google's Gemini API with Google Search for the latest best practices.

### 📋 One-Click Copy

Copy the refined prompt with a single click and paste it into Copilot, Claude, or any AI assistant.

## Getting Started

1. Install the extension
2. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)
3. Run `Refinery: Set API Key` command
4. Start refining prompts with `@refine`!

## Example

**You type:**
```
@refine make it look better
```

**You get:**
```
Improve the visual design of this component.

Tasks:
1. Update spacing to use consistent 16px/24px grid system
2. Add subtle box shadows for depth
3. Apply rounded corners (8px) to cards and buttons
4. Ensure color contrast meets WCAG AA standards
5. Add hover states with smooth 200ms transitions

Requirements:
- Maintain existing functionality
- Keep responsive behavior intact
```

## Settings

- `refinery.apiKey` - Your Google AI Studio API key
- `refinery.model` - Choose: gemini-2.5-flash (default), flash-lite, 2.5-pro, 3-pro-preview

## License

MIT
