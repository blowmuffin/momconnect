# Contributing to MomConnect

Thank you for considering contributing to MomConnect! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branch Strategy](#branch-strategy)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your changes
4. **Make your changes** and test them
5. **Push** to your fork and **submit a Pull Request**

## Development Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/momconnect.git
cd momconnect

# Install backend dependencies
cd backend
npm install
cp .env.example .env
# Fill in your API keys in .env

# Install frontend dependencies
cd ../frontend
npm install

# Start development servers
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm start
```

## Branch Strategy

We follow a simplified Git Flow:

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `develop` | Integration branch for features |
| `feat/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation updates |
| `refactor/<name>` | Code refactoring |

**Examples:**
```bash
git checkout -b feat/whatsapp-integration
git checkout -b fix/emergency-cooldown-bug
git checkout -b docs/api-reference-update
```

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semicolons, etc. (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Maintenance tasks (deps, CI, build, etc.) |

### Examples

```bash
feat(chatbot): add Hindi language support for mental health agent
fix(emergency): resolve cooldown bypass on rapid message sends
docs(readme): update API reference with new chatbot endpoints
refactor(orchestrator): extract intent classification into separate module
test(agents): add integration tests for hospital finder agent
chore(deps): bump @google/generative-ai to v0.25.0
```

## Pull Request Process

1. Update `README.md` if your changes affect setup, API, or architecture
2. Ensure your code follows the existing style conventions
3. Test your changes locally (backend + frontend)
4. Write a clear PR description explaining **what** and **why**
5. Reference any related issues (e.g., `Closes #42`)
6. Request review from at least one maintainer

### PR Title Format
Follow the same convention as commits:
```
feat(chatbot): add voice language selection dropdown
```

## Code Style

- **JavaScript**: ES6+ features, `const`/`let` (no `var`)
- **Indentation**: 2 spaces
- **Semicolons**: Required
- **Strings**: Single quotes for JS, double quotes for JSX attributes
- **Naming**: `camelCase` for variables/functions, `PascalCase` for components/classes
- **Files**: `camelCase.js` for utilities, `PascalCase.js` for React components and Mongoose models

## Reporting Bugs

Use the [GitHub Issues](https://github.com/blowmuffin/momconnect/issues) tab with the **Bug** label:

- **Title**: Clear, concise description
- **Steps to reproduce**: Numbered list
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Environment**: OS, Node version, browser

## Suggesting Features

Use GitHub Issues with the **Enhancement** label:

- **Problem**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Other approaches you thought of

---

Thank you for helping make MomConnect better for mothers everywhere! 💜
