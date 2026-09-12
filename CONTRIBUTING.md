Create a file named CONTRIBUTING.md in the root of your repository or inside the .github/ folder.

Here is a ready-to-use template tailored directly to the waifu-space stack (Bun, SolidStart, TypeScript, Vitest, and Supabase):
Markdown

# Contributing to WaifuSpace 🌸

Thank you for your interest in contributing to WaifuSpace! We welcome bug fixes, UI enhancements, archetype dialogues, and performance optimizations.

---

## Code of Conduct

Please be respectful, kind, and considerate when interacting with contributors and maintainers. Harassment or toxic behavior will not be tolerated.

---

## Development Setup

### Prerequisites
- **[Bun](https://bun.sh/)** (v1.1 or higher)
- **Git**

### Local Environment
1. **Fork** the repository and clone your fork locally:
   ```bash
   git clone [https://github.com/](https://github.com/)<your-username>/waifu-space.git
   cd waifu-space

    Install dependencies using Bun:
    Bash

    bun install

    Environment Setup:
    Copy .env.example to .env and fill in any optional keys (e.g., Supabase or AI provider API keys):
    Bash

    cp .env.example .env

    Start the development server:
    Bash

    bun run dev

    Open http://localhost:3000 in your browser.

Contribution Workflow

    Branch Naming:
    Create a topic branch from main:

        feat/avatar-new-outfit

        fix/calendar-drag-drop

        docs/update-wiki-links

    Commit Conventions:
    We use conventional commit messages:

        feat(...): A new feature or user-facing behavior

        fix(...): A bug fix

        docs(...): Documentation or Wiki updates

        style(...): Formatting or CSS changes that do not affect code logic

        refactor(...): Code refactoring without functionality changes

        test(...): Adding or updating test suites

    Running Tests:
    Ensure all tests pass before opening your pull request:
    Bash

    # Run Vitest test suite
    bun run test:unit

    # Or run Bun native test runner
    bun test

    Type Checking:
    Verify there are no TypeScript compiler errors:
    Bash

    bun run typecheck

Areas You Can Contribute To

    Avatars & Assets (src/components/WaifuAvatar.tsx): Adding new SVG hairstyles, outfits, or facial expressions. Ensure all assets are pure vector SVG or optimized SVGs that scale cleanly without rasterization.

    Dialogue & Personalities (src/lib/personality.ts): Adding lines or reactions to the 5 archetypes (Tsundere, Kuudere, Yandere, Deredere, Dandere).

    Calendar & Productivity (src/components/Calendar*.tsx): Improving drag-and-drop mechanics, iCal parsing (src/lib/ical.ts), and time grid rendering.

    Themes & UI (src/styles/): Adding new accessible color themes or improving canvas particle performance (SakuraCanvas.tsx).

Pull Request Guidelines

    Keep pull requests focused on a single change or feature.

    Provide a clear title and description explaining what was changed and why.

    Attach screenshots or screen recordings for UI/visual changes.

    Ensure your branch is rebased onto the latest main branch before opening the PR.
