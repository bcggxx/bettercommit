import { buildSystemPrompt, buildUserPrompt, cleanCommitMessage, getApiBaseUrl } from './opencodeClient';

/**
 * Native Anthropic Messages API adapter.
 *
 * Differences vs. OpenAI-compatible endpoints (handled here):
 *  - The system prompt lives in a top-level `system` field, not inside `messages`.
 *  - `max_tokens` is required.
 *  - Auth uses the `x-api-key` header (not `Authorization: Bearer`).
 *  - The `anthropic-version: 2023-06-01` header is mandatory.
 *  - The response is a `content` array of typed blocks; the text sits in
 *    `content[i].text` where `type === "text"` (not `choices[0].message.content`).
 *
 * Spec: https://docs.anthropic.com/en/api/messages
 */

const DEFAULT_ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = 60_000;

export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AnthropicRequest {
    model: string;
    max_tokens: number;
    system?: string;
    messages: AnthropicMessage[];
    temperature?: number;
}

export interface AnthropicContentBlock {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
}

export interface AnthropicResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    content: AnthropicContentBlock[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

interface AnthropicErrorBody {
    type: string;
    error: {
        type: string;
        message: string;
    };
}

/**
 * Resolve the Anthropic API endpoint.
 * Falls back to the official endpoint when the shared apiBaseUrl is empty
 * or still pointing at the OpenCode Zen default.
 */
function resolveAnthropicEndpoint(): string {
    const configured = getApiBaseUrl();
    if (!configured || configured === 'https://opencode.ai/zen/v1/chat/completions' || configured === 'opencode-cli') {
        return DEFAULT_ANTHROPIC_API_URL;
    }
    return configured;
}

/**
 * Call the Anthropic Messages API to generate a commit message from a git diff.
 * Reuses the shared prompt builders so behavior stays consistent across providers.
 */
export async function generateCommitMessageViaAnthropic(
    diff: string,
    model: string,
    apiToken: string,
    conventionalCommit: boolean,
    multiLine: boolean,
): Promise<string> {
    const apiBaseUrl = resolveAnthropicEndpoint();
    const systemPrompt = buildSystemPrompt(conventionalCommit, multiLine);
    const userPrompt = buildUserPrompt(diff);

    const requestBody: AnthropicRequest = {
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages: [
            { role: 'user', content: userPrompt },
        ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(apiBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiToken,
                'anthropic-version': ANTHROPIC_VERSION,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No response body');
            if (response.status === 401 || response.status === 403) {
                throw new Error(
                    'Anthropic authentication failed. Check your API key. ' +
                    'Use "BetterCommit: Set API Token" to update it.',
                );
            }
            if (response.status === 429) {
                throw new Error('Anthropic rate limit exceeded. Wait a moment and try again.');
            }
            if (response.status === 404) {
                throw new Error(
                    `Anthropic endpoint not found: ${apiBaseUrl}\n\n` +
                    'Make sure the URL points to: https://api.anthropic.com/v1/messages',
                );
            }
            if (response.status === 529) {
                throw new Error('Anthropic API is overloaded. Try again shortly.');
            }

            // Try to parse the structured error envelope for a clearer message
            let parsedMessage: string | undefined;
            try {
                const parsed = JSON.parse(errorText) as AnthropicErrorBody;
                if (parsed?.error?.message) {
                    parsedMessage = parsed.error.message;
                }
            } catch {
                // not JSON — fall through to raw text
            }
            throw new Error(
                `Anthropic API error (${response.status}): ${parsedMessage ?? errorText.slice(0, 300)}`,
            );
        }

        const data = (await response.json()) as AnthropicResponse;

        const textBlock = data.content?.find(block => block.type === 'text' && typeof block.text === 'string');
        const message = textBlock?.text;
        if (!message) {
            throw new Error('No commit message returned from Anthropic. The response was empty.');
        }

        return cleanCommitMessage(message);
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(
                'Request to Anthropic timed out after 60 seconds. ' +
                'The API may be slow or unreachable. Try again or switch models.',
                { cause: error },
            );
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
