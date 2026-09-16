// Router. Every surface is thin: it shuffles arguments into callTool() in tools.ts, which
// mcp.ts also calls, so REST and MCP cannot drift apart.

import { callTool, ingest, ToolError, TOOL_NAMES, type Chunk, type Env } from "./tools";
import { CORS, mcp } from "./mcp";
import { PAGE } from "./page";

const ENDPOINTS = {
  "GET  /api/search?q=&limit=": "Matching passages from the notes, verbatim, with sources.",
  "GET  /api/ask?q=": "A written answer with sources. Slower — a model writes it.",
  "POST /api/ingest": "Re-index. Body: { chunks: [{ id, text, source }] }.",
  "POST /mcp": "Model Context Protocol, JSON-RPC. Same tools.",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      return await handle(req, env);
    } catch (e: any) {
      return json({ error: String(e?.message ?? e) }, 500);
    }
  },
};

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // The page itself is public; it holds no note content and asks the browser for the token.
  if (path === "/" && req.method === "GET" && (req.headers.get("accept") ?? "").includes("text/html")) {
    return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // The memory graph is a static, pre-scrubbed render (see public/graph/build.py). Public by design.
  if (path === "/graph" || path.startsWith("/graph/")) {
    const assetUrl = new URL(req.url);
    assetUrl.pathname = path === "/graph" ? "/graph/index.html" : path;
    return env.ASSETS.fetch(new Request(assetUrl, req));
  }

  // These are Joshua's private notes, so every surface is gated — including the discovery
  // route, which would otherwise advertise the index to anyone who found the subdomain.
  if (req.headers.get("authorization") !== `Bearer ${env.TOKEN}`) {
    return json({ error: "unauthorized" }, 401);
  }

  if (path === "/" || path === "/api") return json({ name: "brain", endpoints: ENDPOINTS, tools: TOOL_NAMES });
  if (path === "/mcp") return mcp(req, env);

  if (path === "/api/ingest" || path === "/ingest") {
    if (req.method !== "POST") return json({ error: "POST to ingest." }, 405);
    const body = (await req.json()) as { chunks?: Chunk[] };
    try {
      return json(await ingest(env, body.chunks ?? []));
    } catch (err) {
      if (err instanceof ToolError) return json({ error: err.message }, 400);
      throw err;
    }
  }

  const tool = { "/api/search": "search_notes", "/api/ask": "ask_notes", "/ask": "ask_notes" }[path];
  if (!tool) return json({ error: `Unknown route: ${path}`, endpoints: ENDPOINTS }, 404);

  // GET carries the query in ?q= ; POST bodies stay supported so the old /ask callers and
  // anything that would rather not put a question in a URL keep working.
  const body: any = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const q = url.searchParams.get("q") ?? body.query ?? body.question ?? "";
  const limit = url.searchParams.get("limit") ?? body.limit;

  try {
    return json(await callTool(env, tool, { query: q, question: q, limit }));
  } catch (err) {
    if (err instanceof ToolError) return json({ error: err.message }, 400);
    throw err;
  }
}
