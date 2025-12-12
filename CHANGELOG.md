# Changelog

## [0.2.0] - 2024-12-12

### Added
- **History Sidebar** - View and re-use past refinements from activity bar
- **Prompt Templates** - 18 quick-start templates in 6 categories (UI, Features, Refactoring, Fixes, Testing, Docs)
- **`/templates` command** - Browse templates directly in chat
- **`/history` command** - View recent refinements in chat
- **Status bar item** - Quick access to Dashboard

### Changed
- **Improved prompt handling** - Detailed prompts are now preserved and enhanced, not summarized
- **Professional UI** - Removed excessive emojis, cleaner output
- **Better vague detection** - Only truly ambiguous prompts trigger choice options
- **Auto-dismiss notifications** - Toasts disappear after 4 seconds

### Fixed
- Critical bug where detailed prompts were incorrectly marked as "vague"
- User content was being removed/summarized instead of preserved

## [0.1.0] - 2024-12-05

### Added
- Initial release
- Chat participant `@refine` for prompt refinement
- Gemini API integration with Google Search
- Model selection (gemini-2.5-flash, flash-lite, 2.5-pro, 3-pro-preview)
- One-click copy button
- `/help` slash command
