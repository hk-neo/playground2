import type { CprCurve, CprEngine, CprExtractOptions, CprResult } from '../cpr';

export type CprRequestQuality = 'preview' | 'final';

export interface CprRequest {
  readonly curve: CprCurve;
  readonly options?: CprExtractOptions;
  readonly quality?: CprRequestQuality;
}

export interface CprRequestControllerOptions {
  readonly engine: CprEngine;
  readonly onResult: (result: CprResult, request: CprRequest) => void;
  readonly onError?: (error: unknown) => void;
  readonly requestFrame?: (callback: () => void) => void;
}

interface ScheduledEntry {
  readonly request: CprRequest;
  readonly generation: number;
}

function defaultRequestFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
    return;
  }
  setTimeout(callback, 16);
}

/**
 * 최신-결과-우선(latest-result-wins) 비동기 CPR 추출 스케줄러.
 *
 * - 같은 프레임에 들어온 여러 `schedule()` 호출은 하나로 병합되고,
 *   마지막(최신) 요청의 옵션만 채택되어 프레임당 최대 1회만 `engine.extract`를 호출한다.
 * - 각 요청은 단조 증가하는 세대(generation) 번호를 가지며, 완료 시점에
 *   최신 세대와 일치하는 결과만 `onResult`로 전달된다. 대체된 결과는 무시한다.
 * - `requestFrame`을 주입할 수 있어 DOM 없이 결정적으로 테스트 가능하다.
 */
export class CprRequestController {
  private readonly engine: CprEngine;
  private readonly onResult: (result: CprResult, request: CprRequest) => void;
  private readonly onError?: (error: unknown) => void;
  private readonly requestFrame: (callback: () => void) => void;

  private generation = 0;
  private pending: ScheduledEntry | null = null;
  private inFlight: ScheduledEntry | null = null;
  private frameQueued = false;
  private disposed = false;

  constructor(options: CprRequestControllerOptions) {
    this.engine = options.engine;
    this.onResult = options.onResult;
    this.onError = options.onError;
    this.requestFrame = options.requestFrame ?? defaultRequestFrame;
  }

  schedule(request: CprRequest): void {
    if (this.disposed) return;
    this.generation += 1;
    this.pending = { request, generation: this.generation };
    this.ensureFrame();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.pending = null;
    this.inFlight = null;
  }

  private ensureFrame(): void {
    if (this.frameQueued || this.disposed) return;
    this.frameQueued = true;
    this.requestFrame(() => {
      this.frameQueued = false;
      this.startNext();
    });
  }

  private startNext(): void {
    if (this.disposed || this.inFlight !== null || this.pending === null) return;
    const entry = this.pending;
    this.pending = null;
    this.inFlight = entry;
    this.engine.extract(entry.request.curve, entry.request.options).then(
      (result) => this.settle(entry, result),
      (error) => this.settleFailed(entry, error),
    );
  }

  private settle(entry: ScheduledEntry, result: CprResult): void {
    if (this.disposed) return;
    if (this.inFlight === entry) this.inFlight = null;
    if (entry.generation === this.generation) {
      this.onResult(result, entry.request);
    }
    if (this.pending !== null) this.ensureFrame();
  }

  private settleFailed(entry: ScheduledEntry, error: unknown): void {
    if (this.disposed) return;
    if (this.inFlight === entry) this.inFlight = null;
    if (entry.generation === this.generation) this.onError?.(error);
    if (this.pending !== null) this.ensureFrame();
  }
}
