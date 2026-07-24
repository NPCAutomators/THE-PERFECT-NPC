export class PromiseTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "PromiseTimeoutError";
  }
}

/**
 * Bound UI-facing requests so one stalled endpoint cannot leave a route on an
 * infinite loading screen. The source promise is still observed after the
 * timeout, which prevents a late rejection from becoming unhandled.
 */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label = "Request",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new PromiseTimeoutError(label, timeoutMs)),
      timeoutMs,
    );

    Promise.resolve(promise).then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
