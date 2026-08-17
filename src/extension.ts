import * as vscode from 'vscode';
import { generateAndInjectCommitMessage, selectModel } from './commitGenerator';
import { storeApiToken, deleteApiToken, getApiToken } from './opencodeClient';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
    );
    statusBarItem.command = 'bettercommit.generateCommitMessage';
    statusBarItem.text = '✨ AI Commit';
    statusBarItem.tooltip = 'Generate commit message with AI';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register command: Generate Commit Message
    const generateCmd = vscode.commands.registerCommand(
        'bettercommit.generateCommitMessage',
        async (sourceControl?: vscode.SourceControl) => {
            await generateAndInjectCommitMessage(context, statusBarItem, sourceControl);
        },
    );
    context.subscriptions.push(generateCmd);

    // Register command: Regenerate Commit Message
    const regenerateCmd = vscode.commands.registerCommand(
        'bettercommit.regenerateCommitMessage',
        async (sourceControl?: vscode.SourceControl) => {
            await generateAndInjectCommitMessage(context, statusBarItem, sourceControl);
        },
    );
    context.subscriptions.push(regenerateCmd);

    // Register command: Set API Token
    const setTokenCmd = vscode.commands.registerCommand(
        'bettercommit.setApiToken',
        async () => {
            const existingToken = await getApiToken(context.secrets);

            const token = await vscode.window.showInputBox({
                title: 'OpenCode API Token',
                prompt: 'Enter your AI API token (OpenAI, OpenRouter, Groq, DeepSeek, etc.)',
                placeHolder: 'sk-...',
                password: true,
                ignoreFocusOut: true,
                value: existingToken || '',
                validateInput: (value: string) => {
                    if (!value || value.trim().length === 0) {
                        return 'Token cannot be empty';
                    }
                    // Note: do NOT reject short tokens here. Local providers such as
                    // Ollama use "ollama" (6 chars) as a placeholder token, and other
                    // local servers may use similarly short values. Length-based
                    // validation would block legitimate local setups documented in the
                    // README. Rely on the empty check above plus server-side auth.
                    return null;
                },
            });

            if (token !== undefined) {
                if (token.trim().length === 0) {
                    // User wants to remove the token
                    await deleteApiToken(context.secrets);
                    vscode.window.showInformationMessage(
                        'BetterCommit: API token has been removed.',
                    );
                } else {
                    await storeApiToken(context.secrets, token.trim());
                    // Also mask the token in the notification
                    const masked = token.trim().slice(0, 4) + '...' + token.trim().slice(-4);
                    vscode.window.showInformationMessage(
                        `BetterCommit: API token saved (${masked}).`,
                    );
                }
            }
        },
    );
    context.subscriptions.push(setTokenCmd);

    // Register command: Select Model (re-fetches the model list from the API)
    const selectModelCmd = vscode.commands.registerCommand(
        'bettercommit.selectModel',
        async () => {
            await selectModel(context);
        },
    );
    context.subscriptions.push(selectModelCmd);

    // Log activation (without any sensitive data)
    console.log('BetterCommit extension activated.');
}

export function deactivate(): void {
    // Clean up
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    console.log('BetterCommit extension deactivated.');
}
