import path from 'path';
import {
  createOpencodeClient,
  createOpencodeServer,
} from '@opencode-ai/sdk';
import type { PromoteProgressEntry } from '../../shared/main-process-api-interfaces/OpenCodePromoteAPI';
import { detectOpenCode } from './openCodeDetect';

export interface RunPromptOpts {
  prompt: string;
  /** Working directory the agent operates inside. Defaults to process.cwd(). */
  cwd?: string;
  /** Optional system prompt prepended to the conversation. */
  system?: string;
  /** Provider + model id; if omitted, the user's opencode default is used. */
  model?: { providerID: string; modelID: string };
  /** Hard cap on total run time. Defaults to 120s. */
  timeoutMs?: number;
  /** Called with progress entries as the agent runs. */
  onProgress?: (entry: PromoteProgressEntry) => void;
}

function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function normalizeEvent(
  event: { type?: string; properties?: Record<string, unknown> } | undefined,
  sessionId: string,
): PromoteProgressEntry | null {
  if (!event || typeof event !== 'object') return null;
  const type = event.type;
  const props = (event.properties as Record<string, unknown>) ?? {};
  // Filter to our session where the event carries one.
  const eventSessionId =
    typeof props.sessionID === 'string'
      ? props.sessionID
      : typeof (props.info as { sessionID?: unknown })?.sessionID === 'string'
        ? ((props.info as { sessionID: string }).sessionID)
        : undefined;
  if (eventSessionId && eventSessionId !== sessionId) return null;

  const now = Date.now();
  switch (type) {
    case 'message.part.updated': {
      const part = props.part as
        | {
            type?: string;
            tool?: string;
            state?: { status?: string };
            text?: string;
            input?: unknown;
          }
        | undefined;
      if (!part) return null;
      if (part.type === 'tool') {
        const status = part.state?.status ?? 'running';
        const tool = part.tool ?? 'tool';
        const input =
          part.input && typeof part.input === 'object'
            ? truncate(JSON.stringify(part.input))
            : undefined;
        return {
          time: now,
          kind: status === 'completed' ? 'tool-result' : 'tool',
          label:
            status === 'completed'
              ? `✓ ${tool}`
              : status === 'error'
                ? `✗ ${tool}`
                : `${tool}…`,
          detail: input,
        };
      }
      if (part.type === 'step-start') {
        return { time: now, kind: 'step', label: 'Step start' };
      }
      if (part.type === 'step-finish') {
        return { time: now, kind: 'step', label: 'Step finish' };
      }
      if (part.type === 'reasoning' && typeof part.text === 'string') {
        return {
          time: now,
          kind: 'text',
          label: 'Reasoning',
          detail: truncate(part.text),
        };
      }
      // Skip text part updates — too noisy (one per token-ish).
      return null;
    }
    case 'session.error': {
      const err = props.error as { message?: string } | undefined;
      return {
        time: now,
        kind: 'error',
        label: 'Session error',
        detail: err?.message ?? JSON.stringify(props).slice(0, 200),
      };
    }
    case 'session.idle':
      return { time: now, kind: 'info', label: 'Session idle' };
    default:
      return null;
  }
}

export interface RunPromptResult {
  ok: boolean;
  text?: string;
  sessionId?: string;
  durationMs: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;

// Default to a free OpenRouter model so the promote flow never silently
// consumes a paid Claude Pro / API-key quota. Caller can override via
// opts.model. Requires `opencode auth login` against `openrouter`. The
// model id must exist in opencode's models.dev catalog (run `opencode
// models` to list); unknown ids fail with ProviderModelNotFoundError.
const DEFAULT_MODEL = {
  providerID: 'openrouter',
  modelID: 'openai/gpt-oss-120b:free',
};

export async function runOpenCodePrompt(
  opts: RunPromptOpts,
): Promise<RunPromptResult> {
  const started = Date.now();

  const detected = await detectOpenCode();
  if (!detected.installed || !detected.path) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: 'opencode binary not found on PATH',
    };
  }
  if (!detected.authed) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: 'opencode is not authed — run `opencode auth login`',
    };
  }

  // Electron's process.env.PATH typically doesn't include shell additions
  // like ~/.local/bin when launched from Finder. Prepend the detected
  // binary's directory so the SDK's cross-spawn can resolve `opencode`.
  const binDir = path.dirname(detected.path);
  const prevPath = process.env.PATH;
  if (!prevPath || !prevPath.split(path.delimiter).includes(binDir)) {
    process.env.PATH = `${binDir}${path.delimiter}${prevPath ?? ''}`;
  }

  let server: { url: string; close(): void } | undefined;
  const subscriptionAbort = new AbortController();
  let subscriptionTask: Promise<void> | null = null;
  try {
    server = await createOpencodeServer({});
    const client = createOpencodeClient({ baseUrl: server.url });

    const sessionResp = await client.session.create({
      body: { title: 'principal-ade-spike' },
    });
    const sessionId = sessionResp.data?.id;
    if (!sessionId) {
      return {
        ok: false,
        durationMs: Date.now() - started,
        error: 'session.create returned no id',
      };
    }

    const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signal = AbortSignal.timeout(timeout);

    // Start subscribing to events BEFORE we kick the prompt so we don't
    // miss the early ones. The subscription runs as a background task and
    // is cancelled in the finally block.
    if (opts.onProgress) {
      const onProgress = opts.onProgress;
      subscriptionTask = (async () => {
        try {
          const result = await client.event.subscribe({
            signal: subscriptionAbort.signal,
          });
          const stream = (result as { stream?: AsyncIterable<unknown> })
            .stream;
          if (!stream) return;
          for await (const ev of stream) {
            if (subscriptionAbort.signal.aborted) break;
            const entry = normalizeEvent(
              ev as { type?: string; properties?: Record<string, unknown> },
              sessionId,
            );
            if (entry) {
              try {
                onProgress(entry);
              } catch (err) {
                console.warn('[openCodeRunner] onProgress threw', err);
              }
            }
          }
        } catch (err) {
          if (!subscriptionAbort.signal.aborted) {
            console.warn('[openCodeRunner] event subscribe failed', err);
          }
        }
      })();
      onProgress({
        time: Date.now(),
        kind: 'info',
        label: 'Session created',
        detail: sessionId,
      });
    }

    const model = opts.model ?? DEFAULT_MODEL;
    console.log(
      '[openCodeRunner] prompting',
      JSON.stringify({ sessionId, model, cwd: opts.cwd ?? null }),
    );
    if (opts.onProgress) {
      opts.onProgress({
        time: Date.now(),
        kind: 'info',
        label: 'Prompt sent',
        detail: `${model.providerID}/${model.modelID}`,
      });
    }
    const promptResp = await client.session.prompt({
      path: { id: sessionId },
      query: opts.cwd ? { directory: opts.cwd } : undefined,
      body: {
        ...(opts.system ? { system: opts.system } : {}),
        model,
        parts: [{ type: 'text', text: opts.prompt }],
      },
      signal,
    });

    const httpStatus =
      (promptResp as { response?: Response }).response?.status ?? null;
    const httpError = (promptResp as { error?: unknown }).error;
    if (httpStatus !== null && httpStatus >= 400) {
      const errBody = httpError ? JSON.stringify(httpError).slice(0, 500) : '';
      console.warn('[openCodeRunner] http error', httpStatus, errBody);
      return {
        ok: false,
        durationMs: Date.now() - started,
        sessionId,
        error: `HTTP ${httpStatus} from session.prompt — ${errBody || '(no body)'}`,
      };
    }
    if (httpError && !promptResp.data) {
      const errBody = JSON.stringify(httpError).slice(0, 500);
      console.warn('[openCodeRunner] sdk error w/ no data', errBody);
      return {
        ok: false,
        durationMs: Date.now() - started,
        sessionId,
        error: `SDK error: ${errBody}`,
      };
    }
    console.log(
      '[openCodeRunner] response shape',
      JSON.stringify({
        hasData: !!promptResp.data,
        hasInfo: !!promptResp.data?.info,
        partsLen: promptResp.data?.parts?.length ?? 0,
        partTypes: (promptResp.data?.parts ?? []).map(
          (p) => (p as { type?: string }).type ?? '?',
        ),
        infoError: promptResp.data?.info?.error ?? null,
        infoFinish: promptResp.data?.info?.finish ?? null,
        infoProvider: promptResp.data?.info?.providerID ?? null,
        infoModel: promptResp.data?.info?.modelID ?? null,
        httpStatus,
      }),
    );

    const info = promptResp.data?.info;
    const parts = promptResp.data?.parts ?? [];
    const partTypes = parts.map((p) => (p as { type?: string }).type ?? '?');

    // If the assistant message records an error, surface it explicitly.
    if (info?.error) {
      const err = info.error as { name?: string; data?: unknown };
      return {
        ok: false,
        durationMs: Date.now() - started,
        sessionId,
        error: `assistant error (${err.name ?? 'unknown'}): ${JSON.stringify(
          err.data ?? err,
        ).slice(0, 400)} · parts=[${partTypes.join(',')}] · finish=${info.finish ?? 'n/a'} · ${info.providerID ?? '?'}/${info.modelID ?? '?'}`,
      };
    }

    // Collect text from any part that carries readable text. Reasoning
    // models often return ReasoningPart only — fall back to it so the spike
    // shows the user *something* even when the model skipped TextPart.
    const textPieces = parts.flatMap((p) => {
      const part = p as { type?: string; text?: string };
      if (part.type === 'text' && typeof part.text === 'string') {
        return [part.text];
      }
      return [];
    });
    let text = textPieces.join('\n').trim();
    if (!text) {
      const reasoningPieces = parts.flatMap((p) => {
        const part = p as { type?: string; text?: string };
        if (part.type === 'reasoning' && typeof part.text === 'string') {
          return [part.text];
        }
        return [];
      });
      if (reasoningPieces.length > 0) {
        text = `(reasoning only) ${reasoningPieces.join('\n').trim()}`;
      }
    }
    if (!text) {
      // No error, no text, no reasoning — give the user breadcrumbs.
      text = `(empty) parts=[${partTypes.join(',')}] finish=${info?.finish ?? 'n/a'} ${info?.providerID ?? '?'}/${info?.modelID ?? '?'}`;
    }

    return {
      ok: true,
      text,
      sessionId,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    subscriptionAbort.abort();
    if (subscriptionTask) {
      try {
        await subscriptionTask;
      } catch {
        // ignore subscription cleanup errors
      }
    }
    if (server) {
      try {
        server.close();
      } catch {
        // ignore close errors
      }
    }
    if (prevPath !== undefined) {
      process.env.PATH = prevPath;
    }
  }
}
