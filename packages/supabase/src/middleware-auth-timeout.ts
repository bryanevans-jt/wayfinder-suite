export const MIDDLEWARE_AUTH_TIMEOUT_MS = 9_000;

export class MiddlewareAuthTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out after ${MIDDLEWARE_AUTH_TIMEOUT_MS}ms`);
    this.name = "MiddlewareAuthTimeoutError";
  }
}

export async function withMiddlewareAuthTimeout<T>(
  label: string,
  work: Promise<T>
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new MiddlewareAuthTimeoutError(label)),
          MIDDLEWARE_AUTH_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
