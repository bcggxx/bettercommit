# BetterCommit — AI Commit Message Generator

[English](./README.md) | [简体中文](./README.zh-CN.md)

Generate **conventional commit messages** from your git diffs using AI (OpenCode Zen, OpenAI, OpenRouter, DeepSeek, Groq, Anthropic, Ollama, or local OpenCode CLI) — directly in VS Code's Source Control panel.

> Forked from [cihatksm/opencommit](https://github.com/cihatksm/opencommit) by Cihat Kösem.

<p align="center">
  <a href="https://github.com/bcggxx/bettercommit/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/bcggxx/bettercommit"><img src="https://img.shields.io/github/package-json/v/bcggxx/bettercommit?style=for-the-badge&label=version&color=blue" alt="Version"></a>
  <a href="https://github.com/bcggxx/bettercommit"><img src="https://img.shields.io/badge/repo-github-181717?style=for-the-badge&logo=github" alt="Repository"></a>
  <a href="https://github.com/bcggxx/bettercommit"><img src="https://badges.pufler.dev/visits/bcggxx/bettercommit?style=for-the-badge" alt="Visits"></a>
</p>

|                |                                                                 |
| -------------- | --------------------------------------------------------------- |
| **Categories** | SCM Providers, Other                                            |
| **Publisher**  | bcggxx                                                          |
| **License**    | [MIT](https://github.com/bcggxx/bettercommit/blob/main/LICENSE)   |

| Resources                                                              |                                |
| ---------------------------------------------------------------------- | ------------------------------ |
| [Repository](https://github.com/bcggxx/bettercommit)                     | Source code on GitHub          |
| [Issues](https://github.com/bcggxx/bettercommit/issues)                  | Report bugs & request features |
| [Author](https://github.com/bcggxx)                                    | bcggxx                         |

---



## 📑 Table of Contents

- [✨ Features](#-features)
- [🚀 Getting Started](#-getting-started)
  - [1. Get an API Token](#1-get-an-api-token)
  - [2. Configure Settings](#2-configure-settings)
  - [3. Set Your Token](#3-set-your-token)
  - [4. Generate a Commit Message](#4-generate-a-commit-message)
- [⚙️ Settings](#️-settings)
  - [Provider Examples](#provider-examples)
  - [Using Anthropic (Claude)](#using-anthropic-claude)
- [🔐 Security](#-security)
- [📦 Build](#-build)
- [📄 License](#-license)

---

## ✨ Features

- **One-click commit messages** — Sparkle icon in the Source Control panel, plus a `✨ AI Commit` status bar item
- **Model picker** — Choose from 20+ free & paid models, remembered for future use
- **Any AI provider** — OpenCode Zen (default), OpenAI, OpenRouter, DeepSeek, Groq, Anthropic (native Messages API), Ollama, LM Studio, or local OpenCode CLI
- **Conventional Commits** — `feat:`, `fix:`, `refactor:` and more
- **Linux kernel commits** — Optional `<subsystem>: <summary>` format with a `Signed-off-by:` trailer (uses your `git user.name` / `user.email`); overrides Conventional Commits when enabled
- **Multi-line support** — Optional body explaining WHAT and WHY
- **Smart diff handling** — Auto-truncates large diffs to fit the API
- **Secure token storage** — Uses VS Code SecretStorage
- **Regenerate** — Re-generate the message if you don't like the first one

---

## 🚀 Getting Started

### 1. Get an API Token

**Default provider is OpenCode Zen** (free tier available). Choose a provider:

- **OpenCode Zen** → https://opencode.ai/zen (includes free tier)
- **OpenAI** → https://platform.openai.com/api-keys
- **OpenRouter** → https://openrouter.ai/keys
- **Groq** → https://console.groq.com/keys
- **DeepSeek** → https://platform.deepseek.com/api_keys
- **Anthropic** → https://console.anthropic.com/settings/keys (uses the native Messages API)
- **Ollama** (local) → no key needed, use `ollama` as token

### 2. Configure Settings

Open VS Code Settings (`Ctrl+,`) and search for `BetterCommit`:

| Setting               | Default value                                 |
| --------------------- | --------------------------------------------- |
| `Api Base Url`        | `https://opencode.ai/zen/v1/chat/completions` |
| `Model`               | `deepseek-v4-flash-free`                      |
| `Conventional Commit` | `true`                                        |

Or for local OpenCode CLI, set `Api Base Url` to `opencode-cli`.

### 3. Set Your Token

Open the Command Palette (`Ctrl+Shift+P`) and run:

```
BetterCommit: 🔑 Set API Token
```

### 4. Generate a Commit Message

- Stage some changes in Source Control, then click the **✨** (sparkle) icon in the Source Control panel, or the **✨ AI Commit** status bar item on the left status bar, OR
- Run `BetterCommit: ✨ Generate Commit` from the Command Palette
- On first use, a model picker will appear — choose your preferred model (it will be remembered)
- To regenerate the message, run `BetterCommit: ✨ Regenerate`

---

## ⚙️ Settings

| Setting                                     | Default                                       | Description                                       |
| ------------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `commitMessageGenerator.apiBaseUrl`         | `https://opencode.ai/zen/v1/chat/completions` | API endpoint URL                                  |
| `commitMessageGenerator.apiProvider`        | `auto`                                        | Protocol: `auto`, `openai`, or `anthropic`        |
| `commitMessageGenerator.model`              | `deepseek-v4-flash-free`                      | AI model name                                     |
| `commitMessageGenerator.promptModel`        | `true`                                          | Show model picker once, then remember the choice                                  |
| `commitMessageGenerator.conventionalCommit` | `true`                                        | Conventional Commit format                        |
| `commitMessageGenerator.linuxKernelCommit`  | `false`                                       | Linux kernel `<subsystem>: <summary>` format with `Signed-off-by:` (overrides conventionalCommit) |
| `commitMessageGenerator.multiLine`          | `false`                                       | Multi-line with body                              |
| `commitMessageGenerator.maxDiffLength`      | `4000`                                        | Max diff chars sent to API                        |

### Provider Examples

| Provider               | API Base URL                                      | `apiProvider` |
| ---------------------- | ------------------------------------------------- | ------------- |
| OpenCode Zen (default) | `https://opencode.ai/zen/v1/chat/completions`     | `auto`/`openai` |
| OpenCode Zen Go        | `https://opencode.ai/zen/go/v1/chat/completions`  | `auto`/`openai` |
| OpenCode Zen Go (Messages API) | `https://opencode.ai/zen/go/v1/messages`   | `auto`/`anthropic` |
| OpenAI                 | `https://api.openai.com/v1/chat/completions`      | `auto`/`openai` |
| OpenRouter             | `https://openrouter.ai/api/v1/chat/completions`   | `auto`/`openai` |
| Groq                   | `https://api.groq.com/openai/v1/chat/completions` | `auto`/`openai` |
| DeepSeek               | `https://api.deepseek.com/v1/chat/completions`    | `auto`/`openai` |
| Anthropic (native)     | `https://api.anthropic.com/v1/messages`           | `auto`/`anthropic` |
| Ollama (local)         | `http://localhost:11434/v1/chat/completions`      | `auto`/`openai` |
| LM Studio (local)      | `http://localhost:1234/v1/chat/completions`       | `auto`/`openai` |
| OpenCode CLI           | `opencode-cli` (runs locally)                     | `auto`/`openai` |

### Using Anthropic (Claude)

BetterCommit ships a dedicated adapter for the Anthropic **Messages API** so Claude models work without an OpenAI-compatible proxy. When `apiProvider` is `auto`, the adapter activates automatically whenever `apiBaseUrl` contains `anthropic.com`.

Quick setup:

1. Get an API key at https://console.anthropic.com/settings/keys
2. Run `BetterCommit: Set API Token` and paste the key
3. In Settings, set:
   - `Api Base Url` → `https://api.anthropic.com/v1/messages`
   - `Model` → e.g. `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, or `claude-opus-4-1-20250805`
4. (Optional) Set `Api Provider` to `anthropic` to force the Messages API regardless of URL

The adapter handles the protocol differences for you: the system prompt is moved into the top-level `system` field, `max_tokens` is sent as required, auth uses the `x-api-key` header (plus the mandatory `anthropic-version: 2023-06-01` header), and the response is read from the `content[].text` block array.

---

## 🔐 Security

- API tokens stored in VS Code **SecretStorage** (encrypted)
- Tokens **never logged** to console
- Only the diff is sent — no full file contents

---

## 📦 Build

```bash
npm install
npm run compile
npm run package
```

Or use the all-in-one build & install script (**Windows only** — it shells out to PowerShell and runs `code --install-extension` to install the VSIX into the local VS Code; on macOS/Linux use the three commands above, or grab the CI-built VSIX artifact from GitHub Actions):

```bash
npm run build-install          # patch bump
npm run build-install:minor    # minor bump
npm run build-install:major    # major bump
```

---

## 📄 License

Released under the [MIT License](./LICENSE) — © 2026 Cihat Kösem (cihatksm) and bcggxx.

**You can** (commercial or private, no need to ask):

- Use, copy, modify, merge, and distribute this software — including in closed-source or commercial products
- Sublicense and/or sell copies
- Fork it and build your own extension on top

**You must**:

- Keep the copyright notice and this permission notice in all copies or substantial portions of the Software

**No warranty** — the software is provided "AS IS", without any warranty of merchantability, fitness for a particular purpose, or non-infringement. The authors are not liable for any claim, damages, or other liability arising from its use.

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fbcggxx%2Fbettercommit.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fbcggxx%2Fbettercommit?ref=badge_large)
