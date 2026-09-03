import type { PreparedCurve } from './curve-samples';
import {
  defaultBackendFactories,
  selectBackend,
  type CprBackendFactories,
  type CprBackendImpl,
} from './engine';
import type { CprCurve, CprPoint } from './types';
import type { CprWorkerRequest, CprWorkerResponse, CprWorkerScope } from './worker-protocol';

interface SelectedBackend {
  backend: CprBackendImpl;
  name: 'wasm' | 'cpu';
  fallbackReason?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function curveFromPreparedSamples(curve: PreparedCurve): CprCurve {
  const sampleCount = curve.x.length;
  const points: CprPoint[] = [];
  for (let index = 0; index < sampleCount; index++) {
    points.push({ x: curve.x[index], y: curve.y[index], z: 0 });
  }
  return {
    points,
    sample(t: number): CprPoint {
      const clamped = Math.min(1, Math.max(0, t));
      const position = clamped * (sampleCount - 1);
      const lowerIndex = Math.floor(position);
      if (lowerIndex >= sampleCount - 1) {
        return points[sampleCount - 1];
      }
      const fraction = position - lowerIndex;
      if (fraction === 0) {
        return points[lowerIndex];
      }
      const lower = points[lowerIndex];
      const upper = points[lowerIndex + 1];
      return {
        x: lower.x + (upper.x - lower.x) * fraction,
        y: lower.y + (upper.y - lower.y) * fraction,
        z: 0,
      };
    },
  };
}

export function createCprWorkerHandler(
  scope: CprWorkerScope,
  factories: CprBackendFactories = defaultBackendFactories,
): (request: CprWorkerRequest) => void {
  let selection: Promise<SelectedBackend> | undefined;
  let selected: SelectedBackend | undefined;

  const respondError = (id: number, error: unknown): void => {
    scope.postMessage({ type: 'error', id, message: errorMessage(error) });
  };

  const resolveSelection = async (): Promise<SelectedBackend> => {
    if (selected) {
      return selected;
    }
    if (!selection) {
      throw new Error('CPR worker requires an init message before other requests');
    }
    return selection;
  };

  const handleRequest = async (request: CprWorkerRequest): Promise<void> => {
    switch (request.type) {
      case 'init': {
        try {
          const pendingSelection = selectBackend(
            { backend: request.backend, wasmUrl: request.wasmUrl },
            factories,
          );
          selection = pendingSelection;
          const resolved = await pendingSelection;
          selected = resolved;
          scope.postMessage({
            type: 'result',
            id: request.id,
            init: { backend: resolved.name, fallbackReason: resolved.fallbackReason },
          });
        } catch (error) {
          selection = undefined;
          respondError(request.id, error);
        }
        return;
      }
      case 'set-volume': {
        try {
          const resolved = await resolveSelection();
          await resolved.backend.setVolume(request.volume);
          scope.postMessage({ type: 'result', id: request.id });
        } catch (error) {
          respondError(request.id, error);
        }
        return;
      }
      case 'extract': {
        try {
          const resolved = await resolveSelection();
          const result = await resolved.backend.extract(
            curveFromPreparedSamples(request.curve),
            request.options,
          );
          scope.postMessage(
            { type: 'result', id: request.id, extract: result },
            [result.data.buffer as ArrayBuffer],
          );
        } catch (error) {
          respondError(request.id, error);
        }
        return;
      }
      case 'dispose': {
        selected?.backend.dispose();
        selected = undefined;
        selection = undefined;
        return;
      }
    }
  };

  return (request: CprWorkerRequest): void => {
    void handleRequest(request);
  };
}

export interface CprWorkerGlobalScope extends CprWorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
}

export function startCprWorker(
  scope: CprWorkerGlobalScope,
  factories?: CprBackendFactories,
): void {
  const handler = createCprWorkerHandler(scope, factories);
  scope.onmessage = (event) => {
    handler(event.data as CprWorkerRequest);
  };
}

const maybeWorkerScope = globalThis as Partial<CprWorkerGlobalScope> & {
  WorkerGlobalScope?: unknown;
};
if (
  typeof maybeWorkerScope.postMessage === 'function'
  && maybeWorkerScope.WorkerGlobalScope !== undefined
) {
  startCprWorker(maybeWorkerScope as CprWorkerGlobalScope);
}
