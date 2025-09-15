/**
 * Renderer-side service for Alexandria repository management
 * Communicates with main process via IPC using window.mainProcess
 */
export class AlexandriaService {
    static async getRepositories() {
        return window.mainProcess.alexandria.getRepositories();
    }
    static async getRepository(name) {
        return window.mainProcess.alexandria.getRepository(name);
    }
    static async getRepositoryByPath(path) {
        return window.mainProcess.alexandria.getRepositoryByPath(path);
    }
    static async registerRepository(name, path) {
        return window.mainProcess.alexandria.registerRepository(name, path);
    }
    static async removeRepository(name) {
        return window.mainProcess.alexandria.removeRepository(name);
    }
    static async searchRepositories(query) {
        return window.mainProcess.alexandria.searchRepositories(query);
    }
    static async getRepositoriesWithViews() {
        return window.mainProcess.alexandria.getRepositoriesWithViews();
    }
    static async refreshRepository(name) {
        return window.mainProcess.alexandria.refreshRepository(name);
    }
    static async getRepositoryCount() {
        return window.mainProcess.alexandria.getRepositoryCount();
    }
}
