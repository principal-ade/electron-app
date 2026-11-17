/**
 * Renderer service for the ACP bridge. Keeps components away from the raw
 * `window.mainProcess.acp` surface so every call fails with one clear message
 * when the preload bridge is unavailable.
 */
import type {
  AcpAPI,
  AcpConnectRequest,
  AcpConnectResult,
  AcpLoadSessionRequest,
  AcpNewSessionRequest,
  AcpNewSessionResult,
  AcpPromptResult,
  AcpRespondPermissionRequest,
  AcpSetModelRequest,
  AcpSetModelResult,
  AcpSetSessionArtifactsRequest,
  AcpSetSessionArtifactsResult,
  AcpSessionEventEnvelope,
  AcpArtifactAssociation,
} from '../../shared/main-process-api-interfaces/AcpAPI';

const getApi = (): AcpAPI => {
  const api = window.mainProcess?.acp;
  if (!api) throw new Error('ACP is unavailable in this window.');
  return api;
};

export class AcpService {
  static connect(request: AcpConnectRequest): Promise<AcpConnectResult> {
    return getApi().connect(request);
  }

  static newSession(
    request: AcpNewSessionRequest,
  ): Promise<AcpNewSessionResult> {
    return getApi().newSession(request);
  }

  static loadSession(
    request: AcpLoadSessionRequest,
  ): Promise<AcpNewSessionResult> {
    return getApi().loadSession(request);
  }

  static setModel(request: AcpSetModelRequest): Promise<AcpSetModelResult> {
    return getApi().setModel(request);
  }

  static setSessionArtifacts(
    request: AcpSetSessionArtifactsRequest,
  ): Promise<AcpSetSessionArtifactsResult> {
    return getApi().setSessionArtifacts(request);
  }

  static prompt(
    sessionKey: string,
    text: string,
    stagedArtifacts?: AcpArtifactAssociation[],
  ): Promise<AcpPromptResult> {
    return getApi().prompt({
      sessionKey,
      text,
      ...(stagedArtifacts && stagedArtifacts.length > 0
        ? { stagedArtifacts }
        : {}),
    });
  }

  static cancel(sessionKey: string): Promise<void> {
    return getApi().cancel({ sessionKey });
  }

  static respondPermission(
    request: AcpRespondPermissionRequest,
  ): Promise<void> {
    return getApi().respondPermission(request);
  }

  static disconnect(sessionKey: string): Promise<void> {
    return getApi().disconnect({ sessionKey });
  }

  static onSessionEvent(
    callback: (envelope: AcpSessionEventEnvelope) => void,
  ): () => void {
    return getApi().onSessionEvent(callback);
  }
}
