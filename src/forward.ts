/**
 * imgpage core: a forwarding client for the hosted
 * html2img MCP server.
 *
 * Nothing is rendered locally. tools/list is answered
 * from the literal definitions below, taken verbatim
 * from a live capture of the upstream server (name,
 * description and inputSchema exactly as captured; the
 * capture carries no title key, so none is served). A
 * tools/call travels upstream over a streamable-HTTP
 * JSON-RPC session: an initialize POST, a
 * notifications/initialized POST, then the tools/call
 * POST, carrying the Mcp-Session-Id response header on
 * later requests when the upstream issues one. The
 * session opens lazily on the first forwarded call and
 * is reused for the client's life.
 *
 * The endpoint is pinned to https://app.html2img.com/mcp
 * and may be replaced with the HTML2IMG_MCP_URL
 * environment variable (that override is a labelled
 * reconstruction). When HTML2IMG_API_KEY is set, every
 * upstream request carries an
 * `Authorization: Bearer <key>` header (header name and
 * Bearer form pinned by the registry record's own
 * remote declaration; forwarding the key from this env
 * var is a labelled reconstruction, as the record pins
 * no package env name and the capture was taken
 * keyless). When it is unset, no key header goes out.
 *
 * A successful upstream result is returned exactly as
 * received, isError flag and extra fields included.
 * Failures — an upstream JSON-RPC error, a non-2xx
 * status, a body that cannot be parsed, or a fetch that
 * throws or times out — become an isError result whose
 * text begins with `imgpage error:` (that rendering is
 * a labelled reconstruction). Replies may be plain JSON
 * or SSE (`data:` lines); the JSON-RPC message whose id
 * matches the request wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://app.html2img.com/mcp";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/html2img-tools-original.json;           */
/* generated programmatically by parsing and re-serialising the        */
/* fixture JSON, never retyped)                                        */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "generate-image-from-html",
    "description": "Render HTML and CSS into a PNG image, or into an A4 vector PDF with format \"pdf\". Provide complete, self-contained HTML and put styles in an inline <style> block. Remote image URLs load if they are real and publicly accessible; embed generated or local images as base64 data URIs rather than inventing URLs. Returns the rendered image plus a shareable CDN URL; PDF renders return the URL only. Consumes one credit per call.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "html": {
          "type": "string",
          "description": "The full HTML markup to render. Include CSS in an inline <style> block. Publicly accessible remote image URLs work; use base64 data URIs for images that are not hosted anywhere."
        },
        "css": {
          "type": "string",
          "description": "Optional additional CSS to inject into the page."
        },
        "width": {
          "type": "integer",
          "description": "Viewport width in pixels (1-5000). Defaults to 1920."
        },
        "height": {
          "type": "integer",
          "description": "Viewport height in pixels (1-5000). Defaults to 1080."
        },
        "fullpage": {
          "type": "boolean",
          "description": "Capture the full scrollable page instead of just the viewport."
        },
        "dpi": {
          "type": "integer",
          "description": "Scale factor / device pixel ratio (1-4) for higher-resolution output."
        },
        "ms_delay": {
          "type": "integer",
          "description": "Milliseconds to wait before capturing (1-5000), e.g. to let fonts or animations settle."
        },
        "wait_for_selector": {
          "type": "string",
          "description": "Wait until this CSS selector is present before capturing."
        },
        "format": {
          "type": "string",
          "enum": [
            "png",
            "pdf"
          ],
          "description": "Output format. \"png\" (default) returns an image sized by width and height. \"pdf\" returns an A4 portrait vector PDF with selectable, searchable text and automatic pagination; width, height, dpi and fullpage are ignored. Use \"pdf\" for documents such as invoices, reports, certificates and tickets. Use \"png\" for social cards, OG images and anything displayed at fixed pixel dimensions."
        }
      },
      "required": [
        "html"
      ]
    }
  },
  {
    "name": "screenshot-url",
    "description": "Capture a live web page by URL as a PNG screenshot, or as an A4 vector PDF with format \"pdf\". Returns the rendered image plus a shareable CDN URL; PDF renders return the URL only. Consumes one credit per call.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "The fully-qualified URL of the page to capture (https://...)."
        },
        "css": {
          "type": "string",
          "description": "Optional CSS to inject into the page before capture."
        },
        "width": {
          "type": "integer",
          "description": "Viewport width in pixels (1-5000). Defaults to 1920."
        },
        "height": {
          "type": "integer",
          "description": "Viewport height in pixels (1-5000). Defaults to 1080."
        },
        "fullpage": {
          "type": "boolean",
          "description": "Capture the full scrollable page instead of just the viewport."
        },
        "selector": {
          "type": "string",
          "description": "Capture only the element matching this CSS selector."
        },
        "dpi": {
          "type": "integer",
          "description": "Scale factor / device pixel ratio (1-4) for higher-resolution output."
        },
        "ms_delay": {
          "type": "integer",
          "description": "Milliseconds to wait before capturing (1-5000)."
        },
        "wait_for_selector": {
          "type": "string",
          "description": "Wait until this CSS selector is present before capturing."
        },
        "format": {
          "type": "string",
          "enum": [
            "png",
            "pdf"
          ],
          "description": "Output format. \"png\" (default) returns an image sized by width and height. \"pdf\" returns the page as an A4 portrait vector PDF with selectable, searchable text and automatic pagination; width, height, dpi, fullpage and selector are ignored. Use \"pdf\" to archive a page or produce a printable record. Use \"png\" for anything displayed at fixed pixel dimensions."
        }
      },
      "required": [
        "url"
      ]
    }
  }
];

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` belongs to the captured surface. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `imgpage error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Read a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * present, otherwise the last parseable message, otherwise
 * null when nothing in the body parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not a JSON payload; skip this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client that holds a single upstream
 * session, opened lazily on first use and reused from
 * then on (for the process lifetime in the MCP server,
 * or for a single invocation in the CLI).
 */
export class ImgpageClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).HTML2IMG_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private apiKey(): string | null {
    const raw = (this.deps.env ?? process.env).HTML2IMG_API_KEY;
    if (raw && raw.trim() !== "") return raw.trim();
    return null;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const key = this.apiKey();
    if (key !== null) headers["Authorization"] = `Bearer ${key}`;
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "imgpage", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // Nothing needed from the notification response body.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Hand the upstream result back exactly as received.
    return result;
  }
}

/** Build a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): ImgpageClient {
  return new ImgpageClient(deps);
}

/** One-shot helper: a fresh client for a single call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new ImgpageClient(deps).callTool(name, args);
}
