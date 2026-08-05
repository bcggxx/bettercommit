# BetterCommit — AI 提交信息生成器

[English](./README.md) | [简体中文](./README.zh-CN.md)

使用 AI(OpenCode Zen、OpenAI、OpenRouter、DeepSeek、Groq、Anthropic、Ollama 或本地 OpenCode CLI)从你的 git diff 中生成**规范化提交信息** —— 直接在 VS Code 的源代码管理面板中完成。

> 派生自 [cihatksm/opencommit](https://github.com/cihatksm/opencommit),原作者 Cihat Kösem。

<p align="center">
  <a href="https://github.com/bcggxx/bettercommit/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/bcggxx/bettercommit"><img src="https://img.shields.io/badge/repo-github-181717?style=for-the-badge&logo=github" alt="Repository"></a>
</p>

|                |                                                                 |
| -------------- | --------------------------------------------------------------- |
| **分类**       | SCM 提供程序,其他                                              |
| **发布者**     | bcggxx                                                          |
| **许可证**     | [MIT](https://github.com/bcggxx/bettercommit/blob/main/LICENSE)   |

| 资源                                                              |                              |
| ----------------------------------------------------------------- | ---------------------------- |
| [代码仓库](https://github.com/bcggxx/bettercommit)                 | GitHub 上的源代码            |
| [问题反馈](https://github.com/bcggxx/bettercommit/issues)          | 报告 Bug 与功能请求          |
| [作者](https://github.com/bcggxx)                                 | bcggxx                       |

---

## ✨ 特性

- **一键生成提交信息** —— 源代码管理面板中的 ✨ 图标按钮,以及左侧状态栏上的 `✨ AI Commit` 状态栏项
- **模型选择器** —— 从 20+ 个免费和付费模型中选择,并记住下次使用
- **任意 AI 提供商** —— OpenCode Zen(默认)、OpenAI、OpenRouter、DeepSeek、Groq、Anthropic(原生 Messages API)、Ollama、LM Studio 或本地 OpenCode CLI
- **规范化提交** —— `feat:`、`fix:`、`refactor:` 等
- **多行支持** —— 可选的正文说明做了什么以及为什么
- **智能 diff 处理** —— 自动截断大型 diff 以适配 API
- **安全的令牌存储** —— 使用 VS Code SecretStorage
- **重新生成** —— 如果不满意第一次的结果,可重新生成信息

---

## 🚀 快速开始

### 1. 获取 API 令牌

**默认提供商为 OpenCode Zen**(提供免费额度)。选择一个提供商:

- **OpenCode Zen** → https://opencode.ai/zen(含免费额度)
- **OpenAI** → https://platform.openai.com/api-keys
- **OpenRouter** → https://openrouter.ai/keys
- **Groq** → https://console.groq.com/keys
- **DeepSeek** → https://platform.deepseek.com/api_keys
- **Anthropic** → https://console.anthropic.com/settings/keys(使用原生 Messages API)
- **Ollama**(本地) → 无需密钥,使用 `ollama` 作为令牌

### 2. 配置设置

打开 VS Code 设置(`Ctrl+,`)并搜索 `BetterCommit`:

| 设置               | 默认值                                        |
| ------------------ | --------------------------------------------- |
| `Api Base Url`     | `https://opencode.ai/zen/v1/chat/completions` |
| `Model`            | `deepseek-v4-flash-free`                      |
| `Conventional Commit` | `true`                                     |

如使用本地 OpenCode CLI,可将 `Api Base Url` 设置为 `opencode-cli`。

### 3. 设置你的令牌

打开命令面板(`Ctrl+Shift+P`)并运行:

```
BetterCommit: Set API Token
```

### 4. 生成提交信息

- 在源代码管理中暂存一些更改,然后点击源代码管理面板中的 **✨** 图标,或左侧状态栏上的 **✨ AI Commit** 状态栏项,或
- 从命令面板运行 `BetterCommit: Generate Commit`
- 首次使用时会出现模型选择器 —— 选择你偏好的模型(会被记住)
- 如需重新生成信息,运行 `BetterCommit: Regenerate`

---

## ⚙️ 设置

| 设置                                       | 默认值                                          | 说明                                              |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------- |
| `commitMessageGenerator.apiBaseUrl`        | `https://opencode.ai/zen/v1/chat/completions`   | API 端点 URL                                      |
| `commitMessageGenerator.apiProvider`       | `auto`                                          | 协议:`auto`、`openai` 或 `anthropic`             |
| `commitMessageGenerator.model`             | `deepseek-v4-flash-free`                        | AI 模型名称                                       |
| `commitMessageGenerator.promptModel`       | `true`                                          | 生成前显示模型选择器                              |
| `commitMessageGenerator.conventionalCommit`| `true`                                          | 规范化提交格式                                    |
| `commitMessageGenerator.multiLine`         | `false`                                         | 带正文的多行格式                                  |
| `commitMessageGenerator.maxDiffLength`     | `4000`                                          | 发送到 API 的最大 diff 字符数                     |

### 提供商示例

| 提供商                  | API Base URL                                      | `apiProvider` |
| ----------------------- | ------------------------------------------------- | ------------- |
| OpenCode Zen(默认)     | `https://opencode.ai/zen/v1/chat/completions`     | `auto`/`openai` |
| OpenCode Zen Go         | `https://opencode.ai/zen/go/v1/chat/completions`  | `auto`/`openai` |
| OpenAI                  | `https://api.openai.com/v1/chat/completions`      | `auto`/`openai` |
| OpenRouter              | `https://openrouter.ai/api/v1/chat/completions`   | `auto`/`openai` |
| Groq                    | `https://api.groq.com/openai/v1/chat/completions` | `auto`/`openai` |
| DeepSeek                | `https://api.deepseek.com/v1/chat/completions`    | `auto`/`openai` |
| Anthropic(原生)        | `https://api.anthropic.com/v1/messages`           | `auto`/`anthropic` |
| Ollama(本地)           | `http://localhost:11434/v1/chat/completions`      | `auto`/`openai` |
| LM Studio(本地)        | `http://localhost:1234/v1/chat/completions`       | `auto`/`openai` |
| OpenCode CLI            | `opencode-cli`(本地运行)                         | `auto`/`openai` |

### 使用 Anthropic(Claude)

BetterCommit 内置了针对 Anthropic **Messages API** 的专用适配器,因此 Claude 模型无需 OpenAI 兼容代理即可工作。当 `apiProvider` 为 `auto` 时,只要 `apiBaseUrl` 中包含 `anthropic.com`,适配器就会自动激活。

快速设置:

1. 在 https://console.anthropic.com/settings/keys 获取 API 密钥
2. 运行 `BetterCommit: Set API Token` 并粘贴密钥
3. 在设置中:
   - `Api Base Url` → `https://api.anthropic.com/v1/messages`
   - `Model` → 例如 `claude-sonnet-4-20250514`、`claude-3-5-sonnet-20241022`、`claude-3-5-haiku-20241022` 或 `claude-opus-4-1-20250805`
4. (可选)将 `Api Provider` 设置为 `anthropic`,无论 URL 如何都强制使用 Messages API

适配器会替你处理协议差异:系统提示词会被移入顶层的 `system` 字段,`max_tokens` 会按需发送,认证使用 `x-api-key` 头(以及必需的 `anthropic-version: 2023-06-01` 头),响应从 `content[].text` 块数组中读取。

---

## 🔐 安全

- API 令牌存储在 VS Code 的 **SecretStorage** 中(加密)
- 令牌**绝不会被记录**到控制台
- 仅发送 diff —— 不发送完整文件内容

---

## 📦 构建

```bash
npm install
npm run compile
npm run package
```

或使用一体化构建并安装的脚本:

```bash
npm run build-install          # patch 版本号
npm run build-install:minor    # minor 版本号
npm run build-install:major    # major 版本号
```

---

## 📄 许可证

MIT
