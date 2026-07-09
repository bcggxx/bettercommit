import { simpleGit, SimpleGit } from 'simple-git';

/**
 * Extract git diff from the current workspace.
 * - Prefers staged changes.
 * - Falls back to unstaged changes if nothing is staged.
 * - Uses simple-git for reliable git interaction.
 */
export async function getGitDiff(workspaceRoot: string): Promise<GitDiffResult> {
    const git: SimpleGit = simpleGit(workspaceRoot);

    const [stagedDiff, unstagedDiff] = await Promise.all([
        git.diff(['--cached', '--unified=3']),
        git.diff(['--unified=3']),
    ]);

    if (stagedDiff && stagedDiff.trim().length > 0) {
        return { diff: stagedDiff, source: 'staged' };
    }

    if (unstagedDiff && unstagedDiff.trim().length > 0) {
        return { diff: unstagedDiff, source: 'unstaged' };
    }

    const workingDiff = await git.diff(['HEAD', '--unified=3']);
    if (workingDiff && workingDiff.trim().length > 0) {
        return { diff: workingDiff, source: 'working-tree' };
    }

    throw new Error('No changes detected in the repository. Stage some changes first and try again.');
}

/**
 * Summarize a large diff to fit within the API's context window.
 * Keeps the most important parts: file names, function signatures, and first/last chunks.
 */
export function summarizeDiff(diff: string, maxLength: number): string {
    if (diff.length <= maxLength) {
        return diff;
    }

    const lines = diff.split('\n');
    const headerLines: string[] = [];
    const bodyLines: string[] = [];
    let inHeader = true;

    for (const line of lines) {
        if (inHeader) {
            headerLines.push(line);
            if (line.startsWith('@@')) {
                inHeader = false;
                bodyLines.push(line);
            }
        } else {
            bodyLines.push(line);
        }
    }

    // Always include: file headers + first chunk + last chunk
    const availableBody = maxLength - headerLines.join('\n').length - 200; // reserve for summary note
    if (availableBody <= 0) {
        return headerLines.join('\n') + '\n\n[Diff truncated — too large to display fully]';
    }

    const half = Math.floor(availableBody / 2);
    const firstHalf = bodyLines.slice(0, Math.min(half, bodyLines.length)).join('\n');
    const secondHalf = bodyLines.slice(Math.max(0, bodyLines.length - half)).join('\n');

    const separator = '\n\n... [middle of diff truncated for brevity] ...\n\n';

    return headerLines.join('\n') + '\n' + firstHalf + separator + secondHalf;
}

export interface GitDiffResult {
    diff: string;
    source: 'staged' | 'unstaged' | 'working-tree';
}


