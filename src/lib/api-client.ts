export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status = 0, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  form?: FormData;
  assessmentId?: string;
  timeoutMs?: number;
};

export function validateApiOrigin(
  value: string | null,
  allowHttp = false,
): string {
  if (!value)
    throw new ApiError(
      "Set EXPO_PUBLIC_API_BASE_URL to your SuriOS website address, then restart Expo.",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(
      "The SuriOS server address is invalid. Include https:// and the port if needed.",
    );
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !["http:", "https:"].includes(url.protocol)
  ) {
    throw new ApiError(
      "Use the website origin only, without credentials, /api, or another path.",
    );
  }
  if (url.protocol !== "https:" && !allowHttp)
    throw new ApiError(
      "The released app requires an HTTPS SuriOS server. HTTP is available only during development.",
    );
  return url.origin;
}

export function createApiClient(
  origin: () => string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 20000,
) {
  return async function request<T>(
    path: string,
    options: ApiOptions = {},
  ): Promise<T> {
    if (!/^\/api(?:\/|$)/.test(path)) throw new ApiError("Invalid API path.");
    const base = origin();
    if (options.form && options.body !== undefined)
      throw new ApiError("Choose one request body.");
    if (options.assessmentId && !/^[0-9a-f-]{36}$/i.test(options.assessmentId))
      throw new ApiError("Invalid assessment identifier.");
    const url = new URL(path, base);
    if (url.origin !== base || !/^\/api(?:\/|$)/.test(url.pathname))
      throw new ApiError("Invalid API path.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, options.timeoutMs ?? timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (options.body !== undefined)
        headers["Content-Type"] = "application/json";
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      if (options.assessmentId)
        headers["X-Assessment-Id"] = options.assessmentId;
      const response = await fetcher(url.toString(), {
        method: options.method || "GET",
        headers,
        body:
          options.form ??
          (options.body === undefined
            ? undefined
            : JSON.stringify(options.body)),
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
      });
      const text = await response.text();
      let result: unknown;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        throw new ApiError(
          response.status === 404
            ? "Mobile sign-in is not available on this server yet. Wait for the Azure build and try again."
            : "The server returned an unexpected response. It may be restarting; please try again.",
          response.status,
        );
      }
      if (!response.ok) {
        const message =
          result &&
          typeof result === "object" &&
          "message" in result &&
          typeof result.message === "string"
            ? result.message
            : result &&
                typeof result === "object" &&
                "error" in result &&
                typeof result.error === "string"
              ? result.error
              : "The request could not be completed. Please try again.";
        throw new ApiError(message, response.status, result);
      }
      return result as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (options.signal?.aborted) throw new ApiError("Request cancelled.");
      throw new ApiError(
        controller.signal.aborted
          ? "The server took too long to respond. Please try again."
          : "Cannot reach SuriOS. Check your connection and server address, then try again.",
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  };
}
