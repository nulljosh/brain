// Stateless MCP over HTTP: no sessions to keep, so the streamable transport reduces to
// JSON-RPC in, JSON-RPC out. Ported from wordroot/functions/mcp.js, which already handles
// the edge cases worth keeping: `params: null`, `arguments: null`,
// notifications/initialized, and a throwing tool coming back as a tool result rather than
// a dead connection.

import { callTool, ToolError, TOOLS, type Env } from "./tools";

const VERSION = "1.0.0";

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization, mcp-protocol-version",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...CORS, ...init.headers },
  });

export async function mcp(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST JSON-RPC to this endpoint" }, { status: 405 });

  let msg: any;
  try {
    msg = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }, { status: 400 });
  }

  // `params = {}` only defaults on undefined, so an explicit `"params": null` — valid
  // JSON-RPC — would otherwise reach params.protocolVersion and throw a 500.
  const { id = null, method } = msg;
  const params = msg.params && typeof msg.params === "object" ? msg.params : {};
  const reply = (result: unknown) => json({ jsonrpc: "2.0", id, result });

  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: params.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "brain", version: VERSION },
      });
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: CORS });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      let result;
      try {
        result = await callTool(env, params.name, params.arguments || {});
      } catch (err) {
        // A tool rejecting its input, or Workers AI being unreachable, is a tool result —
        // the client should see why and retry, not get a dead connection.
        const why = err instanceof ToolError ? err.message : "the notes index or model is unreachable.";
        return reply({ content: [{ type: "text", text: `brain: ${why}` }], isError: true });
      }
      if (!result) {
        return json({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${params.name}` } });
      }
      return reply({
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      });
    }
    default:
      return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}
