// The tools, shared by functions of the REST surface (index.ts) and MCP (mcp.ts), so the
// two can never describe different behaviour. Same split as wordroot/src/lib/tools.js.

const EMBED = "@cf/baai/bge-base-en-v1.5";
const CHAT = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM = `You are Joshua's second brain. You know his projects, roadmaps and notes.
Answer only from the CONTEXT below. If it isn't there, say you don't know.
Be terse: lead with the answer in 1-3 lines. No preamble, no bullet walls.

CONTEXT:
`;

export class ToolError extends Error {}

export const TOOLS = [
  {
    name: "search_notes",
    description:
      "Search Joshua's notes, project roadmaps and wiki. Returns the matching passages verbatim with their source files. Use this when you want to read the source yourself.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for." },
        limit: { type: "number", description: "Passages to return, 1-20. Default 6." },
      },
      required: ["query"],
    },
  },
  {
    name: "ask_notes",
    description:
      "Ask a question about Joshua's projects and get a written answer with sources. Slower than search_notes because a model writes the answer.",
    inputSchema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
] as const;

export const TOOL_NAMES = TOOLS.map((t) => t.name);

async function retrieve(env: Env, query: string, limit: number) {
  const { data } = await env.AI.run(EMBED, { text: [query] });
  const hits = await env.VEC.query(data[0], { topK: limit, returnMetadata: true });
  return hits.matches.map((m: any) => ({
    source: m.metadata.source,
    score: Number(m.score.toFixed(3)),
    text: m.metadata.text,
  }));
}

export async function callTool(env: Env, name: string, args: Record<string, any>) {
  if (name === "search_notes") {
    const query = String(args.query ?? "").trim();
    if (!query) throw new ToolError("query is required.");
    // Clamped rather than rejected: an agent guessing limit:100 should get results, not a lecture.
    const limit = Math.min(Math.max(Number(args.limit) || 6, 1), 20);
    return { query, results: await retrieve(env, query, limit) };
  }

  if (name === "ask_notes") {
    const question = String(args.question ?? "").trim();
    if (!question) throw new ToolError("question is required.");
    const results = await retrieve(env, question, 6);
    const context = results.map((r) => `# ${r.source}\n${r.text}`).join("\n\n---\n\n");
    const res = await env.AI.run(CHAT, {
      messages: [
        { role: "system", content: SYSTEM + context },
        { role: "user", content: question },
      ],
    });
    return { question, answer: res.response, sources: [...new Set(results.map((r) => r.source))] };
  }

  return null; // unknown tool; the callers turn this into their own shape of error
}

export async function ingest(env: Env, chunks: Chunk[]) {
  if (!chunks.length) throw new ToolError("no chunks");
  const { data } = await env.AI.run(EMBED, { text: chunks.map((c) => c.text) });
  await env.VEC.upsert(
    data.map((values: number[], i: number) => ({
      id: chunks[i].id,
      values,
      // Vectorize caps metadata per vector; 9k leaves room for the source path.
      metadata: { text: chunks[i].text.slice(0, 9000), source: chunks[i].source },
    })),
  );
  return { ok: true, count: data.length };
}

export type Chunk = { id: string; text: string; source: string };
export interface Env {
  AI: any;
  VEC: any;
  TOKEN: string;
}
