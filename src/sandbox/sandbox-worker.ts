/// <reference lib="webworker" />

import { RpcRequestSchema, RpcResponseSchema, type RpcRequest, type RpcResponse } from './rpcSchemas';

// Note: `quickjs-emscripten-core` intentionally does not ship a WASM binary; we pair it with a variant.
// This keeps the bundle smaller and lets you choose the build variant.
//
// Docs pattern:
//   import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core"
//   import releaseVariant from "@jitl/quickjs-singlefile-cjs-release-sync"
//   const QuickJS = await newQuickJSWASMModuleFromVariant(releaseVariant)
//
// We keep types loose here because we only need a tiny surface area right now.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuickJS = any;

const MAX_CYCLES = 100_000_000;
const MEMORY_LIMIT = 64 * 1024 * 1024;

type MainToWorkerMessage =
  | { t: 'RUN'; rid: number; code: string }
  | { t: 'RPC_RESPONSE'; payload: RpcResponse };

type WorkerToMainMessage =
  | { t: 'RUN_RESULT'; rid: number; ok: boolean; result?: unknown; error?: string }
  | { t: 'RPC_REQUEST'; payload: RpcRequest };

let quickJSPromise: Promise<AnyQuickJS> | null = null;

function getRid(): string {
  // @ts-ignore - crypto.randomUUID exists in modern browsers/workers
  return (crypto?.randomUUID?.() as string) ?? `${Date.now()}-${Math.random()}`;
}

async function getQuickJS(): Promise<AnyQuickJS> {
  if (quickJSPromise) return quickJSPromise;

  quickJSPromise = (async () => {
    const core = await import('quickjs-emscripten-core');
    // CJS variant; Vite handles this fine in most setups.
    const variantMod = await import('@jitl/quickjs-singlefile-cjs-release-sync');
    const variant = (variantMod as any).default ?? variantMod;
    return await core.newQuickJSWASMModuleFromVariant(variant);
  })();

  return quickJSPromise;
}

// Pending RPC calls awaiting main-thread responses.
const pendingRpc = new Map<string, { resolve: (resultJson: string) => void; reject: (err: string) => void }>();

function disposeMaybe(x: any): void {
  try {
    x?.dispose?.();
  } catch {
    // ignore
  }
}

function dumpAndDisposeHandle(vm: any, h: any): any {
  try {
    return vm.dump?.(h);
  } finally {
    disposeMaybe(h);
  }
}

function unwrapResultToJs(vm: any, res: any): any {
  // quickjs-emscripten typically returns a Result object which unwrapResult turns into a handle.
  if (typeof vm.unwrapResult === 'function') {
    const h = vm.unwrapResult(res);
    return dumpAndDisposeHandle(vm, h);
  }
  // Fallback: if it's already a handle-ish thing, dump+dispose it.
  if (res && typeof res === 'object' && typeof res.dispose === 'function') {
    return dumpAndDisposeHandle(vm, res);
  }
  return res;
}

function postToMain(msg: WorkerToMainMessage): void {
  // @ts-ignore
  postMessage(msg);
}

async function rpcCall(method: string, paramsJson: string): Promise<string> {
  const id = getRid();
  // Keep params as a JSON string to avoid complicated host<->sandbox value marshalling.
  const payload = RpcRequestSchema.parse({ id, method, params: paramsJson });

  postToMain({ t: 'RPC_REQUEST', payload });

  return await new Promise<string>((resolve, reject) => {
    pendingRpc.set(id, { resolve, reject });
    // Basic timeout to avoid deadlocks (can be tuned later).
    setTimeout(() => {
      if (pendingRpc.has(id)) {
        pendingRpc.delete(id);
        reject(`RPC timeout: ${method}`);
      }
    }, 15_000);
  });
}

// This is the only implemented capability right now.
function installApi(vm: AnyQuickJS): void {
  // Host function exposed into QuickJS.
  // It accepts two strings: method + paramsJson and returns a Promise<string> (json result).
  const hostRpcFn = vm.newFunction('__whRpc', (methodHandle: any, paramsJsonHandle: any) => {
    // In quickjs-emscripten, function callback args are handles that must be disposed.
    // We convert to host values, then dispose them before returning.
    const method = vm.dump(methodHandle);
    const paramsJson = vm.dump(paramsJsonHandle);
    disposeMaybe(methodHandle);
    disposeMaybe(paramsJsonHandle);

    if (typeof vm.newPromise !== 'function') {
      // Fail safe: can't create an async promise in this build; return an error JSON.
      return vm.newString(JSON.stringify({ ok: false, error: { code: 'NO_PROMISES', message: 'QuickJS promise support unavailable' } }));
    }

    const p = vm.newPromise();
    const promiseHandle = p.handle ?? p.promise ?? p[0];
    const resolve = p.resolve ?? p[1];
    const reject = p.reject ?? p[2];

    rpcCall(String(method), String(paramsJson))
      .then((resultJson) => {
        const h = vm.newString(resultJson);
        try {
          resolve(h);
        } finally {
          try {
            h.dispose?.();
          } catch {
            // ignore
          }
          // resolve/reject are usually handles too; dispose after settling.
          disposeMaybe(resolve);
          disposeMaybe(reject);
          // Some implementations return a promise helper with dispose().
          disposeMaybe(p);
        }
      })
      .catch((err) => {
        const h = vm.newString(JSON.stringify({ ok: false, error: { code: 'RPC_ERROR', message: String(err) } }));
        try {
          reject(h);
        } finally {
          try {
            h.dispose?.();
          } catch {
            // ignore
          }
          disposeMaybe(resolve);
          disposeMaybe(reject);
          disposeMaybe(p);
        }
      });

    return promiseHandle;
  });

  vm.setProp(vm.global, '__whRpc', hostRpcFn);
  // Once set on the global, we can dispose our local reference to the function handle.
  disposeMaybe(hostRpcFn);

  // Define `api.addUser` inside the sandbox as an async wrapper around __whRpc.
  // This keeps host<->sandbox value conversion simple (JSON string across the boundary).
  const apiBootstrap = `
    globalThis.api = {
      addUser: async (params) => {
        const resJson = await __whRpc("addUser", JSON.stringify(params ?? {}));
        return JSON.parse(resJson);
      }
    };
  `;

  const r = vm.evalCode(apiBootstrap, { filename: 'bootstrap.js' });
  // Ensure any eval result handles are disposed.
  unwrapResultToJs(vm, r);
}

async function runInSandbox(code: string): Promise<unknown> {
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  let vm: any;

  try {
    runtime.setMemoryLimit(MEMORY_LIMIT);

    let cycles = 0;
    runtime.setInterruptHandler(() => {
      cycles++;
      return cycles < MAX_CYCLES;
    });

    vm = runtime.newContext();
    installApi(vm);

    const wrapped = `
      (async () => {
        ${code}
      })()
    `;

    if (typeof vm.evalCodeAsync === 'function') {
      const res = await vm.evalCodeAsync(wrapped, { filename: 'sandbox.js' });
      return unwrapResultToJs(vm, res);
    }

    const res = vm.evalCode(wrapped, { filename: 'sandbox.js' });
    return unwrapResultToJs(vm, res);
  } finally {
    try {
      vm?.dispose?.();
    } catch {
    }
    try {
      runtime.dispose?.();
    } catch {
    }
  }
}

self.addEventListener('message', async (ev: MessageEvent<MainToWorkerMessage>) => {
  const msg = ev.data;
  try {
    if (msg?.t === 'RUN') {
      const result = await runInSandbox(msg.code);
      postToMain({ t: 'RUN_RESULT', rid: msg.rid, ok: true, result });
      return;
    }

    if (msg?.t === 'RPC_RESPONSE') {
      const parsed = RpcResponseSchema.safeParse(msg.payload);
      if (!parsed.success) return;

      const res = parsed.data;
      const pending = pendingRpc.get(res.id);
      if (!pending) return;
      pendingRpc.delete(res.id);

      if (res.ok) pending.resolve(JSON.stringify(res.result ?? null));
      else pending.reject(res.error?.message ?? 'RPC failed');
      return;
    }
  } catch (e: any) {
    if (msg?.t === 'RUN') {
      postToMain({ t: 'RUN_RESULT', rid: msg.rid, ok: false, error: String(e?.message || e) });
    }
  }
});

