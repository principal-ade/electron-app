import type { DiscoveredExtension } from '../../shared/main-process-api-interfaces/ExtensionAPI';

/** Renderer-facing service for installed panel extensions. */
export class ExtensionService {
  static isAvailable(): boolean {
    return Boolean(window.mainProcess?.extension);
  }

  static discover(): Promise<DiscoveredExtension[]> {
    return window.mainProcess.extension.discoverExtensions();
  }

  static getDirectory(): Promise<string> {
    return window.mainProcess.extension.getExtensionsDirectory();
  }

  static onChanged(
    callback: (extensions: DiscoveredExtension[]) => void,
  ): () => void {
    return window.mainProcess.extension.onExtensionsChanged(callback);
  }

  static fetchBundle(packageName: string): Promise<string | null> {
    return window.mainProcess.extension.fetchExtensionBundle(packageName);
  }

  static enable(packageName: string): Promise<void> {
    return window.mainProcess.extension.enableExtension(packageName);
  }

  static disable(packageName: string): Promise<void> {
    return window.mainProcess.extension.disableExtension(packageName);
  }

  static uninstall(packageName: string): Promise<void> {
    return window.mainProcess.extension.uninstallExtension(packageName);
  }
}
