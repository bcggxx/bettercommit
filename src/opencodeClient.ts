import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DEFAULT_API_URL = 'https://opencode.ai/zen/v1/chat/completions';

export interface OpenCodeMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OpenCodeRequest {
    model: string;
    messages: OpenCodeMessage[];
}

export interface OpenCodeResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message: string;
        type?: string;
    };
}

/**
 * Securely retrieve the API token from VS Code SecretStorage.
 */
export async function getApiToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
    return secrets.get('bettercommit.apiToken');
}

/**
 * Securely store the API token in VS Code SecretStorage.
 */
export async function storeApiToken(secrets: vscode.SecretStorage, token: string): Promise<void> {
    await secrets.store('bettercommit.apiToken', token);
}

/**
 * Delete the stored API token.
 */
export async function deleteApiToken(secrets: vscode.SecretStorage): Promise<void> {
    await secrets.delete('bettercommit.apiToken');
}

/**
 * Get the API base URL from configuration.
 */
export function getApiBaseUrl(): string {
    const config = vscode.workspace.getConfiguration('commitMessageGenerator');
    return config.get<string>('apiBaseUrl', DEFAULT_API_URL);
}

/**
 * Call the AI API (OpenAI-compatible) to generate a commit message from git diff.
 * Falls back to OpenCode CLI if the user has it installed and configured.
 */
export async function generateCommitMessage(
    diff: string,
    model: string,
    apiToken: string,
    conventionalCommit: boolean,
    multiLine: boolean,
    linuxKernelCommit: boolean,
    identity: string | undefined,
): Promise<string> {
    const apiBaseUrl = getApiBaseUrl();
    const systemPrompt = buildSystemPrompt(conventionalCommit, multiLine, linuxKernelCommit, identity);
    const userPrompt = buildUserPrompt(diff);

    // Try OpenCode CLI first if the user has configured it
    if (apiBaseUrl === 'opencode-cli') {
        return generateViaOpenCodeCli(diff, conventionalCommit, multiLine, linuxKernelCommit, identity);
    }

    // Standard OpenAI-compatible API call
    const requestBody: OpenCodeRequest = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(apiBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No response body');
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Check your API token. Use "BetterCommit: Set API Token" to update it.');
            }
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Wait a moment and try again.');
            }
            if (response.status === 404) {
                throw new Error(
                    `API endpoint not found: ${apiBaseUrl}\n\n` +
                    'The URL may be wrong. Go to VS Code Settings → BetterCommit → Api Base Url and set:\n' +
                    '- OpenAI: https://api.openai.com/v1/chat/completions\n' +
                    '- OpenRouter: https://openrouter.ai/api/v1/chat/completions\n' +
                    '- LM Studio (local): http://localhost:1234/v1/chat/completions\n' +
                    '- Ollama (local): http://localhost:11434/v1/chat/completions\n' +
                    '- Or type "opencode-cli" to use the OpenCode CLI tool.',
                );
            }
            throw new Error(`API error (${response.status}): ${errorText.slice(0, 300)}`);
        }

        const data = (await response.json()) as OpenCodeResponse;

        if (data.error) {
            throw new Error(`API error: ${data.error.message}`);
        }

        const message = data.choices?.[0]?.message?.content;
        if (!message) {
            throw new Error('No commit message returned from the API. The response was empty.');
        }

        return cleanCommitMessage(message);
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timed out after 60 seconds. The API server may be slow or unreachable. Try again or switch to a different model.', { cause: error });
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Use the locally installed OpenCode CLI to generate a commit message.
 * Reuses the shared prompt builders so behavior matches the API path.
 */
async function generateViaOpenCodeCli(
    diff: string,
    conventionalCommit: boolean,
    multiLine: boolean,
    linuxKernelCommit: boolean,
    identity: string | undefined,
): Promise<string> {
    const systemPrompt = buildSystemPrompt(conventionalCommit, multiLine, linuxKernelCommit, identity);
    const userPrompt = buildUserPrompt(diff);
    const prompt = `${systemPrompt}\n\n${userPrompt}`;

    // Escape for shell
    const escaped = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const cmd = `opencode -p "${escaped}" --no-tools`;

    try {
        const { stdout, stderr } = await execAsync(cmd, {
            timeout: 30000,
            maxBuffer: 1024 * 1024,
            env: { ...process.env, OPENCODE_NO_COLOR: '1' },
        });

        if (stderr && !stdout) {
            throw new Error(`OpenCode CLI error: ${stderr}`);
        }

        const cleaned = cleanCommitMessage(stdout.trim());
        if (!cleaned || cleaned.length < 3) {
            throw new Error('OpenCode CLI returned an empty commit message.');
        }
        return cleaned;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
            `OpenCode CLI failed: ${msg}\n\n` +
            'Make sure OpenCode is installed (https://opencode.ai/docs) and available in your PATH.\n' +
            'Or switch to an API provider in VS Code Settings → BetterCommit → Api Base Url.',
            { cause: error },
        );
    }
}

export function buildSystemPrompt(
    conventionalCommit: boolean,
    multiLine: boolean,
    linuxKernelCommit: boolean,
    identity: string | undefined,
): string {
    let prompt = `You are an expert git commit message generator. Your ONLY job is to output a perfect git commit message based on the provided diff.

RULES:
- Output ONLY the commit message text — no explanations, no markdown, no code fences.
- Use imperative mood ("Add feature" not "Added feature").
- Capitalize the first letter of the subject.
- Do not end the subject line with a period.
- Be specific and descriptive — mention key files, functions, or features changed.
- One commit does one thing: if the diff spans unrelated changes, describe only the primary change.`;

    if (linuxKernelCommit) {
        // Linux kernel commit format — overrides conventional.
        const limit = 75;
        prompt += `
- Use the Linux kernel commit format: <subsystem>: <summary>
  Derive the subsystem from the touched file path (e.g. drivers/gpu/drm/i915, net, fs, mm, kernel/sched, arch/x86).
- Keep the subject line under ${limit} characters; wrap body lines at ${limit} characters.`;
    } else {
        prompt += `
- Keep the subject line under 72 characters.
- If the diff includes breaking changes, add "!" after type/scope or a "BREAKING CHANGE:" footer.`;

        if (conventionalCommit) {
            prompt += `
- Use Conventional Commits format: <type>(<scope>): <description>
  Types (lowercase only): feat, fix, refactor, perf, style, test, docs, chore, ci, build, revert
- Add a scope only when obvious from the diff — avoid overly fine scopes (e.g. "fix: typo" not "fix(readme): typo").`;
        }
    }

    if (multiLine || linuxKernelCommit) {
        prompt += `
- Format as multi-line:
  Line 1: Subject line
  Line 2: Blank
  Line 3+: Body explaining WHY the change is needed (background, rationale, design decisions). Do not restate the diff — the code itself is the description.`;
        if (linuxKernelCommit) {
            prompt += `
  Add a "Fixes:" tag if this fixes a regression (format: Fixes: <12-char hash> ("original subject")).
  Add "Cc: stable@vger.kernel.org" if the fix should be backported to stable kernels.`;
        }
        prompt += `
  Wrap body at ${linuxKernelCommit ? 75 : 72} characters.`;
    } else {
        prompt += `
- Output a single-line commit message only.`;
    }

    if (linuxKernelCommit) {
        prompt += `
- End with a "Signed-off-by" trailer. ${
            identity
                ? `Use this identity exactly: Signed-off-by: ${identity}`
                : 'No git identity was found — output "Signed-off-by: Your Name <you@example.com>" as a placeholder so the user can fill it in.'
        }`;
    }

    return prompt;
}

export function buildUserPrompt(diff: string): string {
    return `Here is the git diff. Generate the commit message now:

\`\`\`diff
${diff}
\`\`\``;
}

export function cleanCommitMessage(message: string): string {
    // Remove code fences if the AI wrapped the message
    let cleaned = message
        .replace(/^```[a-z]*\n?/gm, '')
        .replace(/\n?```$/gm, '')
        .replace(/^commit message:?\s*/i, '')
        .trim();

    // Remove leading/trailing quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '');

    // Ensure first line is not empty and starts with a letter
    if (cleaned.length === 0) {
        return 'chore: update code';
    }

    return cleaned;
}
