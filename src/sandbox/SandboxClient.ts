import { RpcRequestSchema, RpcResponseSchema, type RpcError, type RpcRequest, type RpcResponse } from './rpcSchemas';
import { AddUserParamsSchema, type AddUserParams } from './toolRegistry';

type WorkerToMainMessage =
  | { t: 'RPC_REQUEST'; payload: RpcRequest }
  | { t: 'RUN_RESULT'; rid: number; ok: boolean; result?: unknown; error?: string };

type MainToWorkerMessage =
  | { t: 'RPC_RESPONSE'; payload: RpcResponse }
  | { t: 'RUN'; rid: number; code: string };

function makeError(code: string, message: string, details?: unknown): RpcError {
  return { code, message, details };
}

export class SandboxClient {
  private worker: Worker;
  private nextRid = 1;
  private pendingRuns = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./sandbox-worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (ev: MessageEvent<WorkerToMainMessage>) => {
      void this.onMessage(ev.data);
    });
  }

  public async run(code: string): Promise<unknown> {
    const rid = this.nextRid++;
    const msg: MainToWorkerMessage = { t: 'RUN', rid, code };
    return await new Promise((resolve, reject) => {
      this.pendingRuns.set(rid, { resolve, reject });
      this.worker.postMessage(msg);
    });
  }

  public terminate(): void {
    try {
      this.worker.terminate();
    } catch {
      // ignore
    }
  }

  private async onMessage(msg: WorkerToMainMessage): Promise<void> {
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'RUN_RESULT') {
      const pending = this.pendingRuns.get(msg.rid);
      if (!pending) return;
      this.pendingRuns.delete(msg.rid);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(msg.error || 'Sandbox run failed'));
      return;
    }

    if (msg.t === 'RPC_REQUEST') {
      const parsed = RpcRequestSchema.safeParse(msg.payload);
      if (!parsed.success) {
        return this.postRpcResponse({
          id: msg.payload?.id ?? 'unknown',
          ok: false,
          error: makeError('VALIDATION_ERROR', 'Invalid RPC request', parsed.error.flatten()),
        });
      }

      const req = parsed.data;
      if (req.method === 'addUser') {
        // Worker sends params as JSON string (or {json: string}) to avoid complex value bridging.
        let rawParams: unknown = req.params ?? {};
        try {
          if (typeof rawParams === 'string') rawParams = JSON.parse(rawParams);
          else if (rawParams && typeof rawParams === 'object' && typeof (rawParams as any).json === 'string') {
            rawParams = JSON.parse((rawParams as any).json);
          }
        } catch (e) {
          return this.postRpcResponse({
            id: req.id,
            ok: false,
            error: makeError('VALIDATION_ERROR', 'Invalid addUser params JSON'),
          });
        }

        const p = AddUserParamsSchema.safeParse(rawParams);
        if (!p.success) {
          return this.postRpcResponse({
            id: req.id,
            ok: false,
            error: makeError('VALIDATION_ERROR', 'Invalid addUser params', p.error.flatten()),
          });
        }
        const result = await this.addUser(p.data);
        return this.postRpcResponse({ id: req.id, ok: true, result });
      }

      return this.postRpcResponse({
        id: req.id,
        ok: false,
        error: makeError('METHOD_NOT_FOUND', `Unknown RPC method: ${req.method}`),
      });
    }
  }

  private async addUser(params: AddUserParams): Promise<any> {
    // Stub implementation (for now): just log + return a fake "created user" payload.
    // Later this will drive the UI on the main thread.
    console.log('[Sandbox API] addUser called:', params);
    return {
      ok: true,
      userId: `usr_mock_${Date.now()}`,
      email: params.email,
      name: params.name ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  private postRpcResponse(payload: RpcResponse): void {
    const parsed = RpcResponseSchema.safeParse(payload);
    const safePayload = parsed.success
      ? parsed.data
      : ({ id: payload.id, ok: false, error: makeError('VALIDATION_ERROR', 'Invalid RPC response') } satisfies RpcResponse);
    const msg: MainToWorkerMessage = { t: 'RPC_RESPONSE', payload: safePayload };
    this.worker.postMessage(msg);
  }
}

