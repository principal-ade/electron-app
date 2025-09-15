export class GitHubShellAdapter {
    async openExternal(url) {
        try {
            const maybeMain = (typeof window !== 'undefined') ? window.mainProcess : undefined;
            if (maybeMain?.shell?.openExternal) {
                await maybeMain.shell.openExternal(url);
                return;
            }
            if (typeof window !== 'undefined') {
                const opened = window.open(url, '_blank', 'noopener,noreferrer');
                if (!opened) {
                    window.location.href = url;
                }
                return;
            }
            throw new Error('No shell available to open external URL');
        }
        catch (error) {
            console.error('[GitHubShellAdapter] Failed to open external URL:', error);
        }
    }
}
