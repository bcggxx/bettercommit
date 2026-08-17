import * as vscode from 'vscode';
import { getGitDiff, getGitIdentity, summarizeDiff } from './git';
import { generateCommitMessage, getApiToken, fetchAvailableModels } from './opencodeClient';
import { generateCommitMessageViaAnthropic, fetchAvailableModelsViaAnthropic } from './anthropicClient';

type ApiProvider = 'openai' | 'anthropic';

/**
 * Resolve which API protocol to use.
 *  1. Honor an explicit `apiProvider` setting when it is not "auto".
 *  2. Otherwise auto-detect from `apiBaseUrl`:
 *       - contains "anthropic.com"  -> Anthropic native Messages API
 *       - anything else             -> OpenAI-compatible chat/completions
 *  3. The "opencode-cli" shortcut always stays on the OpenAI path
 *     (it is handled inside opencodeClient and never reaches the network).
 */
function resolveApiProvider(config: vscode.WorkspaceConfiguration): ApiProvider {
    const explicit = config.get<string>('apiProvider', 'auto');
    if (explicit === 'anthropic') {
        return 'anthropic';
    }
    if (explicit === 'openai') {
        return 'openai';
    }

    const apiBaseUrl = config.get<string>('apiBaseUrl', '');
    if (apiBaseUrl.includes('anthropic.com')) {
        return 'anthropic';
    }
    return 'openai';
}

// Curated fallback model list with cost hints — only used when the live
// model list cannot be fetched from the configured API endpoint.
const FALLBACK_MODEL_CHOICES = [
    { label: 'deepseek-v4-flash-free', description: '🆓 Free — fast, lightweight' },
    { label: 'deepseek-v4-flash', description: '💰 Paid — fast' },
    { label: 'deepseek-v4-pro', description: '💰💰 Paid — powerful' },
    { label: 'mimo-v2.5-free', description: '🆓 Free — lightweight' },
    { label: 'mimo-v2.5', description: '💰 Paid — balanced' },
    { label: 'mimo-v2.5-pro', description: '💰💰 Paid — powerful' },
    { label: 'minimax-m3-free', description: '🆓 Free — lightweight' },
    { label: 'minimax-m3', description: '💰 Paid — powerful' },
    { label: 'minimax-m2.7', description: '💰 Paid — balanced' },
    { label: 'minimax-m2.5', description: '💰 Paid — legacy' },
    { label: 'nemotron-3-super-free', description: '🆓 Free' },
    { label: 'qwen3.6-plus-free', description: '🆓 Free — lightweight' },
    { label: 'qwen3.7-plus', description: '💰 Paid — fast' },
    { label: 'qwen3.7-max', description: '💰💰 Paid — powerful' },
    { label: 'qwen3.6-plus', description: '💰 Paid — balanced' },
    { label: 'kimi-k2.5', description: '💰 Paid — balanced' },
    { label: 'kimi-k2.6', description: '💰💰 Paid — powerful' },
    { label: 'glm-5', description: '💰 Paid — balanced' },
    { label: 'glm-5.1', description: '💰💰 Paid — powerful' },
    { label: 'opencode-gen/kimi-k2.6', description: '💰 Paid — OpenCode hosted' },
    { label: 'gpt-4o-mini', description: '💰 Paid — OpenAI small' },
    { label: 'gpt-4o', description: '💰💰💰 Paid — OpenAI flagship' },
    { label: 'claude-3-5-sonnet', description: '💰💰💰 Paid — Anthropic' },
    { label: 'claude-3-5-sonnet-20241022', description: '💰💰💰 Paid — Anthropic (native Messages API)' },
    { label: 'claude-3-5-haiku-20241022', description: '💰 Paid — Anthropic fast' },
    { label: 'claude-sonnet-4-20250514', description: '💰💰💰 Paid — Anthropic flagship' },
    { label: 'claude-opus-4-1-20250805', description: '💰💰💰 Paid — Anthropic most capable' },
];

const LAST_MODEL_KEY = 'bettercommit.lastModel';

const CUSTOM_MODEL_LABEL = '$(edit) Enter custom model name...';

interface ModelQuickPickItem extends vscode.QuickPickItem {
    model?: string;
}

/**
 * Fetch the live model list from the currently configured API endpoint.
 * Supports both the OpenAI-compatible protocol (GET {base}/models) and the
 * native Anthropic protocol (GET /v1/models). Returns an empty list with
 * the failure reason when the endpoint cannot list models.
 */
async function fetchModelsFromApi(
    config: vscode.WorkspaceConfiguration,
    apiToken: string,
): Promise<{ models: string[]; error?: string }> {
    const provider = resolveApiProvider(config);
    try {
        const models = provider === 'anthropic'
            ? await fetchAvailableModelsViaAnthropic(apiToken)
            : await fetchAvailableModels(apiToken);
        return { models };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { models: [], error: message };
    }
}

/**
 * Prompt the user to pick an AI model via quick pick.
 * The model list is fetched live from the configured API endpoint every
 * time the picker is shown, plus an entry to type any custom model name.
 * Falls back to the curated list when the endpoint cannot list models.
 * Returns the chosen model name, or undefined if the user cancelled.
 */
async function promptModel(
    config: vscode.WorkspaceConfiguration,
    context: vscode.ExtensionContext,
    apiToken: string,
    force: boolean = false,
): Promise<string | undefined> {
    const promptModelSetting = config.get<boolean>('promptModel', true);
    const configDefault = config.get<string>('model', 'deepseek-v4-flash-free');
    const lastUsed = context.globalState.get<string>(LAST_MODEL_KEY);

    // Already chose before and no explicit switch — use it silently
    if (!force && !promptModelSetting && lastUsed) {
        return lastUsed;
    }

    const defaultModel = lastUsed || configDefault;

    // Fetch the model list from the API every time the picker is shown
    let fetched: string[] = [];
    let fetchError: string | undefined;
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: 'BetterCommit: fetching model list from the API...',
        },
        async () => {
            const result = await fetchModelsFromApi(config, apiToken);
            fetched = result.models;
            fetchError = result.error;
        },
    );

    // Decide which list to show: the live API list, or the curated fallback
    let candidates: string[];
    let title: string;
    if (fetched.length > 0) {
        candidates = fetched;
        title = `✨ Select AI Model — ${fetched.length} models fetched from the API`;
    } else {
        candidates = FALLBACK_MODEL_CHOICES.map(m => m.label);
        title = '✨ Select AI Model — built-in list (API fetch failed)';
        if (fetchError) {
            vscode.window.showWarningMessage(
                `BetterCommit: could not fetch the model list (${fetchError}). Showing the built-in list; you can still enter a custom model name.`,
            );
        }
    }

    // Make sure the current model stays selectable even if absent from the list
    if (!candidates.includes(defaultModel)) {
        candidates = [defaultModel, ...candidates];
    }

    const items: ModelQuickPickItem[] = [
        {
            label: CUSTOM_MODEL_LABEL,
            description: 'Type any model name your provider supports',
            alwaysShow: true,
        },
        ...candidates.map(label => {
            const meta = FALLBACK_MODEL_CHOICES.find(m => m.label === label);
            return {
                label,
                model: label,
                description: label === defaultModel ? 'current' : meta?.description,
                picked: label === defaultModel,
            };
        }),
    ];

    const pick = await vscode.window.showQuickPick(items, {
        title,
        placeHolder: `${defaultModel} — Enter to confirm, this will be remembered`,
        matchOnDescription: true,
        ignoreFocusOut: true,
    });

    if (!pick) {
        return undefined; // user cancelled
    }

    let chosen: string;
    if (pick.model === undefined) {
        // Custom entry — ask for the exact model name
        const custom = await vscode.window.showInputBox({
            title: '✨ Custom Model',
            prompt: 'Enter the model name exactly as your API provider expects it',
            placeHolder: 'e.g. gpt-4.1-mini, claude-sonnet-4-5, my-local-model',
            value: defaultModel,
            ignoreFocusOut: true,
            validateInput: (value: string) =>
                value.trim().length === 0 ? 'Model name cannot be empty' : null,
        });
        if (custom === undefined) {
            return undefined; // user cancelled
        }
        chosen = custom.trim();
    } else {
        chosen = pick.model;
    }

    // Remember model + turn off future prompts
    await context.globalState.update(LAST_MODEL_KEY, chosen);
    await config.update('promptModel', false, vscode.ConfigurationTarget.Global);

    return chosen;
}

/**
 * Command handler: "Select Model" — opens the model picker at any time so
 * the user can switch models. The list is re-fetched from the configured
 * API endpoint on every invocation.
 */
export async function selectModel(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('commitMessageGenerator');

    const apiToken = await getApiToken(context.secrets);
    if (!apiToken) {
        const setTokenAction = 'Set API Token';
        const result = await vscode.window.showErrorMessage(
            'BetterCommit: No API token configured. Please set your API token first.',
            setTokenAction,
        );
        if (result === setTokenAction) {
            await vscode.commands.executeCommand('bettercommit.setApiToken');
        }
        return;
    }

    const model = await promptModel(config, context, apiToken, true);
    if (model) {
        vscode.window.showInformationMessage(`BetterCommit: model switched to ${model}.`);
    }
}

/**
 * Main orchestrator for the commit message generation workflow:
 * 1. Determine the target repository (multi-root aware)
 * 2. Get the git diff for that repo
 * 3. Call the AI API
 * 4. Inject the result into the correct Source Control input box
 */
export async function generateAndInjectCommitMessage(
    context: vscode.ExtensionContext,
    statusBarItem: vscode.StatusBarItem,
    sourceControl?: vscode.SourceControl,
): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('BetterCommit: No workspace folder is open.');
        return;
    }

    // Resolve the target workspace root:
    // 1. From the clicked SCM provider's rootUri (multi-root aware)
    // 2. From the active text editor's workspace folder
    // 3. Fallback to the first workspace folder
    let workspaceRoot: string;
    if (sourceControl?.rootUri) {
        workspaceRoot = sourceControl.rootUri.fsPath;
    } else if (vscode.window.activeTextEditor) {
        const activeWs = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
        workspaceRoot = activeWs ? activeWs.uri.fsPath : workspaceFolders[0].uri.fsPath;
    } else {
        workspaceRoot = workspaceFolders[0].uri.fsPath;
    }
    const config = vscode.workspace.getConfiguration('commitMessageGenerator');

    // Check API token
    const apiToken = await getApiToken(context.secrets);
    if (!apiToken) {
        const setTokenAction = 'Set API Token';
        const result = await vscode.window.showErrorMessage(
            'BetterCommit: No API token configured. Please set your OpenCode API token first.',
            setTokenAction,
        );
        if (result === setTokenAction) {
            await vscode.commands.executeCommand('bettercommit.setApiToken');
        }
        return;
    }

    // Prompt for model selection
    const model = await promptModel(config, context, apiToken);
    if (!model) {
        // User cancelled
        statusBarItem.text = '✨ AI Commit';
        statusBarItem.tooltip = 'Generate commit message with AI';
        return;
    }

    // Read remaining settings
    const conventionalCommit = config.get<boolean>('conventionalCommit', true);
    const multiLine = config.get<boolean>('multiLine', false);
    const linuxKernelCommit = config.get<boolean>('linuxKernelCommit', false);

    // Git identity is needed for the Linux kernel Signed-off-by trailer.
    // Only read it when relevant to avoid an extra git call for the common case.
    const identity = linuxKernelCommit ? await getGitIdentity(workspaceRoot) : undefined;

    // Show loading state
    statusBarItem.text = '✨ Analyzing...';
    statusBarItem.tooltip = 'Analyzing your changes...';
    statusBarItem.show();

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.SourceControl,
            title: 'BetterCommit',
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: 'Analyzing git diff...' });

            try {
                // Step 1: Get the git diff
                const diffResult = await getGitDiff(workspaceRoot);
                const sourceLabel =
                    diffResult.source === 'staged'
                        ? 'staged changes'
                        : diffResult.source === 'unstaged'
                            ? 'unstaged changes'
                            : 'working tree';

                progress.report({
                    message: `Processing ${sourceLabel}...`,
                });

                // Step 2: Summarize diff if needed
                const maxDiffLength = config.get<number>('maxDiffLength', 4000);
                const processedDiff = summarizeDiff(diffResult.diff, maxDiffLength);

                // Step 3: Call the API
                const provider = resolveApiProvider(config);
                progress.report({
                    message: `Calling AI API (${model} via ${provider})...`,
                });
                const commitMessage = provider === 'anthropic'
                    ? await generateCommitMessageViaAnthropic(
                        processedDiff,
                        model,
                        apiToken,
                        conventionalCommit,
                        multiLine,
                        linuxKernelCommit,
                        identity,
                    )
                    : await generateCommitMessage(
                        processedDiff,
                        model,
                        apiToken,
                        conventionalCommit,
                        multiLine,
                        linuxKernelCommit,
                        identity,
                    );

                // Step 4: Inject the message into the correct Source Control input
                await injectCommitMessage(commitMessage, workspaceRoot);

                // Step 5: Show success
                const sourceControlLabel =
                    diffResult.source === 'staged'
                        ? 'Staged'
                        : 'Unstaged';

                statusBarItem.text = '✅ Ready';
                statusBarItem.tooltip = `Generated from ${sourceControlLabel.toLowerCase()} changes using ${model}`;
                setTimeout(() => statusBarItem.hide(), 5000);

                vscode.window.showInformationMessage(
                    `BetterCommit: Commit message generated from ${sourceControlLabel.toLowerCase()} changes. You can edit it before committing.`,
                );
            } catch (error) {
                statusBarItem.hide();
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`BetterCommit: ${message}`);
            }
        },
    );
}

/**
 * Inject the generated commit message into the VS Code Source Control input box.
 * Targets the correct repository in multi-root workspaces.
 * Falls back to clipboard if injection fails.
 */
async function injectCommitMessage(message: string, workspaceRoot?: string): Promise<void> {
    // Approach 1: Use the built-in Git extension's API (most reliable)
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension) {
            if (!gitExtension.isActive) {
                await gitExtension.activate();
            }
            const gitApi = gitExtension.exports.getAPI(1);
            if (gitApi?.repositories?.length > 0) {
                // Match the repo by rootUri so we target the correct project
                let targetRepo = gitApi.repositories[0];
                if (workspaceRoot) {
                    const matched = gitApi.repositories.find(
                        (r: { rootUri?: { fsPath?: string } }) => r.rootUri?.fsPath === workspaceRoot,
                    );
                    if (matched) {
                        targetRepo = matched;
                    }
                }
                targetRepo.inputBox.value = message;
                return;
            }
        }
    } catch {
        // Git extension not available — fall through to next approach
    }

    // Approach 2: Try the generic scm.inputBox (works when SCM view is focused)
    if (vscode.scm.inputBox) {
        vscode.scm.inputBox.value = message;
        return;
    }

    // Approach 3: Last fallback — copy to clipboard
    await vscode.env.clipboard.writeText(message);
    vscode.window.showInformationMessage(
        'BetterCommit: Commit message copied to clipboard (could not inject into SCM input).',
    );
}
