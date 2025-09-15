/**
 * Generic Webview implementation of SearchPlatformAdapter
 * Uses standard DOM/window APIs to work in any webview context
 */
export class WebviewSearchPlatformAdapter {
    constructor() {
        this.handleWindowMessage = (event) => {
            const message = event.data;
            // Notify all registered handlers
            this.messageHandlers.forEach(handler => {
                try {
                    handler(message);
                }
                catch (error) {
                    console.error('Error in message handler:', error);
                }
            });
        };
        this.messageHandlers = new Set();
        this.messageTarget =
            window.parent !== window ? window.parent : window.opener ? window.opener : null;
        // Set up message listener
        window.addEventListener('message', this.handleWindowMessage);
    }
    sendMessage(message) {
        if (this.messageTarget) {
            this.messageTarget.postMessage(message, '*');
        }
        else {
            console.warn('No message target available');
        }
    }
    onMessage(handler) {
        this.messageHandlers.add(handler);
        // Return unsubscribe function
        return () => {
            this.messageHandlers.delete(handler);
        };
    }
    async showInputBox(options) {
        // Try to delegate to parent window first, fallback to browser prompt
        if (this.messageTarget) {
            return new Promise(resolve => {
                const requestId = Math.random().toString(36).substring(7);
                const handler = (event) => {
                    if (event.data.type === 'inputBoxResponse' && event.data.requestId === requestId) {
                        window.removeEventListener('message', handler);
                        resolve(event.data.value);
                    }
                };
                window.addEventListener('message', handler);
                this.sendMessage({
                    type: 'showInputBox',
                    requestId,
                    options,
                });
                // Timeout after 10 seconds and fallback to prompt
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    const result = window.prompt(options.prompt || 'Enter value:', options.value || '');
                    resolve(result || undefined);
                }, 10000);
            });
        }
        else {
            // Fallback to browser prompt
            const result = window.prompt(options.prompt || 'Enter value:', options.value || '');
            return result || undefined;
        }
    }
    async showQuickPick(items, options) {
        if (this.messageTarget) {
            return new Promise(resolve => {
                const requestId = Math.random().toString(36).substring(7);
                const handler = (event) => {
                    if (event.data.type === 'quickPickResponse' && event.data.requestId === requestId) {
                        window.removeEventListener('message', handler);
                        const selectedIndex = event.data.selectedIndex;
                        resolve(selectedIndex >= 0 ? items[selectedIndex] : undefined);
                    }
                };
                window.addEventListener('message', handler);
                this.sendMessage({
                    type: 'showQuickPick',
                    requestId,
                    items,
                    options,
                });
                // Timeout after 30 seconds and fallback to custom dialog
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    this.showFallbackQuickPick(items, options).then(resolve);
                }, 30000);
            });
        }
        else {
            // Fallback to creating a simple select dialog
            return this.showFallbackQuickPick(items, options);
        }
    }
    async showFallbackQuickPick(items, options) {
        return new Promise(resolve => {
            // Create a simple modal dialog
            const modal = document.createElement('div');
            modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
            const dialog = document.createElement('div');
            dialog.style.cssText = `
        background: ${this.getTheme() === 'dark' ? '#2d2d30' : 'white'};
        color: ${this.getTheme() === 'dark' ? 'white' : 'black'};
        border-radius: 8px;
        padding: 20px;
        min-width: 300px;
        max-width: 500px;
        max-height: 70vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `;
            // QuickPickOptions doesn't have a title property, using placeHolder as a header if available
            if (options?.placeHolder) {
                const header = document.createElement('h3');
                header.textContent = 'Select an Option';
                header.style.cssText = 'margin-top: 0; margin-bottom: 16px;';
                dialog.appendChild(header);
            }
            if (options?.placeHolder) {
                const placeholder = document.createElement('p');
                placeholder.textContent = options.placeHolder;
                placeholder.style.cssText = `color: ${this.getTheme() === 'dark' ? '#cccccc' : '#666'}; margin-bottom: 16px;`;
                dialog.appendChild(placeholder);
            }
            const list = document.createElement('div');
            list.style.marginBottom = '16px';
            items.forEach(item => {
                const button = document.createElement('button');
                button.textContent = item.label + (item.description ? ` - ${item.description}` : '');
                button.style.cssText = `
          display: block;
          width: 100%;
          padding: 8px 12px;
          margin-bottom: 4px;
          border: 1px solid ${this.getTheme() === 'dark' ? '#464647' : '#ddd'};
          background: ${this.getTheme() === 'dark' ? '#3c3c3c' : 'white'};
          color: ${this.getTheme() === 'dark' ? 'white' : 'black'};
          cursor: pointer;
          text-align: left;
          border-radius: 4px;
          font-family: inherit;
        `;
                button.addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve(item);
                });
                button.addEventListener('mouseenter', () => {
                    button.style.background = this.getTheme() === 'dark' ? '#464647' : '#f0f0f0';
                });
                button.addEventListener('mouseleave', () => {
                    button.style.background = this.getTheme() === 'dark' ? '#3c3c3c' : 'white';
                });
                list.appendChild(button);
            });
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.style.cssText = `
        padding: 8px 16px;
        border: 1px solid ${this.getTheme() === 'dark' ? '#464647' : '#ddd'};
        background: ${this.getTheme() === 'dark' ? '#464647' : '#f8f8f8'};
        color: ${this.getTheme() === 'dark' ? 'white' : 'black'};
        cursor: pointer;
        border-radius: 4px;
        font-family: inherit;
      `;
            cancelButton.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(undefined);
            });
            dialog.appendChild(list);
            dialog.appendChild(cancelButton);
            modal.appendChild(dialog);
            // Close on outside click
            modal.addEventListener('click', e => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(undefined);
                }
            });
            // Close on escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escapeHandler);
                    document.body.removeChild(modal);
                    resolve(undefined);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            document.body.appendChild(modal);
        });
    }
    async showInformationMessage(message, ...actions) {
        return this.showMessage('info', message, actions);
    }
    async showErrorMessage(message, ...actions) {
        return this.showMessage('error', message, actions);
    }
    async showWarningMessage(message, ...actions) {
        return this.showMessage('warning', message, actions);
    }
    async showMessage(level, message, actions) {
        if (this.messageTarget) {
            return new Promise(resolve => {
                const requestId = Math.random().toString(36).substring(7);
                const handler = (event) => {
                    if (event.data.type === 'messageResponse' && event.data.requestId === requestId) {
                        window.removeEventListener('message', handler);
                        resolve(event.data.action);
                    }
                };
                window.addEventListener('message', handler);
                this.sendMessage({
                    type: 'showMessage',
                    level,
                    message,
                    actions,
                    requestId,
                });
                // Timeout after 10 seconds and fallback to browser dialogs
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    this.showFallbackMessage(message, actions, level).then(resolve);
                }, 10000);
            });
        }
        else {
            // Fallback to browser alert/confirm or custom dialog
            return this.showFallbackMessage(message, actions, level);
        }
    }
    async showFallbackMessage(message, actions, level) {
        if (actions.length === 0) {
            window.alert(message);
            return undefined;
        }
        else if (actions.length === 1) {
            const confirmed = window.confirm(message + '\n\nPress OK for: ' + actions[0]);
            return confirmed ? actions[0] : undefined;
        }
        else {
            // For multiple actions, use our custom dialog
            return this.showFallbackActionDialog(message, actions, level);
        }
    }
    async showFallbackActionDialog(message, actions, level) {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
            const dialog = document.createElement('div');
            dialog.style.cssText = `
        background: ${this.getTheme() === 'dark' ? '#2d2d30' : 'white'};
        color: ${this.getTheme() === 'dark' ? 'white' : 'black'};
        border-radius: 8px;
        padding: 20px;
        min-width: 300px;
        max-width: 500px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `;
            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            messageEl.style.marginBottom = '20px';
            dialog.appendChild(messageEl);
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      `;
            actions.forEach(action => {
                const button = document.createElement('button');
                button.textContent = action;
                const isDark = this.getTheme() === 'dark';
                let bgColor = '#007bff';
                let textColor = 'white';
                if (level === 'error') {
                    bgColor = '#dc3545';
                }
                else if (level === 'warning') {
                    bgColor = '#ffc107';
                    textColor = 'black';
                }
                button.style.cssText = `
          padding: 8px 16px;
          border: 1px solid ${isDark ? '#464647' : '#ddd'};
          background: ${bgColor};
          color: ${textColor};
          cursor: pointer;
          border-radius: 4px;
          font-family: inherit;
        `;
                button.addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve(action);
                });
                buttonContainer.appendChild(button);
            });
            dialog.appendChild(buttonContainer);
            modal.appendChild(dialog);
            // Close on outside click
            modal.addEventListener('click', e => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(undefined);
                }
            });
            // Close on escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escapeHandler);
                    document.body.removeChild(modal);
                    resolve(undefined);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            document.body.appendChild(modal);
        });
    }
    async openFile(uri, options) {
        this.sendMessage({
            type: 'openFile',
            uri,
            slideIndex: options?.slideIndex,
        });
    }
    async withProgress(options, task) {
        // Create a simple progress indicator in the DOM
        const progressEl = this.createProgressIndicator(options.title);
        const reporter = {
            report: value => {
                this.updateProgressIndicator(progressEl, value.message, value.increment);
                // Also send progress message to parent if available
                if (this.messageTarget) {
                    this.sendMessage({
                        type: 'progress',
                        message: value.message,
                        increment: value.increment,
                    });
                }
            },
        };
        try {
            const result = await task(reporter);
            this.removeProgressIndicator(progressEl);
            return result;
        }
        catch (error) {
            this.removeProgressIndicator(progressEl);
            throw error;
        }
    }
    createProgressIndicator(title) {
        const container = document.createElement('div');
        const isDark = this.getTheme() === 'dark';
        container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isDark ? '#2d2d30' : 'white'};
      color: ${isDark ? 'white' : 'black'};
      border: 1px solid ${isDark ? '#464647' : '#ddd'};
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 9999;
      min-width: 250px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.textContent = title;
            titleEl.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
            container.appendChild(titleEl);
        }
        const messageEl = document.createElement('div');
        messageEl.style.marginBottom = '8px';
        container.appendChild(messageEl);
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
      width: 100%;
      height: 4px;
      background: ${isDark ? '#464647' : '#f0f0f0'};
      border-radius: 2px;
      overflow: hidden;
    `;
        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
      height: 100%;
      background: #007bff;
      width: 0%;
      transition: width 0.3s ease;
    `;
        progressBar.appendChild(progressFill);
        container.appendChild(progressBar);
        document.body.appendChild(container);
        return { container, messageEl, progressFill, progress: 0 };
    }
    updateProgressIndicator(progressEl, message, increment) {
        if (message) {
            progressEl.messageEl.textContent = message;
        }
        if (increment !== undefined) {
            progressEl.progress = Math.min(100, progressEl.progress + increment);
            progressEl.progressFill.style.width = `${progressEl.progress}%`;
        }
    }
    removeProgressIndicator(progressEl) {
        if (progressEl.container.parentNode) {
            document.body.removeChild(progressEl.container);
        }
    }
    getPlatformInfo() {
        return {
            type: 'web',
            capabilities: {
                fileWatching: false,
                authorization: this.messageTarget !== null,
                progress: true,
                notifications: true,
                fileAccess: this.messageTarget !== null,
            },
            theme: this.getTheme(),
        };
    }
    async requestAuthorization() {
        if (!this.messageTarget) {
            // No parent to authorize with, assume authorized
            return true;
        }
        return new Promise(resolve => {
            const handler = (event) => {
                if (event.data.type === 'authorizationResponse') {
                    window.removeEventListener('message', handler);
                    resolve(event.data.authorized);
                }
            };
            window.addEventListener('message', handler);
            this.sendMessage({ type: 'authorize' });
            // Timeout after 5 seconds and assume authorized
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve(true);
            }, 5000);
        });
    }
    getInitialQuery() {
        // Check URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const queryParam = urlParams.get('query') || urlParams.get('q');
        if (queryParam) {
            return queryParam;
        }
        // Check window object for initial query
        return window.initialSearchQuery || '';
    }
    getTheme() {
        // Check various indicators for theme
        const bodyClasses = document.body.className;
        const htmlClasses = document.documentElement.className;
        // Check for common theme classes
        if (bodyClasses.includes('dark') ||
            htmlClasses.includes('dark') ||
            bodyClasses.includes('vscode-dark') ||
            htmlClasses.includes('vscode-dark') ||
            bodyClasses.includes('theme-dark') ||
            htmlClasses.includes('theme-dark')) {
            return 'dark';
        }
        // Check CSS custom properties
        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = computedStyle.getPropertyValue('--background-color') ||
            computedStyle.getPropertyValue('--bg-color') ||
            computedStyle.backgroundColor;
        if (bgColor) {
            // Simple heuristic: if background is darker, assume dark theme
            const rgb = bgColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
                if (brightness < 128) {
                    return 'dark';
                }
            }
        }
        // Check media query
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }
    dispose() {
        window.removeEventListener('message', this.handleWindowMessage);
        this.messageHandlers.clear();
    }
}
//# sourceMappingURL=WebviewSearchPlatformAdapter.js.map