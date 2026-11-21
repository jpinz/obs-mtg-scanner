import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  isSessionId,
  isWriteKey,
  OVERLAY_API_PATH,
  parseOverlayState,
  SESSION_PARAM,
  sessionIdFor,
  type OverlayState,
} from "../src/overlayState.js";

const MAX_BODY_BYTES = 64 * 1024;
/** Abandoned sessions expire on their own; every publish refreshes the timer. */
export const STATE_TTL_SECONDS = 12 * 60 * 60;

/** Where overlay state lives between the scanner's POST and the overlay's next poll. */
export interface OverlayStore {
  get(sessionId: string): Promise<OverlayState | null>;
  set(sessionId: string, state: OverlayState): Promise<void>;
}

/** Single-process store for `vite` and `vite preview`. */
export class MemoryOverlayStore implements OverlayStore {
  private readonly entries = new Map<string, { state: OverlayState; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(sessionId: string): Promise<OverlayState | null> {
    const entry = this.entries.get(sessionId);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(sessionId);
      return null;
    }
    return entry.state;
  }

  async set(sessionId: string, state: OverlayState): Promise<void> {
    this.entries.set(sessionId, { state, expiresAt: this.now() + STATE_TTL_SECONDS * 1000 });
  }
}

/**
 * Upstash Redis over its REST API. Vercel Functions are stateless and may run as many
 * instances, so production state has to live outside the function.
 */
export class UpstashOverlayStore implements OverlayStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async get(sessionId: string): Promise<OverlayState | null> {
    const stored = await this.command(["GET", key(sessionId)]);
    if (typeof stored !== "string") return null;
    try {
      return parseOverlayState(JSON.parse(stored));
    } catch {
      return null;
    }
  }

  async set(sessionId: string, state: OverlayState): Promise<void> {
    await this.command(["SET", key(sessionId), JSON.stringify(state), "EX", String(STATE_TTL_SECONDS)]);
  }

  private async command(args: string[]): Promise<unknown> {
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`Upstash responded with HTTP ${response.status}`);
    const body = (await response.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(`Upstash error: ${body.error}`);
    return body.result;
  }
}

function key(sessionId: string): string {
  return `overlay:${sessionId}`;
}

/**
 * Builds the production store from the variables the Upstash integration in the Vercel
 * Marketplace injects. Both the current and the legacy Vercel KV names are accepted.
 */
export function overlayStoreFromEnv(env: Record<string, string | undefined>): OverlayStore | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? new UpstashOverlayStore(url, token) : null;
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * The overlay API. The scanner app publishes with
 * `POST /api/overlay` + `Authorization: Bearer <write key>`; overlays poll
 * `GET /api/overlay?session=<session id>`. The session ID is derived from the write key,
 * so knowing an overlay URL does not allow publishing to it.
 */
export async function handleOverlayRequest(request: Request, store: OverlayStore): Promise<Response> {
  try {
    if (request.method === "GET") {
      const sessionId = new URL(request.url).searchParams.get(SESSION_PARAM);
      if (!isSessionId(sessionId)) return json(400, { error: "Missing or invalid session" });
      return json(200, (await store.get(sessionId)) ?? { card: null });
    }

    if (request.method === "POST") {
      // Requiring a JSON content type forces a CORS preflight for cross-origin pages,
      // which this endpoint never approves.
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        return json(415, { error: "Expected application/json" });
      }
      const writeKey = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
      if (!isWriteKey(writeKey)) return json(401, { error: "Missing or invalid write key" });

      const body = await request.text();
      if (body.length > MAX_BODY_BYTES) return json(413, { error: "Body too large" });
      let state: OverlayState | null = null;
      try {
        state = parseOverlayState(JSON.parse(body));
      } catch {
        // Invalid JSON gets the same 400 as an invalid shape.
      }
      if (!state) return json(400, { error: "Invalid overlay state" });

      await store.set(await sessionIdFor(writeKey), state);
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  } catch (error) {
    console.error("Overlay relay failed", error);
    return json(503, { error: "Overlay storage is unavailable" });
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        req.removeAllListeners("data");
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Serves the same API (and the `/overlay` rewrite in `vercel.json`) from `vite` and `vite preview`. */
export function overlayRelayPlugin(): Plugin {
  const store = new MemoryOverlayStore();
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && (url.pathname === "/overlay" || url.pathname === "/overlay/")) {
      req.url = `/overlay.html${url.search}`;
      next();
      return;
    }
    if (url.pathname !== OVERLAY_API_PATH) {
      next();
      return;
    }

    let body: Buffer | undefined;
    if (req.method === "POST") {
      try {
        body = await readBody(req);
      } catch {
        res.writeHead(413).end();
        return;
      }
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
    }
    const response = await handleOverlayRequest(
      new Request(url, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined }),
      store,
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  };

  return {
    name: "overlay-relay",
    configureServer(server) {
      server.middlewares.use((req, res, next) => void middleware(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void middleware(req, res, next));
    },
  };
}
